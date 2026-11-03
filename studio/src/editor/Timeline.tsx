import type { Draft } from 'immer'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { computeSteps, type BuildItem, type MotionItem } from '../engine/timeline'
import type { Slide } from '../schema/deck'
import { layerName } from './Layers'
import type { Page } from './model'

/**
 * Zeitleiste unter der Folie: zeigt pro Klick-Schritt (oder für die ganze Szene), wann welches Element sich bewegt.
 * Balken ziehen = Start verschieben, rechte Kante ziehen = Dauer ändern (50-ms-Raster, ⇧ = 10 ms).
 * Bauen macht Claude – hier wird nur gefeilt.
 */

type Bar =
  | { kind: 'build'; id: string; label: string; item: BuildItem }
  | { kind: 'motion'; id: string; label: string; item: MotionItem }

type Drag = { bar: Bar; mode: 'move' | 'end'; x0: number; start: number; duration: number; pxPerS: number; pointer: number }

const PRESET_NAMES: Record<string, string> = {
  fade: 'Einblenden',
  rise: 'Aufsteigen',
  blurRise: 'Seide',
  scaleIn: 'Wachsen',
  maskReveal: 'Maske',
  wordByWord: 'Wort für Wort',
  lineByLine: 'Zeile für Zeile',
  drawLine: 'Zeichnen',
  countUp: 'Zählen',
  kenBurns: 'Ken Burns',
  grow: 'Aufbauen',
}

function motionLabel(m: MotionItem['motion']): string {
  if (m.path) return 'Pfad'
  if (m.keys) return `${m.keys.length} Schlüssel`
  return m.from && !m.to ? 'Herein' : 'Bewegung'
}

