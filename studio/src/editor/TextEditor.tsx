import { useContext, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTextStyles } from '../engine/context'
import { parseMarkup, serializeMarkup, type Span } from '../engine/markup'
import { textCss } from '../engine/SlideView'
import { StageScaleContext } from '../engine/Stage'
import type { Element } from '../schema/deck'
import { MOD } from '../ui/keys'

/**
 * Text direkt auf der Folie bearbeiten – so, wie er auf der Folie aussieht (fett, kursiv, Umbrüche,
 * vertikale Ausrichtung). Intern bleibt es das Markup aus markup.ts: **fett**, *kursiv*, \n.
 *
 * Fett/Kursiv (Strg/⌘ B, I) und Rückgängig laufen über ein eigenes Modell statt execCommand,
 * damit es in Chrome, Edge, Safari und Firefox gleich funktioniert – auch bei Stilen, die schon fett sind.
 */

type TextElement = Extract<Element, { type: 'text' }>
type Sel = { start: number; end: number }

export type TextEditorStart = { mode: 'all' } | { mode: 'point'; x: number; y: number }

export function TextEditor({
  element,
  start,
  onChange,
  onDone,
}: {
  element: TextElement
  start: TextEditorStart
  onChange: (content: string) => void
  onDone: (content: string) => void
}) {
  const styles = useTextStyles()
  const scale = useContext(StageScaleContext)
  const ref = useRef<HTMLDivElement>(null)
  const value = useRef(element.content)
  const history = useRef<{ content: string; sel: Sel; at: number }[]>([])
  const future = useRef<{ content: string; sel: Sel }[]>([])
  const done = useRef(false)
  const [marks, setMarks] = useState({ bold: false, italic: false })

  // Einmalig aufbauen und Auswahl setzen – danach gehört der Inhalt dem Browser (sonst springt der Cursor).
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    renderInto(root, element.content)
    root.focus({ preventScroll: true })
    if (start.mode === 'point') placeAtPoint(root, start.x, start.y)
    else selectAll(root)
    history.current = [{ content: element.content, sel: getSel(root) ?? { start: 0, end: 0 }, at: 0 }]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = (content: string) => {
    if (content === value.current) return
    value.current = content
    onChange(content)
  }

  /** Stand nach einer Eingabe merken – schnelle Tipp-Folgen werden zu einem Rückgängig-Schritt. */
  const remember = (content: string, sel: Sel) => {
    const h = history.current
    const last = h[h.length - 1]
    const now = performance.now()
    if (last && now - last.at < 600 && h.length > 1) h[h.length - 1] = { content, sel, at: now }
    else h.push({ content, sel, at: now })
    if (h.length > 200) h.shift()
    future.current = []
  }

  const readDom = () => {
    const root = ref.current
    if (!root) return
    const content = serializeMarkup(readSpans(root))
    if (content === value.current) return
    commit(content)
    remember(content, getSel(root) ?? { start: 0, end: 0 })
  }

  const restore = (content: string, sel: Sel) => {
    const root = ref.current
    if (!root) return
    renderInto(root, content)
    setSel(root, sel)
    commit(content)
  }

  const undo = () => {
    const h = history.current
    if (h.length < 2) return
    const current = h.pop()!
    future.current.push(current)
    const prev = h[h.length - 1]!
    prev.at = 0
    restore(prev.content, prev.sel)
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    history.current.push({ ...next, at: 0 })
    restore(next.content, next.sel)
  }

  /** Fett/Kursiv für die Auswahl umschalten (ohne Auswahl: für das Wort am Cursor). */
  const toggle = (mark: 'bold' | 'italic') => {
    const root = ref.current
    if (!root) return
    const lines = parseMarkup(value.current)
    const flat = flatten(lines)
    let sel = getSel(root) ?? { start: 0, end: 0 }
    if (sel.start === sel.end) sel = wordAt(flat.text, sel.start)
    if (sel.start === sel.end) return
    const chars = flat.chars.slice(sel.start, sel.end).filter((c) => c.text !== '\n')
    const on = !chars.every((c) => c[mark])
    for (let i = sel.start; i < sel.end; i++) {
      const c = flat.chars[i]
      if (c && c.text !== '\n') c[mark] = on
    }
    const content = serializeMarkup(unflatten(flat.chars))
    restore(content, sel)
    history.current.push({ content, sel, at: 0 })
    future.current = []
    updateMarks()
  }

  const updateMarks = () => {
    const root = ref.current
    if (!root) return
    const sel = getSel(root)
    if (!sel) return
    const flat = flatten(parseMarkup(value.current))
    const range = sel.start === sel.end ? wordAt(flat.text, sel.start) : sel
    const chars = flat.chars.slice(range.start, Math.max(range.end, range.start + 1)).filter((c) => c.text !== '\n')
    setMarks({ bold: chars.length > 0 && chars.every((c) => c.bold), italic: chars.length > 0 && chars.every((c) => c.italic) })
  }

  const finish = () => {
    if (done.current) return
    done.current = true
    onDone(value.current)
  }

  const insertBreak = () => {
    const root = ref.current
    if (!root) return
    const sel = getSel(root) ?? { start: 0, end: 0 }
    const flat = flatten(parseMarkup(value.current))
    const style = flat.chars[sel.start - 1] ?? flat.chars[sel.start]
    flat.chars.splice(sel.start, sel.end - sel.start, { text: '\n', bold: Boolean(style?.bold), italic: Boolean(style?.italic) })
    const content = serializeMarkup(unflatten(flat.chars))
    const next = { start: sel.start + 1, end: sel.start + 1 }
    restore(content, next)
    remember(content, next)
  }

  const insertText = (text: string) => {
    const root = ref.current
    if (!root) return
    const sel = getSel(root) ?? { start: 0, end: 0 }
    const flat = flatten(parseMarkup(value.current))
    const style = flat.chars[sel.start - 1]
    const clean = text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
    const inserted = [...clean].map((ch) => ({ text: ch, bold: ch !== '\n' && Boolean(style?.bold), italic: ch !== '\n' && Boolean(style?.italic) }))
    flat.chars.splice(sel.start, sel.end - sel.start, ...inserted)
    const content = serializeMarkup(unflatten(flat.chars))
    const next = { start: sel.start + inserted.length, end: sel.start + inserted.length }
    restore(content, next)
    history.current.push({ content, sel: next, at: 0 })
    future.current = []
  }

  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[element.verticalAlign ?? 'top']
  const f = element.frame
  const tilt = element.tilt && (element.tilt.x || element.tilt.y) ? element.tilt : undefined
  const frame: CSSProperties = {
    left: f.x,
    top: f.y,
    width: f.w,
    height: f.h,
    transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
  }

  return (
    <div className="text-editor" style={frame} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div
        className="text-editor__body"
        style={tilt ? { transform: `perspective(1800px) rotateX(${tilt.x ?? 0}deg) rotateY(${tilt.y ?? 0}deg)` } : undefined}
      >
        <div className="el-text" style={{ justifyContent: justify, ...textCss(element, styles) }}>
          <div
            ref={ref}
            className="text-editor__input"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            role="textbox"
            aria-multiline
            onInput={readDom}
            onKeyUp={updateMarks}
            onMouseUp={updateMarks}
            onBlur={finish}
            onBeforeInput={(e) => {
              const type = (e.nativeEvent as InputEvent).inputType
              if (type === 'historyUndo') {
                e.preventDefault()
                undo()
              } else if (type === 'historyRedo') {
                e.preventDefault()
                redo()
              } else if (type === 'formatBold' || type === 'formatItalic') {
                e.preventDefault()
                toggle(type === 'formatBold' ? 'bold' : 'italic')
              } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
                e.preventDefault()
                insertBreak()
              }
            }}
            onPaste={(e) => {
              e.preventDefault()
              insertText(e.clipboardData.getData('text/plain'))
            }}
            onDrop={(e) => {
              e.preventDefault()
              insertText(e.dataTransfer.getData('text/plain'))
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              const mod = e.metaKey || e.ctrlKey
              const key = e.key.toLowerCase()
              if (e.key === 'Escape' || (e.key === 'Enter' && mod)) {
                e.preventDefault()
                ref.current?.blur()
              } else if (e.key === 'Enter') {
                e.preventDefault()
                insertBreak()
              } else if (mod && !e.altKey && (key === 'b' || key === 'i')) {
                e.preventDefault()
                toggle(key === 'b' ? 'bold' : 'italic')
              } else if (mod && !e.altKey && key === 'z') {
                e.preventDefault()
                if (e.shiftKey) redo()
                else undo()
              } else if (mod && !e.altKey && key === 'y') {
                e.preventDefault()
                redo()
              } else if (mod && !e.altKey && key === 'a') {
                e.preventDefault()
                if (ref.current) selectAll(ref.current)
              } else if (e.key === 'Tab') {
                e.preventDefault()
                ref.current?.blur()
              }
            }}
          />
        </div>
      </div>
      <div
        className={`text-editor__bar material ${f.y < 70 / scale ? 'is-below' : ''}`}
        style={{ transform: `scale(${1 / scale})` }}
        onPointerDown={(e) => e.preventDefault()}
      >
        <button type="button" className={marks.bold ? 'is-on' : ''} title={`Fett (${MOD}B)`} onClick={() => toggle('bold')}>
          <b>B</b>
        </button>
        <button type="button" className={marks.italic ? 'is-on' : ''} title={`Kursiv (${MOD}I)`} onClick={() => toggle('italic')}>
          <i>I</i>
        </button>
        <span className="text-editor__sep" />
        <button type="button" className="text-editor__done" title="Fertig (Esc)" onClick={() => ref.current?.blur()}>
          Fertig
        </button>
      </div>
    </div>
  )
}

