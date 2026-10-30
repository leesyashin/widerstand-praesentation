import type { Draft } from 'immer'
import { useState, type DragEvent as ReactDragEvent } from 'react'
import { resolveSlide } from '../engine/masters'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import type { Deck } from '../schema/deck'
import { Icon } from '../ui/Icon'
import { duplicateSlide, moveSlide } from './model'

type Props = {
  deck: Deck
  deckName: string
  current: number
  edit: (recipe: (draft: Draft<Deck>) => void, merge?: string) => void
  onSelect: (slideId: string) => void
  /** Doppelklick: Folie im Editor öffnen. */
  onOpen: (slideId: string) => void
  onClose: () => void
}

export const SLIDE_MIME = 'application/x-studio-slide'

/** Titel einer Folie für Übersicht und Navigator: erster Text, sonst die ID. */
export function slideTitle(slide: Deck['slides'][number]): string {
  const text = slide.elements.find((e) => e.type === 'text')
  return text?.type === 'text' ? text.content.replace(/\*+/g, '').split('\n')[0]!.slice(0, 48) : slide.id
}

/** Folienübersicht als Raster: ziehen ordnet um, dazu Duplizieren, Überspringen und Löschen. */
export function Overview({ deck, deckName, current, edit, onSelect, onOpen, onClose }: Props) {
  const [dropAt, setDropAt] = useState<{ index: number; before: boolean } | null>(null)
  const [zoom, setZoom] = useState(220)

  const onDragOver = (e: ReactDragEvent, index: number) => {
    if (![...e.dataTransfer.types].includes(SLIDE_MIME)) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    setDropAt({ index, before: e.clientX < r.left + r.width / 2 })
  }
  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    const from = Number(e.dataTransfer.getData(SLIDE_MIME))
    const target = dropAt
    setDropAt(null)
    if (!target || !Number.isInteger(from)) return
    let to = target.before ? target.index : target.index + 1
    if (from < to) to -= 1
    if (to !== from) edit((d) => moveSlide(d, from, to))
  }

  return (
    <div className="overview">
      <div className="space-view__bar">
        <strong>Folienübersicht</strong>
        <span className="muted">Ziehen ordnet um · Doppelklick öffnet die Folie</span>
        <span className="space-view__actions">
          <input
            type="range"
            min={140}
            max={420}
            value={zoom}
            title="Größe der Vorschaubilder"
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Fertig
          </button>
        </span>
      </div>
      <div className="overview__grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${zoom}px, 1fr))` }} onDrop={onDrop}>
        {deck.slides.map((s, i) => (
          <div
            key={s.id}
            className={`overview-card ${i === current ? 'is-current' : ''} ${s.skip ? 'is-skipped' : ''} ${
              dropAt?.index === i ? (dropAt.before ? 'drop-before' : 'drop-after') : ''
            }`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(SLIDE_MIME, String(i))
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => onDragOver(e, i)}
            onDragLeave={() => setDropAt(null)}
            onClick={() => onSelect(s.id)}
            onDoubleClick={() => onOpen(s.id)}
          >
            <div className="overview-card__thumb" style={{ aspectRatio: `${deck.format.width} / ${deck.format.height}` }}>
              <Stage format={deck.format}>
                <SlideView slide={resolveSlide(deck, s)} deckName={deckName} mode="thumb" width={deck.format.width} height={deck.format.height} />
              </Stage>
              {s.skip && <span className="overview-card__badge">Übersprungen</span>}
            </div>
            <div className="overview-card__meta">
              <span className="overview-card__number">{i + 1}</span>
              <span className="overview-card__title">{slideTitle(s)}</span>
              <span className="overview-card__actions">
                <button
                  type="button"
                  className="btn btn--icon btn--mini"
                  title={s.skip ? 'Wieder zeigen' : 'Beim Präsentieren überspringen'}
                  onClick={(e) => {
                    e.stopPropagation()
                    edit((d) => {
                      const t = d.slides[i]
                      if (t) t.skip = t.skip ? undefined : true
                    })
                  }}
                >
                  <Icon name={s.skip ? 'eyeOff' : 'eye'} size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--mini"
                  title="Duplizieren"
                  onClick={(e) => {
                    e.stopPropagation()
                    edit((d) => void d.slides.splice(i + 1, 0, duplicateSlide(s, deck)))
                  }}
                >
                  <Icon name="copy" size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon btn--mini"
                  title="Löschen"
                  disabled={deck.slides.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    edit((d) => void d.slides.splice(i, 1))
                  }}
                >
                  <Icon name="trash" size={12} />
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
