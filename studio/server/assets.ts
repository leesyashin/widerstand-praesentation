import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import path from 'node:path'
import { Brand } from '../src/schema/brand'
import { fromZod, type Issue } from '../src/schema/issues'
import { BRAND_DIR, BRAND_FILE, DECKS_DIR, readBrand } from './decks'

/** Medien: Bilder, Videos, Lottie, SVG. Große Dateien landen nicht im Speicher, sondern direkt auf der Platte. */
export const MAX_UPLOAD = 100 * 1024 * 1024

const MEDIA_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'mp4', 'webm', 'mov', 'm4v', 'json'])
const FONT_EXT = new Set(['woff2', 'woff', 'otf', 'ttf'])

export type AssetKind = 'image' | 'video' | 'lottie' | 'other'
export type AssetInfo = { path: string; size: number; kind: AssetKind }

export function assetKind(file: string): AssetKind {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  if (ext === 'json') return 'lottie'
  return 'other'
}

/** "Mein Foto (1).JPG" → "mein-foto-1.jpg" – nur sichere Zeichen, Endung klein. */
export function cleanFileName(name: string): string | null {
  const base = path.basename(name)
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

function uniqueFile(dir: string, file: string): string {
  if (!existsSync(path.join(dir, file))) return file
  const dot = file.lastIndexOf('.')
  for (let n = 2; ; n++) {
    const candidate = `${file.slice(0, dot)}-${n}${file.slice(dot)}`
    if (!existsSync(path.join(dir, candidate))) return candidate
  }
}

async function walk(dir: string, rel = ''): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.tmp')) continue
    const r = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...(await walk(path.join(dir, entry.name), r)))
    else out.push(r)
  }
  return out
}

export async function listAssets(deck: string): Promise<AssetInfo[]> {
  const dir = path.join(DECKS_DIR, deck, 'assets')
  const files = await walk(dir)
  const infos = await Promise.all(
    files.map(async (f) => ({ path: `assets/${f}`, size: (await stat(path.join(dir, f))).size, kind: assetKind(f) })),
  )
  return infos.sort((a, b) => a.path.localeCompare(b.path))
}

/** Dateien des Brand-Kits, die sich als Medien eignen (Logo, Platzhalter, Bilder). */
export async function listBrandAssets(): Promise<AssetInfo[]> {
  const files = (await walk(BRAND_DIR)).filter((f) => !f.startsWith('fonts/') && assetKind(f) === 'image')
  return Promise.all(files.map(async (f) => ({ path: `brand/${f}`, size: (await stat(path.join(BRAND_DIR, f))).size, kind: 'image' as const })))
}

/** Schreibt den Anfrage-Body als Datenstrom in eine Datei (atomar über .tmp). */
function streamToFile(req: IncomingMessage, file: string, limit: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tmp = `${file}.${process.pid}.tmp`
    const out = createWriteStream(tmp)
    let size = 0
    let failed = false
    const fail = (err: Error) => {
      if (failed) return
      failed = true
      out.destroy()
      void rm(tmp, { force: true }).finally(() => reject(err))
    }
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        fail(new Error(`Datei zu groß (max. ${Math.round(limit / 1024 / 1024)} MB) – bitte eine optimierte Web-Version nutzen`))
        req.destroy()
      }
    })
    req.on('error', fail)
    out.on('error', fail)
    out.on('finish', () => {
      if (failed) return
      if (size === 0) return fail(new Error('Leere Datei'))
      rename(tmp, file).then(() => resolve(size), fail)
    })
    req.pipe(out)
  })
}

export type UploadResult = { ok: true; path: string; size: number } | { ok: false; issues: Issue[] }

const problem = (message: string): UploadResult => ({ ok: false, issues: [{ path: '', message }] })

export async function uploadAsset(deck: string, name: string, req: IncomingMessage): Promise<UploadResult> {
  const clean = cleanFileName(name)
  const ext = clean?.split('.').pop() ?? ''
  if (!clean || !MEDIA_EXT.has(ext)) return problem(`Dateityp nicht unterstützt: ${name}. Erlaubt: ${[...MEDIA_EXT].join(', ')}`)
  const dir = path.join(DECKS_DIR, deck, 'assets')
  await mkdir(dir, { recursive: true })
  const file = uniqueFile(dir, clean)
  try {
    const size = await streamToFile(req, path.join(dir, file), MAX_UPLOAD)
    return { ok: true, path: `assets/${file}`, size }
  } catch (err) {
    return problem((err as Error).message)
  }
}

export async function deleteAsset(deck: string, rel: string): Promise<UploadResult> {
  if (!/^assets\/[^\s]+$/.test(rel) || rel.split('/').includes('..')) return problem(`Ungültiger Pfad: ${rel}`)
  const file = path.join(DECKS_DIR, deck, rel)
  if (!existsSync(file)) return problem(`Datei fehlt: ${rel}`)
  await rm(file)
  return { ok: true, path: rel, size: 0 }
}

export async function uploadFont(name: string, req: IncomingMessage): Promise<UploadResult> {
  const base = path.basename(name)
  const ext = base.split('.').pop()?.toLowerCase() ?? ''
  // Schriftnamen behalten ihre Schreibweise (MeineSchrift-Bold.woff2), nur unsichere Zeichen fliegen raus.
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, '-')
  if (!FONT_EXT.has(ext)) return problem(`Schriftformat nicht unterstützt: ${name}. Erlaubt: ${[...FONT_EXT].join(', ')}`)
  const dir = path.join(BRAND_DIR, 'fonts')
  await mkdir(dir, { recursive: true })
  const file = uniqueFile(dir, clean)
  try {
    const size = await streamToFile(req, path.join(dir, file), 20 * 1024 * 1024)
    return { ok: true, path: `fonts/${file}`, size }
  } catch (err) {
    return problem((err as Error).message)
  }
}

/** Prüft und schreibt brand/brand.json (atomar). */
export async function writeBrand(value: unknown): Promise<{ ok: true; brand: Brand } | { ok: false; issues: Issue[] }> {
  const parsed = Brand.safeParse(value)
  if (!parsed.success) return { ok: false, issues: fromZod(parsed.error) }
  const tmp = `${BRAND_FILE}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8')
  await rename(tmp, BRAND_FILE)
  const check = await readBrand()
  return check.ok ? { ok: true, brand: check.brand } : { ok: false, issues: check.issues }
}
