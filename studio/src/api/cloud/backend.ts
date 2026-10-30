import type { z } from 'zod'
import { Block } from '../../schema/block'
import { Brand } from '../../schema/brand'
import { Deck } from '../../schema/deck'
import { fromZod, type Issue } from '../../schema/issues'
import { Layout } from '../../schema/layout'
import { Theme } from '../../schema/theme'
import type { AssetInfo, DeckSummary, Result } from '../client'
import { BRAND_CHANGED, DECK_CHANGED, TEMPLATES_CHANGED } from '../events'
import { loadConfig } from './config'
import { blobToBase64, CloudError, encodeText, Repo } from './github'

/**
 * Die API der App (gleiche Form wie der Datei-Dienst des Dev-Servers), umgesetzt auf dem GitHub-Repo.
 * Geprüft wird hier nur das Schema; Datei-Verweise und Brand-Tokens prüft weiterhin `npm run validate` am Mac.
 */

let repo: Repo | null = null

export function cloudRepo(): Repo {
  const config = loadConfig()
  if (!config) throw new CloudError('Nicht angemeldet', 401)
  if (!repo || repo.config.token !== config.token || repo.config.repo !== config.repo || repo.config.branch !== config.branch) {
    repo = new Repo(config)
  }
  return repo
}

/** Blob-SHA einer Datei (für Cache-sichere Medien-URLs), falls der Dateibaum schon geladen ist. */
export function assetVersion(path: string): string | undefined {
  return repo?.tree.get(path)?.sha
}

const DECK_NAME = /^[a-z0-9][a-z0-9-]*$/
const MAX_UPLOAD = 50 * 1024 * 1024
const MEDIA_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'mp4', 'webm', 'mov', 'm4v', 'json'])
const FONT_EXT = new Set(['woff2', 'woff', 'otf', 'ttf'])

function fail(err: unknown): Result<never> {
  if (err instanceof CloudError) return { ok: false, status: err.status === 404 ? 404 : err.status || 0, issues: [{ path: '', message: err.message }] }
  return { ok: false, status: 500, issues: [{ path: '', message: (err as Error).message }] }
}

const invalid = (issues: Issue[]): Result<never> => ({ ok: false, status: 422, issues })

async function run<T>(task: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await task()
  } catch (err) {
    return fail(err)
  }
}

async function readJson<S extends z.ZodType>(path: string, schema: S): Promise<Result<z.infer<S>>> {
  const text = await cloudRepo().text(path)
  if (text === null) return { ok: false, status: 404, issues: [{ path: '', message: `${path} fehlt` }] }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (err) {
    return invalid([{ path: '', message: `Kein gültiges JSON: ${(err as Error).message}` }])
  }
  const parsed = schema.safeParse(value)
  return parsed.success ? { ok: true, value: parsed.data } : invalid(fromZod(parsed.error))
}

/** Alle gültigen JSON-Dateien eines Ordners (ungültige werden übersprungen – die meldet `npm run validate`). */
async function readAll<S extends z.ZodType>(folder: string, schema: S): Promise<{ file: string; value: z.infer<S> }[]> {
  const r = cloudRepo()
  await r.ready()
  const files = r.list(folder).filter((p) => p.endsWith('.json') && !p.slice(folder.length + 1).includes('/'))
  const results = await Promise.all(files.map(async (file) => ({ file, result: await readJson(file, schema) })))
  return results.flatMap(({ file, result }) => (result.ok ? [{ file, value: result.value }] : []))
}

const json = (value: unknown) => encodeText(JSON.stringify(value, null, 2) + '\n')

function deckNames(): string[] {
  const names = new Set<string>()
  for (const p of cloudRepo().list('decks')) {
    const m = p.match(/^decks\/([^/]+)\/deck\.json$/)
    if (m?.[1] && DECK_NAME.test(m[1])) names.add(m[1])
  }
  return [...names].sort()
}

function assetKind(file: string): AssetInfo['kind'] {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  if (ext === 'json') return 'lottie'
  return 'other'
}

