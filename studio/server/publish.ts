import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { build, type Plugin } from 'vite'
import type { Issue } from '../src/schema/issues'
import type { Theme } from '../src/schema/theme'
import { BRAND_DIR, DECKS_DIR, readBrand, readDeck, readTheme, STUDIO_ROOT } from './decks'

/**
 * Web-Player bauen: eigenständiger Ordner published/<deck>/ mit index.html, App-Code (nur Abspielen),
 * eingebautem Deck/Brand-Kit/Theme und allen benutzten Medien. Läuft auf jedem statischen Hosting
 * (Netlify, Vercel, GitHub Pages) und in jedem Unterordner, weil alle Pfade relativ sind.
 */
export const PUBLISHED_DIR = path.join(STUDIO_ROOT, 'published')

export type PublishResult =
  | { ok: true; dir: string; files: number; bytes: number }
  | { ok: false; issues: Issue[] }

const VIRTUAL = 'virtual:studio-bundle'

/** Stellt das Deck als Modul `virtual:studio-bundle` bereit und setzt den Seitentitel. */
function bundlePlugin(data: unknown, title: string): Plugin {
  return {
    name: 'studio-bundle',
    resolveId: (id) => (id === VIRTUAL ? '\0' + VIRTUAL : null),
    load: (id) => (id === '\0' + VIRTUAL ? `export default ${JSON.stringify(data)}` : null),
    transformIndexHtml: (html) => html.replaceAll('%STUDIO_TITLE%', escapeHtml(title)),
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** Alle Datei-Verweise im Deck ("assets/…", "brand/…") – auch in props eigener Komponenten. */
function referencedFiles(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (/^(assets|brand)\/[^\s]+$/.test(value)) out.add(value)
  } else if (Array.isArray(value)) value.forEach((v) => referencedFiles(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => referencedFiles(v, out))
  return out
}

/** Pfad im Deck-/Brand-Ordner – null, wenn er hinausführt oder die Datei fehlt. */
function sourceOf(name: string, ref: string): string | null {
  const base = ref.startsWith('brand/') ? BRAND_DIR : path.join(DECKS_DIR, name)
  const file = path.resolve(ref.startsWith('brand/') ? STUDIO_ROOT : base, ref)
  if (path.relative(base, file).startsWith('..')) return null
  return existsSync(file) ? file : null
}

async function folderSize(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0
  let bytes = 0
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue
    files += 1
    bytes += (await stat(path.join(entry.parentPath, entry.name))).size
  }
  return { files, bytes }
}

export async function publishDeck(name: string, outDir = path.join(PUBLISHED_DIR, name)): Promise<PublishResult> {
  const deck = await readDeck(name)
  if (!deck.ok) return deck
  const brand = await readBrand()
  if (!brand.ok) return brand
  let theme: Theme | null = null
  if (deck.deck.theme) {
    const t = await readTheme(deck.deck.theme)
    if (!t.ok) return t
    theme = t.theme
  }

  await rm(outDir, { recursive: true, force: true })
  await build({
    configFile: false,
    root: STUDIO_ROOT,
    base: './',
    logLevel: 'warn',
    publicDir: false,
    plugins: [react(), bundlePlugin({ name, deck: deck.deck, brand: brand.brand, theme }, deck.deck.title)],
    build: {
      outDir,
      emptyOutDir: true,
      assetsDir: 'app',
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: path.join(STUDIO_ROOT, 'player.html') },
    },
  })
  await rename(path.join(outDir, 'player.html'), path.join(outDir, 'index.html'))

  // Medien: was das Deck benutzt, plus die Schriftdateien des Brand-Kits.
  const refs = referencedFiles(deck.deck)
  const { fonts } = brand.brand
  for (const font of [fonts.display, fonts.text, fonts.mono]) font?.files?.forEach((f) => refs.add(`brand/${f.src}`))
  for (const ref of refs) {
    const src = sourceOf(name, ref)
    if (!src) continue
    const dest = path.join(outDir, ref.startsWith('brand/') ? ref : path.join('decks', name, ref))
    await mkdir(path.dirname(dest), { recursive: true })
    await copyFile(src, dest)
  }
  // GitHub Pages soll Ordner mit Unterstrich nicht ausfiltern.
  await writeFile(path.join(outDir, '.nojekyll'), '')

  return { ok: true, dir: outDir, ...(await folderSize(outDir)) }
}
