import { z } from 'zod'
import type { CustomProps } from '../src/engine/customTypes'

/**
 * Beispiel für eine eigene Komponente: ein Filmstreifen mit Perforation, der langsam durchläuft.
 * Verwendung in der deck.json:
 *   { "type": "custom", "component": "FilmStrip", "props": { "images": ["assets/a.jpg"], "speed": 0.5 }, ... }
 */

export const schema = z.strictObject({
  /** Bilder für die Kader (assets/… oder brand/…). Ohne Bilder: leere Kader. */
  images: z.array(z.string()).optional(),
  /** Anzahl sichtbarer Kader. */
  frames: z.number().int().min(2).max(12).optional(),
  /** Laufgeschwindigkeit, 0 = steht. */
  speed: z.number().min(0).max(4).optional(),
  /** Farbe des Filmmaterials. */
  color: z.string().optional(),
})

export const meta = { label: 'Filmstreifen', description: 'Laufender Filmstreifen mit Perforation' }

type Props = z.infer<typeof schema>

export default function FilmStrip({ props, mode, width, height, assetUrl }: CustomProps<Props>) {
  const frames = props.frames ?? 5
  const images = props.images ?? []
  const speed = props.speed ?? 0.5
  const holeRow = height * 0.14
  const frameH = height - holeRow * 2
  const frameW = width / frames
  const animate = speed > 0 && (mode === 'view' || mode === 'present')
  // Doppelte Reihe, damit der Lauf nahtlos wiederholt.
  const cells = Array.from({ length: frames * 2 }, (_, i) => images.length ? images[i % images.length] : undefined)
  const holes = Array.from({ length: frames * 2 * 4 }, (_, i) => i)

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: props.color ?? 'var(--brand-ink, #111)' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: width * 2,
          display: 'flex',
          flexDirection: 'column',
          animation: animate ? `filmstrip-run ${12 / speed}s linear infinite` : undefined,
        }}
      >
        <HoleRow holes={holes} height={holeRow} />
        <div style={{ display: 'flex', height: frameH }}>
          {cells.map((src, i) => (
            <div key={i} style={{ width: frameW, height: frameH, padding: `0 ${frameW * 0.04}px`, flex: 'none' }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: frameW * 0.02,
                  background: src ? `center / cover url("${assetUrl(src)}")` : 'var(--brand-surface, #222)',
                  filter: 'grayscale(1) contrast(1.05)',
                }}
              />
            </div>
          ))}
        </div>
        <HoleRow holes={holes} height={holeRow} />
      </div>
      <style>{`@keyframes filmstrip-run { to { transform: translateX(-${width}px); } }`}</style>
    </div>
  )
}

function HoleRow({ holes, height }: { holes: number[]; height: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height }}>
      {holes.map((i) => (
        <span
          key={i}
          style={{ width: height * 0.55, height: height * 0.45, borderRadius: height * 0.1, background: 'var(--brand-light, #eee)', opacity: 0.85 }}
        />
      ))}
    </div>
  )
}