/* ---------- Modell: Text ↔ Zeichen mit Auszeichnung ---------- */

type Char = Span

function flatten(lines: Span[][]): { chars: Char[]; text: string } {
  const chars: Char[] = []
  lines.forEach((spans, i) => {
    if (i > 0) chars.push({ text: '\n', bold: false, italic: false })
    for (const s of spans) for (const ch of s.text) chars.push({ text: ch, bold: s.bold, italic: s.italic })
  })
  return { chars, text: chars.map((c) => c.text).join('') }
}

function unflatten(chars: Char[]): Span[][] {
  const lines: Span[][] = [[]]
  for (const c of chars) {
    if (c.text === '\n') lines.push([])
    else lines[lines.length - 1]!.push({ ...c })
  }
  return lines
}

/** Wortgrenzen um eine Position (für Fett/Kursiv ohne Auswahl). */
function wordAt(text: string, pos: number): Sel {
  const isWord = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}_\-–'’]/u.test(ch)
  let start = pos
  let end = pos
  while (start > 0 && isWord(text[start - 1])) start--
  while (end < text.length && isWord(text[end])) end++
  return { start, end }
}

/* ---------- DOM ---------- */

/** Markup als DOM (strong/em/br) in den Editor schreiben – ohne innerHTML. */
function renderInto(root: HTMLElement, content: string) {
  root.replaceChildren()
  const lines = parseMarkup(content)
  lines.forEach((spans, i) => {
    if (i > 0) root.append(document.createElement('br'))
    for (const s of spans) {
      let node: Node = document.createTextNode(s.text)
      if (s.italic) {
        const em = document.createElement('em')
        em.append(node)
        node = em
      }
      if (s.bold) {
        const strong = document.createElement('strong')
        strong.append(node)
        node = strong
      }
      root.append(node)
    }
  })
  // Leere letzte Zeile braucht einen Platzhalter, sonst zeigt der Browser sie nicht an.
  if (content.endsWith('\n') || content === '') root.append(document.createElement('br'))
}

