import { Fragment, type ReactElement, type ReactNode } from 'react'

/**
 * Minimales Inline-Markup für Text-Elemente: **fett**, *kursiv*, \n für Zeilenumbruch.
 * `split` zerlegt den Text für Builds in Wörter (.w) oder Zeilen (.ln).
 * `count` markiert die erste Zahl als .count – Ziel für den Hochzähl-Build.
 */
export type TextSplit = 'none' | 'word' | 'line'

export function renderInline(content: string, split: TextSplit = 'none', count = false): ReactNode {
  let counted = false
  return content.split('\n').map((line, i) => {
    let parts = renderLine(line, split)
    if (count && !counted) {
      const marked = markFirstNumber(parts)
      counted = marked.found
      parts = marked.nodes
    }
    if (split === 'line') {
      return (
        <span key={i} className="ln">
          {parts}
        </span>
      )
    }
    return (
      <Fragment key={i}>
        {i > 0 && <br />}
        {parts}
      </Fragment>
    )
  })
}

function renderLine(line: string, split: TextSplit): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  const push = (text: string, wrap?: 'strong' | 'em') => {
    const pieces = split === 'word' ? text.split(/(\s+)/) : [text]
    pieces.forEach((piece) => {
      if (!piece) return
      const key = out.length
      let node: ReactNode = piece
      if (wrap === 'strong') node = <strong key={key}>{piece}</strong>
      if (wrap === 'em') node = <em key={key}>{piece}</em>
      if (split === 'word' && piece.trim()) {
        node = (
          <span key={key} className="w">
            {node}
          </span>
        )
      }
      out.push(typeof node === 'string' ? <Fragment key={key}>{node}</Fragment> : node)
    })
  }
  for (const m of line.matchAll(re)) {
    if (m.index > last) push(line.slice(last, m.index))
    push(m[1] ?? m[2] ?? '', m[1] !== undefined ? 'strong' : 'em')
    last = m.index + m[0].length
  }
  if (last < line.length) push(line.slice(last))
  return out
}

const NUMBER = /\d+(?:[.,]\d+)*/

/** Umschließt die erste Zahl in reinem Text (nicht in fett/kursiv) mit <span class="count">. */
function markFirstNumber(nodes: ReactNode[]): { nodes: ReactNode[]; found: boolean } {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const text = isTextFragment(node) ? (node.props.children as string) : null
    const m = text?.match(NUMBER)
    if (!text || !m || m.index === undefined) continue
    const before = text.slice(0, m.index)
    const after = text.slice(m.index + m[0].length)
    const replaced = (
      <Fragment key={`count-${i}`}>
        {before}
        <span className="count" data-value={m[0]}>
          {m[0]}
        </span>
        {after}
      </Fragment>
    )
    return { nodes: [...nodes.slice(0, i), replaced, ...nodes.slice(i + 1)], found: true }
  }
  return { nodes, found: false }
}

function isTextFragment(node: ReactNode): node is ReactElement<{ children: unknown }> {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === Fragment &&
    typeof (node.props as { children: unknown }).children === 'string'
  )
}

/** "1.250" → 1250, "3,5" → 3.5 (deutsche Schreibweise). Gibt auch die Nachkommastellen zurück. */
export function parseGermanNumber(text: string): { value: number; decimals: number } {
  const [int = '0', dec = ''] = text.split(',')
  const value = Number(int.replace(/\./g, '') + (dec ? '.' + dec : ''))
  return { value: Number.isFinite(value) ? value : 0, decimals: dec.length }
}

export function formatGermanNumber(value: number, decimals: number, grouping: boolean): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  })
}
