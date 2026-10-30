// Rendert Folien als PNG, damit Claude (und du) das Ergebnis sehen können.
// Aufruf: npm run shots                  → alle Decks, Endzustand jeder Folie
//         npm run shots -- <deck>        → nur ein Deck
//         npm run shots -- <deck> --steps → zusätzlich den Stand nach jedem Klick
// Ausgabe: shots/<deck>/<nr>-<folie>.png (Endzustand), <nr>-<folie>-klick-<n>.png (nach n Klicks)
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { listDeckNames, readDeck, STUDIO_ROOT } from '../server/decks'

const args = process.argv.slice(2)
const withSteps = args.includes('--steps')
const only = args.filter((a) => !a.startsWith('-'))

async function launchBrowser() {
  const { chromium } = await import('playwright')
  try {
    return await chromium.launch()
  } catch (err) {
    // Vorinstallierter Browser in Cloud-Umgebungen
    const fallback = '/opt/pw-browsers/chromium'
    if (existsSync(fallback)) return chromium.launch({ executablePath: fallback })
    console.error('Chromium fehlt. Einmalig ausführen: npx playwright install chromium')
    throw err
  }
}

const server = await createServer({ root: STUDIO_ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } })
await server.listen()
const address = server.httpServer?.address()
const port = typeof address === 'object' && address ? address.port : 5173
const browser = await launchBrowser()
let failed = false

try {
  const names = only.length ? only : await listDeckNames()
  for (const name of names) {
    const result = await readDeck(name)
    if (!result.ok) {
      failed = true
      console.error(`✗ decks/${name} ist ungültig – erst "npm run validate -- ${name}"`)
      continue
    }
    const { deck } = result
    const page = await browser.newPage({ viewport: { width: deck.format.width, height: deck.format.height } })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const outDir = path.join(STUDIO_ROOT, 'shots', name)
    await rm(outDir, { recursive: true, force: true })
    await mkdir(outDir, { recursive: true })

    const shoot = async (slideId: string, file: string, step?: number) => {
      const hash = `#/render/${encodeURIComponent(name)}/${encodeURIComponent(slideId)}${step === undefined ? '' : `/${step}`}`
      await page.goto(`http://127.0.0.1:${port}/${hash}`)
      await page.waitForSelector('body[data-ready="1"]', { timeout: 15000 })
      await page.screenshot({ path: path.join(outDir, file) })
      return Number(await page.evaluate(() => (globalThis as unknown as { document: { body: { dataset: Record<string, string> } } }).document.body.dataset.steps ?? '1'))
    }

    for (const [i, slide] of deck.slides.entries()) {
      const nr = String(i + 1).padStart(2, '0')
      const steps = await shoot(slide.id, `${nr}-${slide.id}.png`)
      if (withSteps && steps > 1) {
        // Schritt 0 läuft automatisch beim Betreten; danach je ein Klick.
        for (let s = 0; s < steps - 1; s++) await shoot(slide.id, `${nr}-${slide.id}-klick-${s}.png`, s)
      }
    }
    await page.close()
    console.log(`✓ shots/${name}/  ·  ${deck.slides.length} Folien`)
  }
} finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)
