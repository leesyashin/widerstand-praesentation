import type { Draft } from 'immer'
import { useState, type DragEvent as ReactDragEvent } from 'react'
import type { Element } from '../schema/deck'
import { Icon, type IconName } from '../ui/Icon'
import type { Page } from './model'

type Props = {
  page: Page
  /** Master der Folie (liegt hinter allen Ebenen). */
  master?: { name: string; count: number } | null
  selected: string[]
  onSelect: (ids: string[]) => void
  editPage: (recipe: (page: Draft<Page>) => void, merge?: string) => void
}

const TYPE_ICON: Record<Element['type'], IconName> = {
  text: 'text',
  image: 'image',
  video: 'play',
  shape: 'shape',
  icon: 'icon',
  chart: 'chart',
  lottie: 'sparkle',
  custom: 'stack',
}

export function layerName(el: Element): string {
  if (el.name) return el.name
  if (el.type === 'text') return el.content.replace(/\*+/g, '').split('\n')[0]!.slice(0, 40) || el.id
  return el.id
}

type Row = { kind: 'group'; group: string; ids: string[] } | { kind: 'element'; el: Element; inGroup: boolean }

/** Ebenen-Liste: oberste Ebene zuerst. Ziehen ordnet um, Auge/Schloss blenden aus bzw. sperren. */
export function Layers({ page, master, selected, onSelect, editPage }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; above: boolean } | null>(null)

  // Oberste Ebene zuerst; zusammenhängende Gruppenmitglieder unter einer Kopfzeile.
  const top = [...page.elements].reverse()
  const rows: Row[] = []
  top.forEach((el, i) => {
    const prev = top[i - 1]
    if (el.group && prev?.group !== el.group) {
      const ids: string[] = []
      for (let j = i; j < top.length && top[j]!.group === el.group; j++) ids.push(top[j]!.id)
      rows.push({ kind: 'group', group: el.group, ids })
    }
    rows.push({ kind: 'element', el, inGroup: Boolean(el.group) })
  })

  const click = (ids: string[], e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const all = ids.every((id) => selected.includes(id))
      onSelect(all ? selected.filter((id) => !ids.includes(id)) : [...selected, ...ids.filter((id) => !selected.includes(id))])
    } else onSelect(ids)
  }

  const toggle = (ids: string[], key: 'hidden' | 'locked') =>
    editPage((p) => {
      const targets = p.elements.filter((e) => ids.includes(e.id))
      const on = !targets.every((e) => e[key])
      for (const e of targets) {
        if (on) e[key] = true
        else delete e[key]
      }
    })

  const onDragStart = (e: ReactDragEvent, ids: string[]) => {
    e.dataTransfer.setData('application/x-studio-layer', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: ReactDragEvent, id: string) => {
    if (![...e.dataTransfer.types].includes('application/x-studio-layer')) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    setDropAt({ id, above: e.clientY < r.top + r.height / 2 })
  }
  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    const target = dropAt
    setDropAt(null)
    if (!target) return
    const ids = JSON.parse(e.dataTransfer.getData('application/x-studio-layer') || '[]') as string[]
    if (!ids.length || ids.includes(target.id)) return
    editPage((p) => {
      const moving = p.elements.filter((x) => ids.includes(x.id))
      const rest = p.elements.filter((x) => !ids.includes(x.id))
      const r = rest.findIndex((x) => x.id === target.id)
      if (r < 0) return
      // Liste zeigt oben = vorne: „über“ einer Zeile heißt im Array danach.
      const at = target.above ? r + 1 : r
      p.elements = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
      // Einzelne Elemente übernehmen die Gruppe, wenn sie zwischen zwei Mitglieder fallen.
      if (moving.length === 1) {
        const el = moving[0]!
        const prev = p.elements[at - 1]
        const next = p.elements[at + 1]
        if (prev?.group && prev.group === next?.group) el.group = prev.group
        else if (el.group && prev?.group !== el.group && next?.group !== el.group) delete el.group
      }
    })
  }

  return (
    <div className="layers-panel" onDragLeave={() => setDropAt(null)}>
      {rows.length === 0 && <p className="field-hint muted">Keine Elemente auf dieser Folie.</p>}
      <ul className="layer-list" onDrop={onDrop}>
        {rows.map((row) => {
          if (row.kind === 'group') {
            const members = page.elements.filter((e) => row.ids.includes(e.id))
            const isSel = row.ids.every((id) => selected.includes(id))
            const hidden = members.every((m) => m.hidden)
            const locked = members.every((m) => m.locked)
            const firstId = row.ids[0]!
            return (
              <li
                key={`g-${row.group}-${firstId}`}
                className={`layer layer--group ${isSel ? 'is-selected' : ''} ${dropAt?.id === firstId ? (dropAt.above ? 'drop-above' : '') : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, row.ids)}
                onDragOver={(e) => onDragOver(e, firstId)}
                onClick={(e) => click(row.ids, e)}
              >
                <Icon name="group" size={14} />
                <span className="layer__name">{row.group.replace(/-/g, ' ')}</span>
                <LayerToggles hidden={hidden} locked={locked} onHide={() => toggle(row.ids, 'hidden')} onLock={() => toggle(row.ids, 'locked')} />
              </li>
            )
          }
          const el = row.el
          const isSel = selected.includes(el.id)
          const drop = dropAt?.id === el.id ? (dropAt.above ? 'drop-above' : 'drop-below') : ''
          return (
            <li
              key={el.id}
              className={`layer ${row.inGroup ? 'layer--member' : ''} ${isSel ? 'is-selected' : ''} ${el.hidden ? 'is-hidden' : ''} ${drop}`}
              draggable={renaming !== el.id}
              onDragStart={(e) => onDragStart(e, [el.id])}
              onDragOver={(e) => onDragOver(e, el.id)}
              onClick={(e) => click([el.id], e)}
              onDoubleClick={() => setRenaming(el.id)}
            >
              <Icon name={TYPE_ICON[el.type]} size={14} />
              {renaming === el.id ? (
                <input
                  className="field field--sm layer__rename"
                  autoFocus
                  defaultValue={el.name ?? ''}
                  placeholder={layerName(el)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    editPage((p) => {
                      const t = p.elements.find((x) => x.id === el.id)
                      if (t) t.name = v || undefined
                    })
                    setRenaming(null)
                  }}
                />
              ) : (
                <span className="layer__name" title={`${el.id} · Doppelklick zum Umbenennen`}>
                  {layerName(el)}
                </span>
              )}
              {el.match && <span className="layer__tag" title={`Magic Move: ${el.match}`}>MM</span>}
              <LayerToggles
                hidden={Boolean(el.hidden)}
                locked={Boolean(el.locked)}
                onHide={() => toggle([el.id], 'hidden')}
                onLock={() => toggle([el.id], 'locked')}
              />
            </li>
          )
        })}
        {master && (
          <li className="layer layer--master" title="Elemente der Master-Folie – bearbeiten über „Master“ in der Toolbar">
            <Icon name="master" size={14} />
            <span className="layer__name">
              {master.name} · {master.count} {master.count === 1 ? 'Element' : 'Elemente'}
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}

function LayerToggles({ hidden, locked, onHide, onLock }: { hidden: boolean; locked: boolean; onHide: () => void; onLock: () => void }) {
  return (
    <span className="layer__toggles">
      <button
        type="button"
        className={`layer__btn ${hidden ? 'is-on' : ''}`}
        title={hidden ? 'Einblenden' : 'Ausblenden'}
        onClick={(e) => {
          e.stopPropagation()
          onHide()
        }}
      >
        <Icon name={hidden ? 'eyeOff' : 'eye'} size={13} />
      </button>
      <button
        type="button"
        className={`layer__btn ${locked ? 'is-on' : ''}`}
        title={locked ? 'Entsperren' : 'Sperren'}
        onClick={(e) => {
          e.stopPropagation()
          onLock()
        }}
      >
        <Icon name={locked ? 'lock' : 'unlock'} size={13} />
      </button>
    </span>
  )
}
