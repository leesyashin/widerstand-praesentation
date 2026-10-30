import { useLayoutEffect, useMemo, useRef } from 'react'
import { useDeck } from '../api/live'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { resolveDeck } from '../engine/masters'
import { ThemeScope } from '../engine/ThemeScope'
import { createSlideTimeline } from '../engine/timeline'
import type { Deck } from '../schema/deck'
import './Present.css'

/**
 * Nackte Folie für Screenshots (npm run shots). `step` = Zustand nach diesem Build-Schritt,
 * ohne Angabe der Endzustand. Setzt <body data-ready> und data-steps, sobald alles steht.
 */
export function RenderView({ name, slideId, step }: { name: string; slideId?: string; step?: number }) {
  const live = useDeck(name)
  const deck = useMemo(() => live.value && resolveDeck(live.value), [live.value])
  if (!deck) return null
  return (
    <ThemeScope theme={deck.theme} intensity={deck.intensity} textStyles={deck.textStyles}>
      <RenderSlide deck={deck} name={name} slideId={slideId} step={step} />
    </ThemeScope>
  )
}

function RenderSlide({ deck, name, slideId, step }: { deck: Deck; name: string; slideId?: string; step?: number }) {
  const slide = deck.slides.find((s) => s.id === slideId) ?? deck.slides[0]
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = ref.current?.querySelector<HTMLElement>(':scope > .slide')
    if (!root || !slide) return
    delete document.body.dataset.ready
    let cancelled = false
    const tl = createSlideTimeline(root, slide)
    const last = tl.steps.length - 1
    tl.seek(step === undefined ? last : Math.min(step, last))
    document.body.dataset.steps = String(tl.steps.length)
    const media = [...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {}))
    // Lottie lädt asynchron, WebGL zeichnet im nächsten Frame – beides abwarten (höchstens 4 s).
    const lottieReady = async () => {
      const until = performance.now() + 4000
      while (performance.now() < until && [...root.querySelectorAll('.el-lottie')].some((n) => !n.querySelector('svg'))) {
        await new Promise((r) => setTimeout(r, 50))
      }
    }
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    void Promise.all([document.fonts.ready, ...media, lottieReady()])
      .then(frames)
      .then(() => {
        if (!cancelled) document.body.dataset.ready = '1'
      })
    return () => {
      cancelled = true
      tl.kill()
    }
  }, [slide, step])

  if (!slide) return null
  return (
    <div className="present">
      <Stage format={deck.format} className="present__stage">
        <div className="present__layer" ref={ref}>
          <SlideView slide={slide} deckName={name} mode="render" width={deck.format.width} height={deck.format.height} />
        </div>
      </Stage>
    </div>
  )
}