/** "Mein Foto (1).JPG" → "mein-foto-1.jpg" (wie server/assets.ts). */
function cleanFileName(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = base.slice(dot + 1).toLowerCase()
  const stem =
    base
      .slice(0, dot)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'datei'
  return `${stem}.${ext}`
}

function uniquePath(folder: string, file: string): string {
  const tree = cloudRepo().tree
  if (!tree.has(`${folder}/${file}`)) return `${folder}/${file}`
  const dot = file.lastIndexOf('.')
  for (let n = 2; ; n++) {
    const candidate = `${folder}/${file.slice(0, dot)}-${n}${file.slice(dot)}`
    if (!tree.has(candidate)) return candidate
  }
}

export const cloudApi = {
  listDecks: () =>
    run(async () => {
      await cloudRepo().ready()
      const decks = await Promise.all(
        deckNames().map(async (name): Promise<DeckSummary> => {
          const r = await readJson(`decks/${name}/deck.json`, Deck)
          return r.ok
            ? { name, title: r.value.title, slideCount: r.value.slides.length, format: r.value.format, issues: [] }
            : { name, title: name, slideCount: 0, format: null, issues: r.issues }
        }),
      )
      return { ok: true, value: decks }
    }),

  getDeck: (name: string) => run(() => readJson(`decks/${name}/deck.json`, Deck)),

  saveDeck: (name: string, deck: Deck) =>
    run(async () => {
      const parsed = Deck.safeParse(deck)
      if (!parsed.success) return invalid(fromZod(parsed.error))
      await cloudRepo().put(`decks/${name}/deck.json`, json(deck), `Studio: ${deck.title} bearbeitet`)
      return { ok: true, value: parsed.data }
    }),

  createDeck: (name: string, deck: Deck) =>
    run(async () => {
      if (!DECK_NAME.test(name)) return invalid([{ path: '', message: `Ungültiger Deck-Name: ${name}` }])
      await cloudRepo().ready()
      if (cloudRepo().tree.has(`decks/${name}/deck.json`)) return invalid([{ path: '', message: `Deck „${name}“ gibt es schon` }])
      const parsed = Deck.safeParse(deck)
      if (!parsed.success) return invalid(fromZod(parsed.error))
      await cloudRepo().put(`decks/${name}/deck.json`, json(deck), `Studio: neues Deck „${deck.title}“`, null)
      return { ok: true, value: name }
    }),

  getBrand: () => run(() => readJson('brand/brand.json', Brand)),

  saveBrand: (brand: Brand) =>
    run(async () => {
      const parsed = Brand.safeParse(brand)
      if (!parsed.success) return invalid(fromZod(parsed.error))
      await cloudRepo().put('brand/brand.json', json(brand), 'Studio: Brand-Kit bearbeitet')
      return { ok: true, value: parsed.data }
    }),

  getTheme: (name: string) => run(() => readJson(`templates/themes/${name}.json`, Theme)),

  listThemes: () => run(async () => ({ ok: true, value: (await readAll('templates/themes', Theme)).map((e) => e.value) })),

  listLayouts: () => run(async () => ({ ok: true, value: (await readAll('templates/layouts', Layout)).map((e) => e.value) })),

  listBlocks: () => run(async () => ({ ok: true, value: (await readAll('templates/blocks', Block)).map((e) => e.value) })),

  listTemplates: () =>
    run(async () => ({
      ok: true,
      value: (await readAll('templates/decks', Deck)).map((e) => ({ name: e.file.split('/').pop()!.slice(0, -5), deck: e.value })),
    })),

  listAssets: (name: string) =>
    run(async () => {
      const r = cloudRepo()
      await r.ready()
      const prefix = `decks/${name}/`
      const assets = r.list(`decks/${name}/assets`).map((p) => ({ path: p.slice(prefix.length), size: r.tree.get(p)!.size, kind: assetKind(p) }))
      return { ok: true, value: assets }
    }),

  listBrandAssets: () =>
    run(async () => {
      const r = cloudRepo()
      await r.ready()
      const assets = r
        .list('brand')
        .filter((p) => !p.startsWith('brand/fonts/') && assetKind(p) === 'image')
        .map((p) => ({ path: p, size: r.tree.get(p)!.size, kind: 'image' as const }))
      return { ok: true, value: assets }
    }),

  uploadAsset: (name: string, file: Blob, fileName: string) =>
    run(async () => {
      const clean = cleanFileName(fileName)
      const ext = clean?.split('.').pop() ?? ''
      if (!clean || !MEDIA_EXT.has(ext)) return invalid([{ path: '', message: `Dateityp nicht unterstützt: ${fileName}` }])
      if (file.size > MAX_UPLOAD) return invalid([{ path: '', message: 'Datei zu groß (unterwegs max. 50 MB) – große Videos am Mac importieren' }])
      await cloudRepo().ready()
      const full = uniquePath(`decks/${name}/assets`, clean)
      await cloudRepo().put(full, await blobToBase64(file), `Studio: ${clean} zu ${name} hinzugefügt`, null)
      return { ok: true, value: full.slice(`decks/${name}/`.length) }
    }),

  deleteAsset: (name: string, path: string) =>
    run(async () => {
      if (!/^assets\/[^\s]+$/.test(path) || path.split('/').includes('..')) return invalid([{ path: '', message: `Ungültiger Pfad: ${path}` }])
      await cloudRepo().remove(`decks/${name}/${path}`, `Studio: ${path} aus ${name} gelöscht`)
      return { ok: true, value: true as const }
    }),

  uploadFont: (file: Blob, fileName: string) =>
    run(async () => {
      const base = fileName.split(/[\\/]/).pop() ?? ''
      const ext = base.split('.').pop()?.toLowerCase() ?? ''
      if (!FONT_EXT.has(ext)) return invalid([{ path: '', message: `Schriftformat nicht unterstützt: ${fileName}` }])
      await cloudRepo().ready()
      const full = uniquePath('brand/fonts', base.replace(/[^A-Za-z0-9._-]+/g, '-'))
      await cloudRepo().put(full, await blobToBase64(file), `Studio: Schrift ${base} hinzugefügt`, null)
      return { ok: true, value: full.slice('brand/'.length) }
    }),

  /** Probe-Zeiten (decks/<name>/rehearsal.json) – roh, geprüft wird in present/api.ts. */
  getRehearsal: (name: string) =>
    run(async () => {
      const text = await cloudRepo().text(`decks/${name}/rehearsal.json`)
      return { ok: true, value: text ? (JSON.parse(text) as unknown) : null }
    }),

  saveRehearsal: (name: string, rehearsal: unknown) =>
    run(async () => {
      await cloudRepo().put(`decks/${name}/rehearsal.json`, json(rehearsal), `Studio: Probe für ${name}`)
      return { ok: true, value: true as const }
    }),
}