export function Timeline({
  slide,
  selected,
  onSelect,
  editPage,
  onPreview,
}: {
  slide: Slide
  selected: string[]
  onSelect: (ids: string[]) => void
  editPage: (recipe: (p: Draft<Page>) => void, merge?: string) => void
  onPreview: (fromStep?: number) => void
}) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('studio-timeline') !== 'zu'
    } catch {
      return true
    }
  })
  const [stepState, setStep] = useState(0)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [preview, setPreview] = useState<{ start: number; duration: number } | null>(null)
  const track = useRef<HTMLDivElement>(null)

  const steps = computeSteps(slide)
  const scene = Boolean(slide.scene)
  const step = Math.min(stepState, steps.length - 1)
  const current = steps[step]
  const bars: Bar[] = [
    ...(current?.items ?? []).map((item): Bar => ({
      kind: 'build',
      id: `b-${item.element.id}-${item.kind}`,
      label: `${PRESET_NAMES[item.anim.preset] ?? item.anim.preset}${item.kind === 'out' ? ' (aus)' : ''}`,
      item,
    })),
    ...(current?.motions ?? []).map((item): Bar => ({
      kind: 'motion',
      id: `m-${item.element.id}-${item.index}`,
      label: `${motionLabel(item.motion)}${item.loop ? ' ∞' : item.motion.repeat ? ` ×${item.motion.repeat + 1}` : ''}`,
      item,
    })),
  ]
  // Zeilen: ein Element pro Zeile, in Ebenen-Reihenfolge (oben = vorne wie in der Ebenen-Liste).
  const rows = slide.elements
    .filter((el) => bars.some((b) => b.item.element.id === el.id))
    .reverse()
    .map((el) => ({ el, bars: bars.filter((b) => b.item.element.id === el.id) }))

  const total = Math.max(1, (current?.duration ?? 0) + 0.5, ...bars.map((b) => b.item.start + b.item.duration + 0.3))
  const ticks = total > 12 ? 2 : total > 5 ? 1 : 0.5

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem('studio-timeline', o ? 'zu' : 'auf')
      } catch {
        /* ohne Speicher */
      }
      return !o
    })
  }

  /** Neue Zeiten in die Datei schreiben (ms, gerundet). */
  const apply = (bar: Bar, start: number, duration: number, merge: string) =>
    editPage((p) => {
      const el = p.elements.find((e) => e.id === bar.item.element.id)
      if (!el) return
      if (bar.kind === 'motion') {
        const m = el.motion?.[bar.item.index]
        if (!m) return
        const at = Math.round(start * 1000)
        if (at) m.at = at
        else delete m.at
        // Der Balken zeigt alle Runden – gespeichert wird die Dauer einer Runde.
        const repeat = m.repeat && m.repeat > 0 ? m.repeat : 0
        const round = (duration - ((m.repeatDelay ?? 0) / 1000) * repeat) / (repeat + 1)
        m.duration = Math.max(50, Math.round(round * 1000))
      } else {
        const a = bar.item.kind === 'in' ? el.build?.in : el.build?.out
        if (!a) return
        // Builds: Start ergibt sich aus dem Auslöser – verschoben wird über die Verzögerung.
        const base = bar.item.start - (a.delay ?? 0) / 1000
        const delay = Math.max(0, Math.round((start - base) * 1000))
        if (delay) a.delay = delay
        else delete a.delay
        a.duration = Math.max(50, Math.round(duration * 1000))
      }
    }, merge)

  const onDown = (e: ReactPointerEvent, bar: Bar, mode: Drag['mode']) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect([bar.item.element.id])
    const width = track.current?.getBoundingClientRect().width ?? 600
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ bar, mode, x0: e.clientX, start: bar.item.start, duration: bar.item.duration, pxPerS: width / total, pointer: e.pointerId })
    setPreview({ start: bar.item.start, duration: bar.item.duration })
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const grid = e.shiftKey ? 0.01 : 0.05
    const dt = Math.round((e.clientX - drag.x0) / drag.pxPerS / grid) * grid
    const next =
      drag.mode === 'move'
        ? { start: Math.max(0, drag.start + dt), duration: drag.duration }
        : { start: drag.start, duration: Math.max(0.05, drag.duration + dt) }
    setPreview(next)
    apply(drag.bar, next.start, next.duration, `timeline-${drag.bar.id}-${drag.pointer}`)
  }
  const onUp = () => {
    setDrag(null)
    setPreview(null)
  }

  const hasAny = steps.some((s) => s.items.length || s.motions.length)

  return (
    <section className={`timeline ${open ? 'is-open' : ''}`} aria-label="Zeitleiste">
      <header className="timeline__head">
        <button type="button" className="timeline__toggle" aria-expanded={open} onClick={toggle}>
          <span className="timeline__chevron" aria-hidden>
            ›
          </span>
          Zeitleiste
        </button>
        {open && hasAny && (
          <div className="timeline__steps" role="tablist" aria-label="Schritt">
            {scene ? (
              <span className="timeline__scene">Szene{slide.scene?.loop ? ' · Schleife' : ''}</span>
            ) : (
              steps.map((s, i) =>
                s.items.length || s.motions.length || i === 0 ? (
                  <button key={i} type="button" role="tab" aria-selected={i === step} className={i === step ? 'is-on' : ''} onClick={() => setStep(i)}>
                    {i === 0 ? 'Automatisch' : `Klick ${i}`}
                  </button>
                ) : null,
              )
            )}
          </div>
        )}
        {open && hasAny && (
          <button type="button" className="btn btn--plain timeline__play" title="Diesen Schritt auf der Folie abspielen" onClick={() => onPreview(step)}>
            ▶ Abspielen
          </button>
        )}
      </header>
      {open && (
        <div className="timeline__body">
          {!hasAny && <p className="muted timeline__empty">Diese Folie hat keine Animationen. Claude baut sie dir – hier kannst du dann Zeiten feilen.</p>}
          {hasAny && !rows.length && <p className="muted timeline__empty">In diesem Schritt bewegt sich nichts.</p>}
          {rows.length > 0 && (
            <div className="timeline__grid" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <div className="timeline__names">
                <div className="timeline__ruler-spacer" />
                {rows.map(({ el }) => (
                  <button
                    key={el.id}
                    type="button"
                    className={`timeline__name ${selected.includes(el.id) ? 'is-selected' : ''}`}
                    onClick={() => onSelect([el.id])}
                    title={el.id}
                  >
                    {layerName(el)}
                  </button>
                ))}
              </div>
              <div className="timeline__tracks" ref={track}>
                <div className="timeline__ruler">
                  {Array.from({ length: Math.floor(total / ticks) + 1 }, (_, i) => i * ticks).map((t) => (
                    <span key={t} style={{ left: `${(t / total) * 100}%` }}>
                      {t.toLocaleString('de-DE')} s
                    </span>
                  ))}
                </div>
                {rows.map(({ el, bars: list }) => (
                  <div key={el.id} className={`timeline__row ${selected.includes(el.id) ? 'is-selected' : ''}`}>
                    {list.map((bar) => {
                      const live = drag?.bar.id === bar.id && preview ? preview : bar.item
                      const loop = bar.kind === 'motion' && bar.item.loop
                      return (
                        <div
                          key={bar.id}
                          className={`timeline__bar timeline__bar--${bar.kind} ${loop ? 'is-loop' : ''}`}
                          style={{ left: `${(live.start / total) * 100}%`, width: loop ? undefined : `${Math.max(0.6, (live.duration / total) * 100)}%`, right: loop ? 0 : undefined }}
                          title={`${bar.label} · Start ${Math.round(live.start * 1000)} ms · Dauer ${Math.round(live.duration * 1000)} ms`}
                          onPointerDown={(e) => onDown(e, bar, 'move')}
                        >
                          <span className="timeline__bar-label">{bar.label}</span>
                          {!loop && <span className="timeline__bar-end" onPointerDown={(e) => onDown(e, bar, 'end')} />}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
