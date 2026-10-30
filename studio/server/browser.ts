import { existsSync } from 'node:fs'

/** Chromium für Screenshots und Export (Playwright). */
export async function launchBrowser() {
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