type Piece = { node: Node; kind: 'text' | 'break'; start: number; len: number }

/** Alle Text- und Umbruch-Stücke in Lesereihenfolge mit ihrer Position im reinen Text. */
function pieces(root: HTMLElement): { list: Piece[]; length: number } {
  const list: Piece[] = []
  let pos = 0
  const walk = (node: Node, first: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length
      list.push({ node, kind: 'text', start: pos, len })
      pos += len
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      list.push({ node, kind: 'break', start: pos, len: 1 })
      pos += 1
      return
    }
    // Manche Browser legen beim Tippen Absätze (div/p) an – sie zählen als Zeilenumbruch davor.
    const block = node !== root && (node.tagName === 'DIV' || node.tagName === 'P')
    if (block && !first && pos > 0) {
      list.push({ node, kind: 'break', start: pos, len: 1 })
      pos += 1
    }
    node.childNodes.forEach((child, i) => walk(child, i === 0 && first))
  }
  root.childNodes.forEach((child, i) => walk(child, i === 0))
  return { list, length: pos }
}

/** DOM → Zeilen mit Auszeichnung. Der Platzhalter-Umbruch am Ende zählt nicht. */
function readSpans(root: HTMLElement): Span[][] {
  const chars: Char[] = []
  const { list } = pieces(root)
  for (const p of list) {
    if (p.kind === 'break') {
      chars.push({ text: '\n', bold: false, italic: false })
      continue
    }
    const { bold, italic } = marksOf(p.node, root)
    for (const ch of (p.node.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\u200b/g, '')) {
      chars.push({ text: ch, bold, italic })
    }
  }
  const last = list[list.length - 1]
  if (last?.kind === 'break' && last.node instanceof HTMLElement && last.node.tagName === 'BR' && chars[chars.length - 1]?.text === '\n') {
    chars.pop()
  }
  return unflatten(chars)
}

