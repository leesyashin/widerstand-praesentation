import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { createSlideTimeline, type SlideTimeline } from '../engine/timeline'
import type { Block } from '../schema/block'
import type { Deck, Slide } from '../schema/deck'
import type { Theme } from '../schema/theme'
import { slideFromBlock } from './model'

/**
 * Auswahl der animierten Bausteine. Fährt man mit der Maus über eine Karte, spielt die Bewegung in der Vorschau ab.
 * Folien-Bausteine landen als neue Folie hinter der aktuellen, Element-Bausteine auf der aktuellen Folie.
 */
export function BlockPicker({
  deck,
  deckName,
  blocks,
  theme,
  onPick,
  onClose,
}: {
  deck: Deck
  deckName: string
  blocks: Block[]
  theme: Theme | null
  onPick: (block: Block) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!ref.current?.contains(target) && !target.closest('.block-toggle')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className="block-picker material" role="dialog" aria-label="Baustein einfügen">
      <h3 className="section-title">Animierte Bausteine</h3>
      <p className="field-hint muted">Maus darüber zeigt die Bewegung. Folien-Bausteine kommen als neue Folie, die anderen auf die aktuelle Folie.</p>
      <div className="block-picker__grid">
        {blocks.map((block) => {
          // Vorschau: der Baustein auf einer eigenen Folie, Element-Bausteine auf der Inhaltsfläche des Themes.
          const preview = slideFromBlock(block, { ...deck, slides: [] }, theme)
          return <BlockCard key={block.name} block={block} slide={preview} deck={deck} deckName={deckName} onPick={() => onPick(block)} />
        })}
      </div>
    </div>
  )
}

function BlockCard({ block, slide, deck, deckName, onPick }: { block: Block; slide: Slide; deck: Deck; deckName: string; onPick: () => void }) {
  const thumb = useRef<HTMLDivElement>(null)
  const running = useRef<SlideTimeline | null>(null)

  const stop = () => {
    const root = thumb.current?.querySelector<HTMLElement>('.slide')
    running.current?.kill()
    running.current = null
    if (root) gsap.set(root.querySelectorAll('.el-anim, .el-anim .w, .el-anim .ln, .el-anim svg *'), { clearProps: 'all' })
  }
  const play = () => {
    const root = thumb.current?.querySelector<HTMLElement>('.slide')
    if (!root) return
    stop()
    const tl = createSlideTimeline(root, slide)
    running.current = tl
    tl.timeline.play(0)
  }
  useEffect(() => stop, [])

  return (
    <button type="button" className="block-option" onClick={onPick} onPointerEnter={play} onPointerLeave={stop} onFocus={play} onBlur={stop}>
      <div ref={thumb} className="layout-option__thumb" style={{ aspectRatio: `${deck.format.width} / ${deck.format.height}` }}>
        <Stage format={deck.format}>
          <SlideView slide={slide} deckName={deckName} mode="thumb" width={deck.format.width} height={deck.format.height} />
        </Stage>
      </div>
      <span className="block-option__name">
        {block.label} <span className="muted">· {block.kind === 'slide' ? 'Folie' : 'Elemente'}</span>
      </span>
      <span className="block-option__text muted">{block.description}</span>
    </button>
  )
}
