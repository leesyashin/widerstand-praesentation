import { useLayoutEffect, useRef } from 'react'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { createSlideTimeline } from '../engine/timeline'
import type { Deck, Slide } from '../schema/deck'

/**
 * Kleine Folienvorschau in einem bestimmten Build-Zustand (0 = nach dem Automatik-Schritt, n = nach n Klicks).
 * Nutzt die leichte Vorschau-Darstellung (keine WebGL-Kontexte).
 */
export function SlidePreview({ deck, name, slide, step }: { deck: Deck; name: string; slide: Slide; step: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current?.querySelector<HTMLElement>('.slide')
    if (!root) return
    const tl = createSlideTimeline(root, slide)
    tl.seek(Math.min(step, tl.steps.length - 1))
    return () => tl.kill()
  }, [slide, step])
  return (
    <div ref={ref} className="slide-preview">
      <Stage format={deck.format}>
        <SlideView slide={slide} deckName={name} mode="thumb" width={deck.format.width} height={deck.format.height} />
      </Stage>
    </div>
  )
}
