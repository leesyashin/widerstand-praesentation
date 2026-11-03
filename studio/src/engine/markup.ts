/**
 * Inline-Markup der Text-Elemente – eine Quelle für Folie, Editor und PowerPoint-Export.
 *   **fett**   *kursiv*   ***fett und kursiv***   \n = Zeilenumbruch
 * Markierungen gelten nur innerhalb einer Zeile.
 */

export type Span = { text: string; bold: boolean; italic: boolean }

const MARKUP = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g

/** Eine Zeile (ohne \n) in Abschnitte mit Auszeichnung zerlegen. */
export function parseLine(line: string): Span[] {
  const out: Span[] = []
  let last = 0
  for (const m of line.matchAll(MARKUP)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false, italic: false })
    if (m[1] !== undefined) out.push({ text: m[1], bold: true, italic: true })
    else if (m[2] !== undefined) out.push({ text: m[2], bold: true, italic: false })
    else out.push({ text: m[3] ?? '', bold: false, italic: true })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false, italic: false })
  return out
}

/** Ganzer Text als Zeilen von Abschnitten. */
export function parseMarkup(content: string): Span[][] {
  return content.split('\n').map(parseLine)
}

/** Abschnitte zurück in Markup. Leerzeichen am Rand wandern aus den Markierungen heraus. */
export function serializeMarkup(lines: Span[][]): string {
  return lines
    .map((spans) => {
      // Gleich ausgezeichnete Nachbarn zusammenfassen.
      const merged: Span[] = []
      for (const s of spans) {
        if (!s.text) continue
        const prev = merged[merged.length - 1]
        if (prev && prev.bold === s.bold && prev.italic === s.italic) prev.text += s.text
        else merged.push({ ...s })
      }
      return merged
        .map((s) => {
          if (!s.bold && !s.italic) return s.text
          const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text)!
          const [, lead = '', core = '', trail = ''] = m
          if (!core) return s.text
          const mark = s.bold && s.italic ? '***' : s.bold ? '**' : '*'
          return `${lead}${mark}${core}${mark}${trail}`
        })
        .join('')
    })
    .join('\n')
}

/** Reiner Text ohne Markierungen (für Namen in Listen, Vorschauen). */
export function plainText(content: string): string {
  return parseMarkup(content)
    .map((l) => l.map((s) => s.text).join(''))
    .join('\n')
}
