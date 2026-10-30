import type { Draft } from 'immer'
import {
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTextStyles } from '../engine/context'
import { SlideView, textCss } from '../engine/SlideView'
import { Stage, StageScaleContext } from '../engine/Stage'
import type { Deck, Element, Frame, Slide } from '../schema/deck'
import { duplicateElement, expandGroups, roundFrame, unionFrame, type Page } from './model'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** Abstand in Bildschirm-Pixeln, ab dem an Hilfslinien eingerastet wird. */
const SNAP_PX = 6

export type CanvasProps = {
  deck: Deck
  deckName: string
  /** Was dargestellt wird (Folie mit Master-Elementen bzw. der Master selbst). */
  view: Slide
  /** Die bearbeitete Seite: nur ihre eigenen Elemente sind auswählbar. */
  page: Page
  selected: string[]
  onSelect: (ids: string[]) => void
  editing: string | null
  onEditText: (id: string | null) => void
  editPage: (recipe: (page: Draft<Page>) => void, merge?: string) => void
  /** Schwebende Mini-Toolbar über der Auswahl. */
  toolbar?: ReactNode
  /** Dateien oder Medien aus der Bibliothek wurden auf die Folie gezogen (Punkt in Folien-Koordinaten). */
  onDrop?: (data: DataTransfer, point: { x: number; y: number }) => void
}

/** Arbeitsfläche: Folie plus Auswahl-Ebene zum Auswählen, Verschieben, Skalieren, Drehen und Text bearbeiten. */
export function Canvas(props: CanvasProps) {
  const { deck, deckName, view } = props
  return (
    <Stage format={deck.format} className="editor-stage">
      <SlideView slide={view} deckName={deckName} mode="view" width={deck.format.width} height={deck.format.height} />
      <SelectionLayer {...props} />
    </Stage>
  )
}

type Drag =
  | { kind: 'move'; pointer: number; x: number; y: number; start: Map<string, Frame>; box: Frame; moved: boolean }
  | { kind: 'resize'; pointer: number; x: number; y: number; start: Map<string, Frame>; box: Frame; handle: Handle; single: boolean }
  | { kind: 'rotate'; pointer: number; id: string; cx: number; cy: number }
  | { kind: 'marquee'; pointer: number; x0: number; y0: number; x1: number; y1: number; base: string[] }

type Guides = { x: number[]; y: number[] }
type Badge = { x: number; y: number; text: string }

