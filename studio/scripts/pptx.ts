// Exportiert Decks als PowerPoint: Text, Bilder, Formen, Videos und Notizen als echte Objekte,
// Effekte/Verläufe/Icons/Charts als Bilder. Animationen gehen verloren (Grenze des Formats).
// Aufruf: npm run pptx -- <deck>   → exports/<deck>.pptx
//         npm run pptx             → alle Decks
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { launchBrowser } from '../server/browser'
import { listDeckNames, STUDIO_ROOT } from '../server/decks'
import { exportPptx, EXPORTS_DIR } from '../server/pptx'

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const server = await createServer({ root: STUDIO_ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } })
await server.listen()
const address = server.httpServer?.address()
const port = typeof address === 'object' && address ? address.port : 5173
const browser = await launchBrowser()
let failed = false

try {
  await mkdir(EXPORTS_DIR, { recursive: true })
  for (const name of only.length ? only : await listDeckNames()) {
    const result = await exportPptx(name, `http://127.0.0.1:${port}`, browser)
    if (!result.ok) {
      failed = true
      console.error(`✗ decks/${name}:`)
      for (const issue of result.issues) console.error(`  ${issue.path || '(Datei)'}: ${issue.message}`)
      continue
    }
    const file = path.join(EXPORTS_DIR, `${name}.pptx`)
    await writeFile(file, result.buffer)
    const mb = (result.buffer.length / 1024 / 1024).toFixed(1)
    console.log(`✓ ${path.relative(STUDIO_ROOT, file)}  ·  ${result.slides} Folien, ${result.images} Bilder, ${mb} MB`)
  }
} finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)
