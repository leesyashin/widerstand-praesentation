import type { Draft } from 'immer'
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { WORLD_SPACING, worldOf } from '../engine/world'
import type { Deck, World } from '../schema/deck'

type Props = {
  deck: Deck
  deckName: string
  current: number
  edit: (recipe: (draft: Draft<Deck>) => void, merge?: string) => void
  onSelect: (slideId: string) => void
  onClose: () => void
}

/**
 * Raum-Ansicht: alle Folien an ihren Raum-Positionen. Ziehen verschiebt eine Folie,
 * die Linie zeigt den Weg der Kamera in Abspielreihenfolge.
 */
export function SpaceView({ deck, deckName, current, edit, onSelect, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const drag = useRef<{ index: number; x: number; y: number; world: Required<World>; moved: boolean } | null>(null)
  const W = deck.format.width
  const H = deck.format.height

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const worlds = deck.slides.map((s, i) => worldOf(s, i, deck))
  const pad = W * 0.6
  const minX = Math.min(...worlds.map((w) => w.x - (W * w.scale) / 2)) - pad
  const maxX = Math.max(...worlds.map((w) => w.x + (W * w.scale) / 2)) + pad
  const minY = Math.min(...worlds.map((w) => w.y - (H * w.scale) / 2)) - pad
  const maxY = Math.max(...worlds.map((w) => w.y + (H * w.scale) / 2)) + pad
  const k = Math.min(size.w / (maxX - minX), size.h / (maxY - minY))
  const ox = (size.w - (maxX - minX) * k) / 2
  const oy = (size.h - (maxY - minY) * k) / 2
  // Raum-Koordinate = Mittelpunkt der Folie → Bildschirm
  const toScreen = (x: number, y: number) => ({ left: ox + (x - minX) * k, top: oy + (y - minY) * k })

  /** Alle Folien bekommen feste Positionen, damit sich beim Verschieben einer Folie keine andere mitbewegt. */
  const materialize = (d: Draft<Deck>) => {
    d.slides.forEach((s, i) => {
      if (!s.world) s.world = { ...worldOf(s as Deck['slides'][number], i, deck) }
    })
  }

  const arrange = (kind: 'line' | 'grid' | 'circle') =>
    edit((d) => {
      const n = d.slides.length
      const cols = Math.ceil(Math.sqrt(n))
      const radius = Math.max(W, (n * W * WORLD_SPACING) / (2 * Math.PI))
      d.slides.forEach((s, i) => {
        if (kind === 'line') s.world = { x: i * W * WORLD_SPACING, y: 0 }
        if (kind === 'grid') s.world = { x: (i % cols) * W * WORLD_SPACING, y: Math.floor(i / cols) * H * 1.35 }
        if (kind === 'circle') {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2
          // Ohne Drehung: ruhiger Flug im Kreis (Drehung pro Folie bleibt im Inspector möglich).
          s.world = { x: Math.round(Math.cos(a) * radius), y: Math.round(Math.sin(a) * radius) }
        }
      })
    })

  const allCamera = () =>
    edit((d) => {
      d.slides.forEach((s, i) => {
        if (i > 0) s.transition = { type: 'camera' }
      })
    })

  const onPointerDown = (e: ReactPointerEvent, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { index, x: e.clientX, y: e.clientY, world: worlds[index]!, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / k
    const dy = (e.clientY - d.y) / k
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return
    d.moved = true
    edit((draft) => {
      materialize(draft)
      const s = draft.slides[d.index]
      if (s?.world) {
        s.world.x = Math.round(d.world.x + dx)
        s.world.y = Math.round(d.world.y + dy)
      }
    }, `space-${d.index}`)
  }
  const onPointerUp = (index: number) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) onSelect(deck.slides[index]!.id)
  }

  const path = worlds.map((w, i) => {
    const p = toScreen(w.x, w.y)
    return `${i ? 'L' : 'M'}${p.left} ${p.top}`
  })

  return (
    <div className="space-view">
      <div className="space-view__bar material">
        <strong>Raum</strong>
        <span className="muted">Ziehen ordnet an · die Linie ist der Weg der Kamera</span>
        <span className="space-view__actions">
          <button className="btn" onClick={() => arrange('line')}>Linie</button>
          <button className="btn" onClick={() => arrange('grid')}>Raster</button>
          <button className="btn" onClick={() => arrange('circle')}>Kreis</button>
          <button className="btn" onClick={allCamera} title="Setzt bei allen Folien den Übergang „Kamerafahrt“">
            Alle als Kamerafahrt
          </button>
          <button className="btn btn--primary" onClick={onClose}>Fertig</button>
        </span>
      </div>
      <div className="space-view__world" ref={box}>
        <svg className="space-view__path" width={size.w} height={size.h}>
          <path d={path.join(' ')} />
        </svg>
        {deck.slides.map((s, i) => {
          const w = worlds[i]!
          const p = toScreen(w.x, w.y)
          return (
            <div
              key={s.id}
              className={`space-card ${i === current ? 'is-current' : ''} ${s.transition?.type === 'camera' ? 'is-camera' : ''}`}
              style={{
                left: p.left,
                top: p.top,
                width: W * w.scale * k,
                height: H * w.scale * k,
                transform: `translate(-50%, -50%) rotate(${w.rotate}deg)`,
                // Tiefe bestimmt die Stapelung, bleibt aber immer über dem Hintergrund.
                zIndex: Math.min(999, Math.max(1, Math.round(w.z / 10) + 500)),
              }}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={() => onPointerUp(i)}
            >
              <Stage format={deck.format}>
                <SlideView slide={s} deckName={deckName} mode="thumb" width={W} height={H} />
              </Stage>
              <span className="space-card__number">{i + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
