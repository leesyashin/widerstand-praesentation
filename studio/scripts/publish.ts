// Baut den Web-Player eines Decks: eigenständiger Ordner zum Hochladen (nur Ansehen, mit allen Animationen).
// Aufruf: npm run publish -- <deck>            → published/<deck>/
//         npm run publish -- <deck> --preview  → danach lokal ansehen (http://localhost:4173)
import path from 'node:path'
import { preview } from 'vite'
import { STUDIO_ROOT } from '../server/decks'
import { publishDeck } from '../server/publish'

const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('-'))
if (!name) {
  console.error('Aufruf: npm run publish -- <deck> [--preview]')
  process.exit(1)
}

const result = await publishDeck(name)
if (!result.ok) {
  console.error(`✗ decks/${name} lässt sich nicht veröffentlichen:`)
  for (const issue of result.issues) console.error(`  ${issue.path || '(Datei)'}: ${issue.message}`)
  process.exit(1)
}

const rel = path.relative(STUDIO_ROOT, result.dir)
console.log(`✓ ${rel}/  ·  ${result.files} Dateien, ${(result.bytes / 1024 / 1024).toFixed(1)} MB`)
console.log(`
So wird daraus ein Link:
  · Netlify Drop: Ordner ${rel} auf https://app.netlify.com/drop ziehen (Passwortschutz in den Site-Einstellungen)
  · Vercel:       npx vercel deploy ${rel} --prod
  · GitHub Pages: Inhalt von ${rel} in einen Pages-Branch legen
Startfolie per Link: …/index.html#<folien-id>`)

if (args.includes('--preview')) {
  const server = await preview({
    configFile: false,
    root: STUDIO_ROOT,
    base: './',
    build: { outDir: result.dir },
    preview: { port: 4173, open: true },
  })
  server.printUrls()
}
