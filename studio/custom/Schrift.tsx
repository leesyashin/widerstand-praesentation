import { z } from 'zod'
import type { CustomProps } from '../src/engine/customTypes'

/**
 * Text in einer eigenen Schrift aus dem Deck-Ordner (z. B. eine Antiqua für Zitate oder Jahreszahlen).
 * Die Zeichen liegen wie bei normalem Text als `.w` › `.c` – deshalb funktionieren die Buchstaben-Builds
 * (`charByChar`, `typewriter`, `scramble`) auch hier.
 *
 *   { "type": "custom", "component": "Schrift",
 *     "props": { "text": "1789", "font": "assets/fonts/BodoniModa.woff2", "size": 320, "color": "brand.accent" } }
 */

const token = z.string().optional()

export const schema = z.strictObject({
  /** Inhalt, Zeilen mit \n. `*kursiv*` innerhalb einer Zeile ist erlaubt. */
  text: z.string().min(1),
  /** Schriftdatei (woff2) im Deck: "assets/fonts/…". */
  font: z.string().regex(/^(assets|brand)\/[^\s]+\.(woff2|woff|otf|ttf)$/),
  /** Schrift für *kursive* Stellen (optional, sonst künstlich schräg). */
  italicFont: z.string().regex(/^(assets|brand)\/[^\s]+\.(woff2|woff|otf|ttf)$/).optional(),
  size: z.number().positive(),
  weight: z.number().int().min(100).max(900).optional(),
  italic: z.boolean().optional(),
  /** Brand-Token ("brand.accent") oder CSS-Farbe. */
  color: token,
  align: z.enum(['left', 'center', 'right']).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  lineHeight: z.number().positive().optional(),
  /** In em. */
  letterSpacing: z.number().optional(),
  uppercase: z.boolean().optional(),
  /** Optische Größe variabler Schriften (z. B. Bodoni Moda 6–96). Klein = kräftigere Haarlinien. */
  opsz: z.number().min(1).max(200).optional(),
  /** Weicher Lichtschein in der Textfarbe (0–1). */
  glow: z.number().min(0).max(1).optional(),
})

export const meta = { label: 'Schrift', description: 'Text in einer eigenen Schrift aus dem Deck (Antiqua, Schreibschrift …)' }

type Props = z.infer<typeof schema>

const familyOf = (src: string) => 'deck-' + src.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9]+/g, '-')

const cssColor = (c?: string) => {
  if (!c) return 'var(--brand-text)'
  if (c.startsWith('brand.')) return `var(--brand-${c.slice(6)})`
  return c
}

/** Zerlegt eine Zeile in Abschnitte normal/kursiv (`*…*`). */
function segments(line: string): { text: string; italic: boolean }[] {
  const out: { text: string; italic: boolean }[] = []
  const re = /\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), italic: false })
    out.push({ text: m[1] ?? '', italic: true })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), italic: false })
  return out
}

export default function Schrift({ props, assetUrl }: CustomProps<Props>) {
  const family = familyOf(props.font)
  const italicFamily = props.italicFont ? familyOf(props.italicFont) : undefined
  const color = cssColor(props.color)
  const glow = props.glow ?? 0
  const lines = props.text.split('\n')
  const faces = [
    `@font-face { font-family: '${family}'; src: url("${assetUrl(props.font)}"); font-weight: 100 900; font-display: block; }`,
    props.italicFont
      ? `@font-face { font-family: '${italicFamily}'; src: url("${assetUrl(props.italicFont)}"); font-weight: 100 900; font-style: italic; font-display: block; }`
      : '',
  ].join('\n')
  const justify = props.verticalAlign === 'top' ? 'flex-start' : props.verticalAlign === 'bottom' ? 'flex-end' : 'center'

  let key = 0
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        textAlign: props.align ?? 'left',
        fontFamily: `'${family}', Georgia, 'Times New Roman', serif`,
        fontSize: props.size,
        fontWeight: props.weight ?? 400,
        fontStyle: props.italic ? 'italic' : 'normal',
        fontOpticalSizing: props.opsz ? 'none' : 'auto',
        fontVariationSettings: props.opsz ? `"opsz" ${props.opsz}` : undefined,
        lineHeight: props.lineHeight ?? 1.05,
        letterSpacing: `${props.letterSpacing ?? 0}em`,
        textTransform: props.uppercase ? 'uppercase' : 'none',
        color,
        textShadow: glow ? `0 0 ${Math.round(props.size * 0.35 * glow)}px ${color}` : undefined,
        fontKerning: 'normal',
        fontFeatureSettings: '"liga" 1, "kern" 1',
      }}
    >
      <style>{faces}</style>
      {lines.map((line, li) => (
        <div key={li} className="l" style={{ whiteSpace: 'pre-wrap' }}>
          {line.length === 0 ? ' ' : null}
          {segments(line).map((seg) =>
            seg.text.split(/(\s+)/).map((word) => {
              if (!word) return null
              if (/^\s+$/.test(word)) return <span key={key++}>{word}</span>
              return (
                <span
                  key={key++}
                  className="w"
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    fontStyle: seg.italic ? 'italic' : undefined,
                    fontFamily: seg.italic && italicFamily ? `'${italicFamily}', Georgia, serif` : undefined,
                  }}
                >
                  {[...word].map((ch) => (
                    <span key={key++} className="c" data-ch={ch} style={{ display: 'inline-block' }}>
                      {ch}
                    </span>
                  ))}
                </span>
              )
            }),
          )}
        </div>
      ))}
    </div>
  )
}