function SelectionLayer({ deck, view, page, selected, onSelect, editing, onEditText, editPage, toolbar, onDrop }: CanvasProps) {
  const scale = useContext(StageScaleContext)
  const layer = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] })
  const [badge, setBadge] = useState<Badge | null>(null)
  const [dropping, setDropping] = useState(false)
  const dragRef = useRef<Drag | null>(null)
  const W = deck.format.width
  const H = deck.format.height

  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }
  const own = (id: string | null | undefined) => (id ? page.elements.find((e) => e.id === id) : undefined)
  const selectedEls = page.elements.filter((e) => selected.includes(e.id))
  const movable = selectedEls.filter((e) => !e.locked)

  /** Bildschirm → Folien-Koordinaten. */
  const toLocal = (clientX: number, clientY: number) => {
    const r = layer.current!.getBoundingClientRect()
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale }
  }

  /** Oberstes eigenes, nicht gesperrtes Element unter dem Zeiger. */
  const hitTest = (x: number, y: number): string | null => {
    const root = layer.current?.parentElement?.querySelector(':scope > .slide')
    for (const node of document.elementsFromPoint(x, y)) {
      const el = node.closest<HTMLElement>('[data-element-id]')
      if (!el || !root?.contains(el)) continue
      const found = own(el.dataset.elementId)
      if (found && !found.locked) return found.id
    }
    return null
  }

  /** Einrast-Ziele: Folienränder und -mitte, Kanten und Mitten aller anderen sichtbaren Elemente. */
  const snapTargets = (exclude: Set<string>) => {
    const xs = [0, W / 2, W]
    const ys = [0, H / 2, H]
    for (const e of view.elements) {
      if (exclude.has(e.id) || e.hidden) continue
      const f = e.frame
      xs.push(f.x, f.x + f.w / 2, f.x + f.w)
      ys.push(f.y, f.y + f.h / 2, f.y + f.h)
    }
    return { xs, ys }
  }

  const nearest = (values: number[], targets: number[]) => {
    const limit = SNAP_PX / scale
    let best: { d: number; at: number } | null = null
    for (const v of values) {
      for (const t of targets) {
        const d = t - v
        if (Math.abs(d) <= limit && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }
      }
    }
    return best
  }

  const startMove = (e: ReactPointerEvent, ids: string[]) => {
    let targets = page.elements.filter((x) => ids.includes(x.id) && !x.locked)
    if (!targets.length) return
    // ⌥ beim Ziehen: Kopie ziehen, Original bleibt liegen.
    if (e.altKey) {
      const copies: Element[] = []
      const working = { ...page, elements: [...page.elements] } as Page
      for (const t of targets) {
        const copy = duplicateElement(t, working as Slide, 0)
        if (t.group) copy.group = `${t.group}-kopie`
        working.elements.push(copy)
        copies.push(copy)
      }
      editPage((p) => void p.elements.push(...structuredClone(copies)))
      targets = copies
      onSelect(copies.map((c) => c.id))
    }
    layer.current?.setPointerCapture(e.pointerId)
    const start = new Map(targets.map((t) => [t.id, { ...t.frame }]))
    setDrag({ kind: 'move', pointer: e.pointerId, x: e.clientX, y: e.clientY, start, box: unionFrame([...start.values()]), moved: false })
  }

  const startResize = (e: ReactPointerEvent, handle: Handle) => {
    if (!movable.length) return
    e.preventDefault()
    e.stopPropagation()
    layer.current?.setPointerCapture(e.pointerId)
    const start = new Map(movable.map((t) => [t.id, { ...t.frame }]))
    const single = movable.length === 1
    setDrag({ kind: 'resize', pointer: e.pointerId, x: e.clientX, y: e.clientY, start, box: single ? { ...movable[0]!.frame } : unionFrame([...start.values()]), handle, single })
  }

  const startRotate = (e: ReactPointerEvent) => {
    const el = movable[0]
    if (!el || movable.length !== 1) return
    e.preventDefault()
    e.stopPropagation()
    layer.current?.setPointerCapture(e.pointerId)
    setDrag({ kind: 'rotate', pointer: e.pointerId, id: el.id, cx: el.frame.x + el.frame.w / 2, cy: el.frame.y + el.frame.h / 2 })
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || editing) return
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const hit = hitTest(e.clientX, e.clientY)
    if (!hit) {
      const p = toLocal(e.clientX, e.clientY)
      const base = e.shiftKey || e.metaKey ? selected : []
      if (!base.length) onSelect([])
      layer.current?.setPointerCapture(e.pointerId)
      setDrag({ kind: 'marquee', pointer: e.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y, base })
      return
    }
    // ⌘-Klick wählt ein einzelnes Element innerhalb einer Gruppe.
    const ids = e.metaKey || e.ctrlKey ? [hit] : expandGroups(page.elements, [hit])
    if (e.shiftKey) {
      const already = ids.every((id) => selected.includes(id))
      const next = already ? selected.filter((id) => !ids.includes(id)) : [...selected, ...ids.filter((id) => !selected.includes(id))]
      onSelect(next)
      if (!already) startMove(e, next)
      return
    }
    if (ids.every((id) => selected.includes(id)) && !(e.metaKey || e.ctrlKey)) startMove(e, selected)
    else {
      onSelect(ids)
      startMove(e, ids)
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) {
      if (!editing) setHover(hitTest(e.clientX, e.clientY))
      return
    }
    const free = e.metaKey || e.ctrlKey // ⌘ hält das Einrasten an
    if (d.kind === 'marquee') {
      const p = toLocal(e.clientX, e.clientY)
      const next = { ...d, x1: p.x, y1: p.y }
      setDrag(next)
      const box = { x: Math.min(next.x0, next.x1), y: Math.min(next.y0, next.y1), r: Math.max(next.x0, next.x1), b: Math.max(next.y0, next.y1) }
      const hits = page.elements
        .filter((el) => !el.locked && !el.hidden)
        .filter((el) => el.frame.x < box.r && el.frame.x + el.frame.w > box.x && el.frame.y < box.b && el.frame.y + el.frame.h > box.y)
        .map((el) => el.id)
      const ids = expandGroups(page.elements, hits)
      onSelect([...d.base, ...ids.filter((id) => !d.base.includes(id))])
      return
    }

    if (d.kind === 'rotate') {
      const p = toLocal(e.clientX, e.clientY)
      let angle = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI + 90
      if (angle > 180) angle -= 360
      if (e.shiftKey) angle = Math.round(angle / 15) * 15
      else if (!free) {
        const snapTo = Math.round(angle / 90) * 90
        if (Math.abs(snapTo - angle) < 3) angle = snapTo
      }
      angle = Math.round(angle)
      if (angle === -180) angle = 180
      editPage((pg) => {
        const t = pg.elements.find((x) => x.id === d.id)
        if (!t) return
        if (angle) t.frame.rotation = angle
        else delete t.frame.rotation
      }, `drag-${d.pointer}`)
      setBadge({ x: p.x, y: p.y, text: `${angle}°` })
      return
    }

    let dx = (e.clientX - d.x) / scale
    let dy = (e.clientY - d.y) / scale
    const nextGuides: Guides = { x: [], y: [] }

    if (d.kind === 'move') {
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3) return
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0
        else dx = 0
      }
      if (!free) {
        const { xs, ys } = snapTargets(new Set(d.start.keys()))
        const b = d.box
        const sx = dx === 0 && e.shiftKey ? null : nearest([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], xs)
        const sy = dy === 0 && e.shiftKey ? null : nearest([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], ys)
        if (sx) {
          dx += sx.d
          nextGuides.x.push(sx.at)
        }
        if (sy) {
          dy += sy.d
          nextGuides.y.push(sy.at)
        }
      }
      if (!d.moved) setDrag({ ...d, moved: true })
      editPage((pg) => {
        for (const t of pg.elements) {
          const f = d.start.get(t.id)
          if (f) t.frame = roundFrame({ ...f, x: f.x + dx, y: f.y + dy })
        }
      }, `drag-${d.pointer}`)
      setBadge({ x: d.box.x + dx, y: d.box.y + dy, text: `${Math.round(d.box.x + dx)}, ${Math.round(d.box.y + dy)}` })
    }

    if (d.kind === 'resize') {
      const first = page.elements.find((x) => x.id === [...d.start.keys()][0])
      const ratioDefault = d.single && first ? first.type === 'image' || first.type === 'video' || first.type === 'icon' : !d.single
      const keepRatio = e.shiftKey !== ratioDefault
      let next = resize(d.box, d.handle, dx, dy, keepRatio)
      if (!free && !keepRatio && !d.box.rotation) {
        const { xs, ys } = snapTargets(new Set(d.start.keys()))
        if (d.handle.includes('e') || d.handle.includes('w')) {
          const edge = d.handle.includes('e') ? next.x + next.w : next.x
          const s = nearest([edge], xs)
          if (s) {
            nextGuides.x.push(s.at)
            next = d.handle.includes('e') ? { ...next, w: next.w + s.d } : { ...next, x: next.x + s.d, w: next.w - s.d }
          }
        }
        if (d.handle.includes('n') || d.handle.includes('s')) {
          const edge = d.handle.includes('s') ? next.y + next.h : next.y
          const s = nearest([edge], ys)
          if (s) {
            nextGuides.y.push(s.at)
            next = d.handle.includes('s') ? { ...next, h: next.h + s.d } : { ...next, y: next.y + s.d, h: next.h - s.d }
          }
        }
      }
      const box = d.box
      const sx = next.w / box.w
      const sy = next.h / box.h
      editPage((pg) => {
        for (const t of pg.elements) {
          const f = d.start.get(t.id)
          if (!f) continue
          t.frame = d.single
            ? roundFrame({ ...f, x: next.x, y: next.y, w: next.w, h: next.h })
            : roundFrame({ ...f, x: next.x + (f.x - box.x) * sx, y: next.y + (f.y - box.y) * sy, w: f.w * sx, h: f.h * sy })
        }
      }, `drag-${d.pointer}`)
      setBadge({ x: next.x + next.w, y: next.y + next.h, text: `${Math.round(next.w)} × ${Math.round(next.h)}` })
    }
    setGuides(nextGuides)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current?.pointer !== e.pointerId) return
    setDrag(null)
    setGuides({ x: [], y: [] })
    setBadge(null)
  }

  const onDoubleClick = (e: ReactMouseEvent) => {
    const id = hitTest(e.clientX, e.clientY)
    const el = own(id)
    if (el?.type === 'text') {
      onSelect([el.id])
      onEditText(el.id)
    } else if (el?.group) onSelect([el.id]) // Doppelklick in eine Gruppe: einzelnes Element
  }

  const onDragOver = (e: ReactDragEvent) => {
    if (!onDrop) return
    const types = [...e.dataTransfer.types]
    if (!types.includes('Files') && !types.includes(ASSET_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropping(true)
  }
  const onDropEvent = (e: ReactDragEvent) => {
    if (!onDrop) return
    e.preventDefault()
    setDropping(false)
    onDrop(e.dataTransfer, toLocal(e.clientX, e.clientY))
  }

  const line = 1.5 / scale
  const hoverEl = hover && !selected.includes(hover) ? own(hover) : undefined
  const editingEl = own(editing)
  const single = selectedEls.length === 1 ? selectedEls[0] : undefined
  const box = selectedEls.length > 1 ? unionFrame(selectedEls.map((e) => e.frame)) : single?.frame
  const busy = drag !== null && drag.kind !== 'marquee'
  const showToolbar = toolbar && box && !editing && !busy

  return (
    <div
      ref={layer}
      className={`selection-layer ${dropping ? 'is-dropping' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDropEvent}
    >
      {editing && <style>{`.editor-stage [data-element-id="${CSS.escape(editing)}"] { visibility: hidden; }`}</style>}
      {hoverEl && <div className="sel-hover" style={{ ...frameStyle(hoverEl.frame), outlineWidth: line }} />}
      {selectedEls.length > 1 &&
        selectedEls.map((el) => <div key={el.id} className="sel-member" style={{ ...frameStyle(el.frame), outlineWidth: line }} />)}
      {box && !editing && (
        <div className={`sel-box ${single?.locked ? 'is-locked' : ''}`} style={{ ...frameStyle(box), outlineWidth: line }}>
          {movable.length > 0 &&
            HANDLES.map((h) => (
              <div
                key={h}
                className={`sel-handle sel-handle--${h}`}
                style={{ width: 10 / scale, height: 10 / scale, borderWidth: line }}
                onPointerDown={(e) => startResize(e, h)}
              />
            ))}
          {single && !single.locked && (
            <>
              <div className="sel-rotate-stem" style={{ width: line, height: 22 / scale, top: -22 / scale }} />
              <div
                className="sel-rotate"
                title="Drehen (⇧ = 15°-Schritte)"
                style={{ width: 12 / scale, height: 12 / scale, top: -28 / scale, borderWidth: line }}
                onPointerDown={startRotate}
              />
            </>
          )}
        </div>
      )}
      {drag?.kind === 'marquee' && (
        <div
          className="sel-marquee"
          style={{
            left: Math.min(drag.x0, drag.x1),
            top: Math.min(drag.y0, drag.y1),
            width: Math.abs(drag.x1 - drag.x0),
            height: Math.abs(drag.y1 - drag.y0),
            borderWidth: 1 / scale,
          }}
        />
      )}
      {guides.x.map((x) => (
        <div key={`gx-${x}`} className="guide guide--v" style={{ left: x, width: 1 / scale }} />
      ))}
      {guides.y.map((y) => (
        <div key={`gy-${y}`} className="guide guide--h" style={{ top: y, height: 1 / scale }} />
      ))}
      {badge && (
        <div className="sel-badge" style={{ left: badge.x, top: badge.y, transform: `scale(${1 / scale}) translate(8px, 8px)` }}>
          {badge.text}
        </div>
      )}
      {showToolbar && (
        <div
          className={`mini-toolbar-anchor ${box.y < 90 / scale ? 'is-below' : ''} ${single && !single.locked ? 'has-rotate' : ''}`}
          style={{
            left: box.x + box.w / 2,
            top: box.y < 90 / scale ? box.y + box.h : box.y,
            transform: `scale(${1 / scale})`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {toolbar}
        </div>
      )}
      {editingEl?.type === 'text' && (
        <TextEditor
          key={editingEl.id}
          element={editingEl}
          onChange={(content) =>
            editPage((pg) => {
              const t = pg.elements.find((x) => x.id === editingEl.id)
              if (t?.type === 'text') t.content = content
            }, `text-${editingEl.id}`)
          }
          onDone={(content) => {
            if (!content.trim()) {
              editPage((pg) => void (pg.elements = pg.elements.filter((x) => x.id !== editingEl.id)))
              onSelect([])
            }
            onEditText(null)
          }}
        />
      )}
    </div>
  )
}

/** MIME-Typ für Medien, die aus der Bibliothek auf die Folie gezogen werden. */
export const ASSET_MIME = 'application/x-studio-asset'

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