function marksOf(node: Node, root: HTMLElement) {
  let bold = false
  let italic = false
  for (let n = node.parentElement; n && n !== root; n = n.parentElement) {
    const tag = n.tagName
    if (tag === 'STRONG' || tag === 'B') bold = true
    if (tag === 'EM' || tag === 'I') italic = true
  }
  return { bold, italic }
}

/** Position (Knoten, Offset) → Index im reinen Text. */
function indexOf(root: HTMLElement, node: Node, offset: number): number {
  const { list, length } = pieces(root)
  if (node.nodeType === Node.TEXT_NODE) {
    const p = list.find((x) => x.node === node)
    return p ? p.start + Math.min(offset, p.len) : length
  }
  // Element-Position: vor dem Kind Nr. `offset`.
  const child = node.childNodes[offset]
  if (!child) {
    // Hinter dem letzten Kind: Ende aller Stücke in diesem Knoten.
    let end = node === root ? length : 0
    for (const p of list) if (node.contains(p.node)) end = Math.max(end, p.start + p.len)
    return Math.min(end, length)
  }
  const first = list.find((p) => p.node === child || child.contains(p.node))
  return first ? first.start : length
}

function getSel(root: HTMLElement): Sel | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer)) return null
  const a = indexOf(root, r.startContainer, r.startOffset)
  const b = indexOf(root, r.endContainer, r.endOffset)
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

/** Index im reinen Text → DOM-Position. */
function positionAt(root: HTMLElement, index: number): { node: Node; offset: number } {
  const { list } = pieces(root)
  for (const p of list) {
    if (p.kind === 'text' && index <= p.start + p.len && index >= p.start) return { node: p.node, offset: index - p.start }
    if (p.kind === 'break' && index === p.start) {
      const parent = p.node.parentNode!
      return { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, p.node) }
    }
    if (p.kind === 'break' && index === p.start + 1) {
      const parent = p.node.parentNode!
      return { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, p.node) + 1 }
    }
  }
  return { node: root, offset: root.childNodes.length }
}

function setSel(root: HTMLElement, s: Sel) {
  const sel = window.getSelection()
  if (!sel) return
  const a = positionAt(root, s.start)
  const b = positionAt(root, s.end)
  const r = document.createRange()
  r.setStart(a.node, a.offset)
  r.setEnd(b.node, b.offset)
  sel.removeAllRanges()
  sel.addRange(r)
}

function selectAll(root: HTMLElement) {
  const r = document.createRange()
  r.selectNodeContents(root)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}

/** Cursor an die Stelle unter dem Zeiger setzen und das Wort dort markieren (wie Keynote). */
function placeAtPoint(root: HTMLElement, x: number, y: number) {
  type CaretDoc = Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const doc = document as CaretDoc
  let node: Node | null = null
  let offset = 0
  const pos = doc.caretPositionFromPoint?.(x, y)
  if (pos) {
    node = pos.offsetNode
    offset = pos.offset
  } else {
    const r = doc.caretRangeFromPoint?.(x, y)
    if (r) {
      node = r.startContainer
      offset = r.startOffset
    }
  }
  if (!node || !root.contains(node)) {
    // Daneben geklickt: Cursor ans Ende.
    const end = pieces(root).length
    setSel(root, { start: end, end })
    return
  }
  const index = indexOf(root, node, offset)
  const text = pieces(root)
    .list.map((p) => (p.kind === 'break' ? '\n' : (p.node.textContent ?? '')))
    .join('')
  const word = wordAt(text, index)
  setSel(root, word.start === word.end ? { start: index, end: index } : word)
}
