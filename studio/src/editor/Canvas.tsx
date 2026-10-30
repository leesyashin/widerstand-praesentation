import type { Draft } from 'immer'
import {
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTextStyles } from '../engine/context'
import { SlideView, textCss } from '../engine/SlideView'
import { Stage, StageScaleContext } from '../engine/Stage'
import type { Deck, Element, Frame, Slide } from '../schema/deck'
import { roundFrame } from './model'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export type CanvasProps = {
  deck: Deck
  deckName: string
  slide: Slide
  selected: string | null
  onSelect: (id: string | null) => void
  editing: string | null
  onEditText: (id: string | null) => void
  edit: (recipe: (draft: Draft<Deck>) => void, merge?: string) => void
}

/** Arbeitsfläche: Folie plus Auswahl-Ebene zum Auswählen, Verschieben, Skalieren und Text bearbeiten. */
export function Canvas(props: CanvasProps) {
  const { deck, deckName, slide } = props
  return (
    <Stage format={deck.format} className="editor-stage">
      <SlideView slide={slide} deckName={deckName} mode="view" width={deck.format.width} height={deck.format.height} />
      <SelectionLayer {...props} />
    </Stage>
  )
}

function findElement(slide: Slide, id: string | null): Element | undefined {
  return id ? slide.elements.find((e) => e.id === id) : undefined
}

function SelectionLayer({ deck, slide, selected, onSelect, editing, onEditText, edit }: CanvasProps) {
  const scale = useContext(StageScaleContext)
  const layer = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const drag = useRef<{ id: string; pointer: number; x: number; y: number; frame: Frame; handle: Handle | null } | null>(
    null,
  )
  const slideIndex = deck.slides.indexOf(slide)
  const selectedEl = findElement(slide, selected)

  /** Oberstes, nicht gesperrtes Element unter dem Zeiger. */
  const hitTest = (x: number, y: number): string | null => {
    const root = layer.current?.parentElement?.querySelector(':scope > .slide')
    for (const node of document.elementsFromPoint(x, y)) {
      const el = node.closest<HTMLElement>('[data-element-id]')
      if (!el || !root?.contains(el)) continue
      const id = el.dataset.elementId ?? null
      if (id && !findElement(slide, id)?.locked) return id
    }
    return null
  }

  const startDrag = (e: ReactPointerEvent, id: string, handle: Handle | null) => {
    const el = findElement(slide, id)
    if (!el || el.locked) return
    e.preventDefault()
    e.stopPropagation()
    layer.current?.setPointerCapture(e.pointerId)
    drag.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, frame: { ...el.frame }, handle }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || editing) return
    const id = hitTest(e.clientX, e.clientY)
    onSelect(id)
    if (id) startDrag(e, id, null)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) {
      if (!editing) setHover(hitTest(e.clientX, e.clientY))
      return
    }
    const dx = (e.clientX - d.x) / scale
    const dy = (e.clientY - d.y) / scale
    const el = findElement(slide, d.id)
    if (!el) return
    const keepRatio = e.shiftKey !== (el.type === 'image' || el.type === 'video' || el.type === 'icon')
    const next = d.handle ? resize(d.frame, d.handle, dx, dy, keepRatio) : { ...d.frame, x: d.frame.x + dx, y: d.frame.y + dy }
    edit((draft) => {
      const target = draft.slides[slideIndex]?.elements.find((x) => x.id === d.id)
      if (target) target.frame = roundFrame(next)
    }, `drag-${d.pointer}`)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null
  }

  const onDoubleClick = (e: ReactMouseEvent) => {
    const id = hitTest(e.clientX, e.clientY)
    if (id && findElement(slide, id)?.type === 'text') onEditText(id)
  }

  const hoverEl = hover !== selected ? findElement(slide, hover) : undefined
  const line = 1.5 / scale
  const editingEl = findElement(slide, editing)

  return (
    <div
      ref={layer}
      className="selection-layer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
    >
      {editing && <style>{`.editor-stage [data-element-id="${CSS.escape(editing)}"] { visibility: hidden; }`}</style>}
      {hoverEl && <div className="sel-hover" style={{ ...frameStyle(hoverEl.frame), outlineWidth: line }} />}
      {selectedEl && !editing && (
        <div className="sel-box" style={{ ...frameStyle(selectedEl.frame), outlineWidth: line }}>
          {!selectedEl.locked &&
            HANDLES.map((h) => (
              <div
                key={h}
                className={`sel-handle sel-handle--${h}`}
                style={{ width: 10 / scale, height: 10 / scale, borderWidth: line }}
                onPointerDown={(e) => startDrag(e, selectedEl.id, h)}
              />
            ))}
        </div>
      )}
      {editingEl?.type === 'text' && (
        <TextEditor
          key={editingEl.id}
          element={editingEl}
          onChange={(content) =>
            edit((draft) => {
              const t = draft.slides[slideIndex]?.elements.find((x) => x.id === editingEl.id)
              if (t?.type === 'text') t.content = content
            }, `text-${editingEl.id}`)
          }
          onDone={(content) => {
            if (!content.trim()) {
              edit((draft) => {
                const s = draft.slides[slideIndex]
                if (s) s.elements = s.elements.filter((x) => x.id !== editingEl.id)
              })
              onSelect(null)
            }
            onEditText(null)
          }}
        />
      )}
    </div>
  )
}

function frameStyle(f: Frame): CSSProperties {
  return {
    left: f.x,
    top: f.y,
    width: f.w,
    height: f.h,
    transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
  }
}

/** Neuer Rahmen beim Ziehen an einem Griff. Mit `keepRatio` bleibt das Seitenverhältnis erhalten. */
function resize(f: Frame, handle: Handle, dx: number, dy: number, keepRatio: boolean): Frame {
  let { x, y, w, h } = f
  const min = 8
  if (handle.includes('e')) w = Math.max(min, f.w + dx)
  if (handle.includes('s')) h = Math.max(min, f.h + dy)
  if (handle.includes('w')) {
    w = Math.max(min, f.w - dx)
    x = f.x + f.w - w
  }
  if (handle.includes('n')) {
    h = Math.max(min, f.h - dy)
    y = f.y + f.h - h
  }
  if (keepRatio) {
    const ratio = f.w / f.h
    if (handle === 'n' || handle === 's') w = h * ratio
    else if (handle === 'e' || handle === 'w') h = w / ratio
    else if (w / h > ratio) h = w / ratio
    else w = h * ratio
    if (handle.includes('w')) x = f.x + f.w - w
    if (handle.includes('n')) y = f.y + f.h - h
    if (handle === 'n' || handle === 's') x = f.x + (f.w - w) / 2
    if (handle === 'e' || handle === 'w') y = f.y + (f.h - h) / 2
  }
  return { ...f, x, y, w, h }
}

/** Text direkt auf der Folie bearbeiten. Markup (**fett**, *kursiv*) bleibt sichtbar. */
function TextEditor({
  element,
  onChange,
  onDone,
}: {
  element: Extract<Element, { type: 'text' }>
  onChange: (content: string) => void
  onDone: (content: string) => void
}) {
  const styles = useTextStyles()
  const [value, setValue] = useState(element.content)
  return (
    <textarea
      className="text-editor"
      autoFocus
      spellCheck
      value={value}
      style={{ ...frameStyle(element.frame), ...textCss(element, styles) }}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          onDone(value)
        }
      }}
      onBlur={() => onDone(value)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
