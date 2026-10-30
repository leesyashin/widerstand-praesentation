// Prüft Brand-Kit und Decks: Schema, Dateien, Brand-Tokens, eigene Komponenten.
// Aufruf: npm run validate            → alle Decks
//         npm run validate -- <name>  → nur ein Deck
import { listDeckNames, listThemeNames, readBrand, readDeck, readLayouts, readTheme } from '../server/decks'
import { readBlocks, readDeckTemplates } from '../server/templates'

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
let failed = false

const brand = await readBrand()
if (brand.ok) console.log('✓ brand/brand.json')
else {
  failed = true
  console.error('✗ brand/brand.json')
  for (const i of brand.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
}

for (const name of await listThemeNames()) {
  const theme = await readTheme(name)
  if (theme.ok) console.log(`✓ templates/themes/${name}.json`)
  else {
    failed = true
    console.error(`✗ templates/themes/${name}.json`)
    for (const i of theme.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
  }
}

const layouts = await readLayouts()
const badLayouts = layouts.filter((l) => l.issues.length)
if (!badLayouts.length) console.log(`✓ templates/layouts  ·  ${layouts.length} Layouts`)
for (const l of badLayouts) {
  failed = true
  console.error(`✗ templates/layouts/${l.file}`)
  for (const i of l.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
}

const blocks = await readBlocks()
const badBlocks = blocks.filter((b) => b.issues.length)
if (!badBlocks.length) console.log(`✓ templates/blocks  ·  ${blocks.length} Bausteine`)
for (const b of badBlocks) {
  failed = true
  console.error(`✗ templates/blocks/${b.file}`)
  for (const i of b.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
}

const templates = await readDeckTemplates()
const badTemplates = templates.filter((t) => t.issues.length)
if (!badTemplates.length) console.log(`✓ templates/decks  ·  ${templates.length} Vorlagen`)
for (const t of badTemplates) {
  failed = true
  console.error(`✗ templates/decks/${t.file}`)
  for (const i of t.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
}

const names = only.length ? only : await listDeckNames()
if (!names.length) console.log('  (keine Decks in decks/)')

for (const name of names) {
  const result = await readDeck(name)
  if (result.ok) {
    console.log(`✓ decks/${name}  ·  ${result.deck.slides.length} Folien  ·  ${result.deck.format.preset}`)
  } else {
    failed = true
    console.error(`✗ decks/${name}`)
    for (const i of result.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
  }
}

process.exit(failed ? 1 : 0)
