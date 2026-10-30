// Prüft Brand-Kit und Decks: Schema, Dateien, Brand-Tokens, eigene Komponenten.
// Aufruf: npm run validate            → alle Decks
//         npm run validate -- <name>  → nur ein Deck
import { listDeckNames, readBrand, readDeck } from '../server/decks'

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
let failed = false

const brand = await readBrand()
if (brand.ok) console.log('✓ brand/brand.json')
else {
  failed = true
  console.error('✗ brand/brand.json')
  for (const i of brand.issues) console.error(`    ${i.path || '(Datei)'}: ${i.message}`)
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
