import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Block } from '../src/schema/block'
import { Deck } from '../src/schema/deck'
import { formatPath, fromZod, type Issue } from '../src/schema/issues'
import { checkDeck, deckFile, isDeckName, listThemeNames, readTheme, serializeDeck, STUDIO_ROOT, TEMPLATES_DIR, walkStrings } from './decks'
import type { Theme } from '../src/schema/theme'

/** Vorlagen und Bausteine dürfen nur Dateien aus dem Brand-Kit nutzen – sie werden in neue Decks kopiert. */
function brandOnly(value: unknown): Issue[] {
  const issues: Issue[] = []
  walkStrings(value, [], (s, at) => {
    const key = at[at.length - 1]
    if (key !== 'src' && key !== 'icon' && key !== 'poster') return
    if (s.startsWith('assets/')) issues.push({ path: formatPath(at), message: 'Vorlagen dürfen nur brand/-Dateien nutzen' })
    if (s.startsWith('brand/') && !existsSync(path.join(STUDIO_ROOT, s))) issues.push({ path: formatPath(at), message: `Datei fehlt: ${s}` })
  })
  return issues
}

async function jsonFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  return (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
}

async function readJson(file: string): Promise<{ ok: true; value: unknown } | { ok: false; issues: Issue[] }> {
  try {
    return { ok: true, value: JSON.parse(await readFile(file, 'utf8')) }
  } catch (err) {
    return { ok: false, issues: [{ path: '', message: `Kein gültiges JSON: ${(err as Error).message}` }] }
  }
}

export async function listThemes(): Promise<{ themes: Theme[]; issues: Issue[] }> {
  const themes: Theme[] = []
  const issues: Issue[] = []
  for (const name of await listThemeNames()) {
    const r = await readTheme(name)
    if (r.ok) themes.push(r.theme)
    else issues.push(...r.issues.map((i) => ({ ...i, path: `${name}.json: ${i.path}` })))
  }
  return { themes, issues }
}

export type BlockEntry = { file: string; block: Block | null; issues: Issue[] }

export async function readBlocks(): Promise<BlockEntry[]> {
  const dir = path.join(TEMPLATES_DIR, 'blocks')
  return Promise.all(
    (await jsonFiles(dir)).map(async (file) => {
      const json = await readJson(path.join(dir, file))
      if (!json.ok) return { file, block: null, issues: json.issues }
      const parsed = Block.safeParse(json.value)
      if (!parsed.success) return { file, block: null, issues: fromZod(parsed.error) }
      const issues = brandOnly(parsed.data)
      if (parsed.data.name !== file.slice(0, -5)) issues.push({ path: 'name', message: `name muss dem Dateinamen entsprechen ("${file.slice(0, -5)}")` })
      return { file, block: issues.length ? null : parsed.data, issues }
    }),
  )
}

export type DeckTemplate = { name: string; deck: Deck }
export type TemplateEntry = { file: string; template: DeckTemplate | null; issues: Issue[] }

/** Komplette Deck-Vorlagen: templates/decks/<name>.json – ein gültiges Deck, nur mit brand/-Dateien. */
export async function readDeckTemplates(): Promise<TemplateEntry[]> {
  const dir = path.join(TEMPLATES_DIR, 'decks')
  return Promise.all(
    (await jsonFiles(dir)).map(async (file) => {
      const json = await readJson(path.join(dir, file))
      if (!json.ok) return { file, template: null, issues: json.issues }
      const parsed = Deck.safeParse(json.value)
      if (!parsed.success) return { file, template: null, issues: fromZod(parsed.error) }
      const issues = [...brandOnly(parsed.data), ...(await checkDeck('_vorlage', parsed.data))]
      return { file, template: issues.length ? null : { name: file.slice(0, -5), deck: parsed.data }, issues }
    }),
  )
}

export type CreateResult = { ok: true; name: string } | { ok: false; issues: Issue[] }

/** Legt ein neues Deck an – nie über ein bestehendes. */
export async function createDeck(name: string, value: unknown): Promise<CreateResult> {
  if (!isDeckName(name)) return { ok: false, issues: [{ path: '', message: `Ungültiger Deck-Name: ${name}` }] }
  const file = deckFile(name)
  if (existsSync(file)) return { ok: false, issues: [{ path: '', message: `Deck „${name}“ gibt es schon` }] }
  const parsed = Deck.safeParse(value)
  if (!parsed.success) return { ok: false, issues: fromZod(parsed.error) }
  const issues = await checkDeck(name, parsed.data)
  if (issues.length) return { ok: false, issues }
  await mkdir(path.join(path.dirname(file), 'assets'), { recursive: true })
  await writeFile(file, serializeDeck(value), { encoding: 'utf8', flag: 'wx' })
  return { ok: true, name }
}
