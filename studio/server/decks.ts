import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Brand } from '../src/schema/brand'
import { Deck } from '../src/schema/deck'
import { formatPath, fromZod, type Issue } from '../src/schema/issues'

export const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DECKS_DIR = path.join(STUDIO_ROOT, 'decks')
export const BRAND_DIR = path.join(STUDIO_ROOT, 'brand')
export const BRAND_FILE = path.join(BRAND_DIR, 'brand.json')
export const CUSTOM_DIR = path.join(STUDIO_ROOT, 'custom')

const DECK_NAME = /^[a-z0-9][a-z0-9-]*$/

export type DeckResult = { ok: true; deck: Deck } | { ok: false; issues: Issue[] }
export type BrandResult = { ok: true; brand: Brand } | { ok: false; issues: Issue[] }
export type DeckSummary = {
  name: string
  title: string
  slideCount: number
  format: Deck['format'] | null
  issues: Issue[]
}

export function isDeckName(name: string): boolean {
  return DECK_NAME.test(name)
}

export function deckFile(name: string): string {
  if (!isDeckName(name)) throw new Error(`Ungültiger Deck-Name: ${name}`)
  return path.join(DECKS_DIR, name, 'deck.json')
}

export async function listDeckNames(): Promise<string[]> {
  if (!existsSync(DECKS_DIR)) return []
  const entries = await readdir(DECKS_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && isDeckName(e.name) && existsSync(path.join(DECKS_DIR, e.name, 'deck.json')))
    .map((e) => e.name)
    .sort()
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; issues: Issue[] } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (err) {
    return { ok: false, issues: [{ path: '', message: `Kein gültiges JSON: ${(err as Error).message}` }] }
  }
}

export async function readBrand(): Promise<BrandResult> {
  if (!existsSync(BRAND_FILE)) return { ok: false, issues: [{ path: '', message: 'brand/brand.json fehlt' }] }
  const json = parseJson(await readFile(BRAND_FILE, 'utf8'))
  if (!json.ok) return json
  const parsed = Brand.safeParse(json.value)
  if (!parsed.success) return { ok: false, issues: fromZod(parsed.error) }
  const { fonts, logo } = parsed.data
  const missing = [fonts.display.files, fonts.text.files, fonts.mono?.files]
    .flatMap((files) => (files ?? []).map((f) => f.src))
    .concat(logo?.primary ?? [], logo?.mono ?? [])
    .filter((src) => !existsSync(path.join(STUDIO_ROOT, 'brand', src)))
    .map((src) => ({ path: '', message: `Datei fehlt: brand/${src}` }))
  return missing.length ? { ok: false, issues: missing } : { ok: true, brand: parsed.data }
}

/** Läuft rekursiv durch das Deck und ruft `visit` für jeden String mit seinem Pfad auf. */
function walkStrings(value: unknown, at: PropertyKey[], visit: (s: string, at: PropertyKey[]) => void) {
  if (typeof value === 'string') visit(value, at)
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, [...at, i], visit))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkStrings(v, [...at, k], visit)
  }
}

/** Prüfungen, die über das Schema hinausgehen: Dateien, Brand-Tokens, eigene Komponenten. */
export async function checkDeck(name: string, deck: Deck): Promise<Issue[]> {
  const issues: Issue[] = []
  const dir = path.join(DECKS_DIR, name)
  const brand = await readBrand()
  const tokens = brand.ok ? new Set(Object.keys(brand.brand.colors)) : null

  walkStrings(deck, [], (s, at) => {
    const key = at[at.length - 1]
    // Asset-Pfade stehen in src/poster; Freitext (content, notes, props) wird nicht als Pfad gelesen.
    const isFileRef = key === 'src' || key === 'poster' || key === 'icon'
    if (isFileRef && s.startsWith('assets/') && !existsSync(path.join(dir, s))) {
      issues.push({ path: formatPath(at), message: `Datei fehlt: decks/${name}/${s}` })
    }
    if (isFileRef && s.startsWith('brand/') && !existsSync(path.join(STUDIO_ROOT, s))) {
      issues.push({ path: formatPath(at), message: `Datei fehlt: ${s}` })
    }
    if (tokens && /^brand\./.test(s) && !tokens.has(s.slice(6))) {
      issues.push({
        path: formatPath(at),
        message: `Unbekanntes Brand-Token "${s}". Vorhanden: ${[...tokens].map((t) => `brand.${t}`).join(', ')}`,
      })
    }
  })

  deck.slides.forEach((slide, si) => {
    slide.elements.forEach((el, ei) => {
      if (el.type !== 'custom') return
      const found = ['.tsx', '.mdx'].some((ext) => existsSync(path.join(CUSTOM_DIR, el.component + ext)))
      if (!found) {
        issues.push({
          path: formatPath(['slides', si, 'elements', ei, 'component']),
          message: `Komponente fehlt: custom/${el.component}.tsx`,
        })
      }
    })
  })

  return issues
}

export async function validateDeckValue(name: string, value: unknown): Promise<DeckResult> {
  const parsed = Deck.safeParse(value)
  if (!parsed.success) return { ok: false, issues: fromZod(parsed.error) }
  const issues = await checkDeck(name, parsed.data)
  return issues.length ? { ok: false, issues } : { ok: true, deck: parsed.data }
}

export async function readDeck(name: string): Promise<DeckResult> {
  const file = deckFile(name)
  if (!existsSync(file)) return { ok: false, issues: [{ path: '', message: `decks/${name}/deck.json fehlt` }] }
  const json = parseJson(await readFile(file, 'utf8'))
  if (!json.ok) return json
  return validateDeckValue(name, json.value)
}

export async function summarizeDeck(name: string): Promise<DeckSummary> {
  const result = await readDeck(name)
  if (result.ok) {
    const { deck } = result
    return { name, title: deck.title, slideCount: deck.slides.length, format: deck.format, issues: [] }
  }
  return { name, title: name, slideCount: 0, format: null, issues: result.issues }
}

export function serializeDeck(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n'
}

/** Prüft und schreibt atomar (temp + rename), damit nie eine halbe Datei auf der Platte liegt. */
export async function writeDeck(name: string, value: unknown): Promise<DeckResult & { text?: string }> {
  const result = await validateDeckValue(name, value)
  if (!result.ok) return result
  const file = deckFile(name)
  await mkdir(path.dirname(file), { recursive: true })
  const text = serializeDeck(value)
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, file)
  return { ...result, text }
}
