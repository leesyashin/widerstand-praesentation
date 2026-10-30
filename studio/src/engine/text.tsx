import { Fragment, type ReactNode } from 'react'

/** Minimales Inline-Markup für Text-Elemente: **fett**, *kursiv*, \n für Zeilenumbruch. */
export function renderInline(content: string): ReactNode {
  return content.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderLine(line)}
    </Fragment>
  ))
}

function renderLine(line: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  for (const m of line.matchAll(re)) {
    if (m.index > last) out.push(line.slice(last, m.index))
    out.push(m[1] !== undefined ? <strong key={m.index}>{m[1]}</strong> : <em key={m.index}>{m[2]}</em>)
    last = m.index + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}