/* ---------- Änderungen von außen: regelmäßig nachsehen statt Live-Events ---------- */

const bus = new EventTarget()
const POLL_MS = 15000
let polling = false

/** Gleiche Ereignisse wie der Dev-Server (src/api/events.ts) – aus den geänderten Pfaden abgeleitet. */
function announce(paths: string[]) {
  const decks = new Set<string>()
  let brand = false
  let templates = false
  for (const p of paths) {
    const deck = p.match(/^decks\/([^/]+)\//)?.[1]
    if (deck) decks.add(deck)
    else if (p.startsWith('brand/')) brand = true
    else if (p.startsWith('templates/')) templates = true
  }
  for (const name of decks) bus.dispatchEvent(new CustomEvent(DECK_CHANGED, { detail: { name } }))
  if (brand) bus.dispatchEvent(new CustomEvent(BRAND_CHANGED, { detail: {} }))
  if (templates) bus.dispatchEvent(new CustomEvent(TEMPLATES_CHANGED, { detail: {} }))
}

function startPolling() {
  if (polling) return
  polling = true
  const tick = () => {
    if (document.visibilityState !== 'visible' || !loadConfig()) return
    cloudRepo()
      .refresh()
      .then(announce)
      .catch(() => {})
  }
  setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', tick)
}

export function onCloudEvent<T>(event: string, cb: (data: T) => void): () => void {
  startPolling()
  const listener = (e: Event) => cb((e as CustomEvent<T>).detail)
  bus.addEventListener(event, listener)
  return () => bus.removeEventListener(event, listener)
}
