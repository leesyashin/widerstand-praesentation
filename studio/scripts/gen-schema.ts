// Erzeugt die JSON-Schemas aus den Zod-Schemas. Mit --check: nur prüfen, ob sie aktuell sind.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { STUDIO_ROOT } from '../server/decks'
import { Block } from '../src/schema/block'
import { Brand } from '../src/schema/brand'
import { Deck } from '../src/schema/deck'
import { Layout } from '../src/schema/layout'
import { Theme } from '../src/schema/theme'

const targets = [
  { file: 'src/schema/deck.schema.json', schema: Deck, title: 'Studio Deck' },
  { file: 'src/schema/brand.schema.json', schema: Brand, title: 'Studio Brand-Kit' },
  { file: 'src/schema/theme.schema.json', schema: Theme, title: 'Studio Theme' },
  { file: 'src/schema/layout.schema.json', schema: Layout, title: 'Studio Layout' },
  { file: 'src/schema/block.schema.json', schema: Block, title: 'Studio Baustein' },
]

const check = process.argv.includes('--check')
let stale = false

for (const t of targets) {
  const json = { title: t.title, ...z.toJSONSchema(t.schema, { io: 'input', target: 'draft-2020-12' }) }
  const text = JSON.stringify(json, null, 2) + '\n'
  const file = path.join(STUDIO_ROOT, t.file)
  const current = await readFile(file, 'utf8').catch(() => '')
  if (current === text) continue
  if (check) {
    console.error(`✗ ${t.file} ist veraltet – bitte "npm run schema" ausführen`)
    stale = true
  } else {
    await writeFile(file, text)
    console.log(`✓ ${t.file} geschrieben`)
  }
}

if (stale) process.exit(1)
if (check) console.log('✓ JSON-Schemas sind aktuell')
