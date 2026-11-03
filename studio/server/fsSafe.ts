import { randomBytes } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'

/**
 * Dateizugriffe, die auch unter Windows halten:
 * - Virenscanner, OneDrive oder ein offener Editor sperren Dateien kurz – `rename` scheitert dann mit EPERM/EBUSY.
 *   Deshalb ein paar Versuche mit kurzer Pause.
 * - Jede Schreibaktion bekommt eine eigene Temp-Datei, damit zwei gleichzeitige Speichervorgänge sich nicht stören.
 */

const RETRY = new Set(['EPERM', 'EACCES', 'EBUSY'])

export function tempName(file: string): string {
  return `${file}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`
}

export async function renameRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? ''
      if (!RETRY.has(code) || attempt >= 6) {
        await rm(from, { force: true }).catch(() => {})
        throw err
      }
      await new Promise((r) => setTimeout(r, 40 * 2 ** attempt))
    }
  }
}

/** Atomar schreiben: erst Temp-Datei, dann umbenennen – nie eine halbe Datei auf der Platte. */
export async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const tmp = tempName(file)
  await writeFile(tmp, data)
  await renameRetry(tmp, file)
}

/** Windows-Editoren (Notepad, PowerShell 5) schreiben gern ein BOM vor UTF-8 – JSON.parse mag das nicht. */
export function parseJsonText(text: string): unknown {
  return JSON.parse(text.replace(/^\uFEFF/, ''))
}
