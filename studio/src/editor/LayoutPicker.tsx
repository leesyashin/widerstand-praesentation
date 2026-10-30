import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import type { Deck } from '../schema/deck'
import type { Layout } from '../schema/layout'
import type { Theme } from '../schema/theme'
import { slideFromLayout } from './model'

/** Auswahl eines Layouts für eine neue Folie – mit echter Vorschau im aktuellen Theme. */
export function LayoutPicker({
  deck,
  deckName,
  layouts,
  theme,
  onPick,
  onClose,
}: {
  deck: Deck
  deckName: string
  layouts: Layout[]
  theme: Theme | null
  onPick: (layout: Layout) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!ref.current?.contains(target) && !target.closest('.nav-add__btn')) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Portal: die Seitenleiste (backdrop-filter) würde ein fixiertes Menü sonst abschneiden.
  return createPortal(
    <div ref={ref} className="layout-picker material" role="dialog" aria-label="Layout wählen">
      <h3 className="section-title">Neue Folie</h3>
      <div className="layout-picker__grid">
        {layouts.map((layout) => {
          const preview = slideFromLayout(layout, { ...deck, slides: [] }, theme)
          return (
            <button key={layout.name} type="button" className="layout-option" onClick={() => onPick(layout)}>
              <div className="layout-option__thumb" style={{ aspectRatio: `${deck.format.width} / ${deck.format.height}` }}>
                <Stage format={deck.format}>
                  <SlideView slide={preview} deckName={deckName} mode="thumb" width={deck.format.width} height={deck.format.height} />
                </Stage>
              </div>
              <span className="layout-option__name">{layout.label}</span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
