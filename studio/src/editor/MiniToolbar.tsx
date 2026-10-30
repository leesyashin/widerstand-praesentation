import type { Draft } from 'immer'
import { useState } from 'react'
import { resolveColor } from '../engine/brand'
import type { Animation, Element, TextStyle } from '../schema/deck'
import { Icon } from '../ui/Icon'
import { PRESETS, TEXT_STYLE_OPTIONS } from './Inspector'
import type { AlignKind } from './model'

type Props = {
  elements: Element[]
  brand: Record<string, string>
  /** Ändert alle ausgewählten Elemente (ein Verlaufsschritt). */
  editEach: (recipe: (el: Draft<Element>, index: number) => void, merge?: string) => void
  onAlign: (kind: AlignKind) => void
  onGroup: () => void
  onUngroup: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const ALIGN: { kind: AlignKind; icon: 'alignLeft' | 'alignHCenter' | 'alignRight' | 'alignTop' | 'alignVCenter' | 'alignBottom'; title: string }[] = [
  { kind: 'left', icon: 'alignLeft', title: 'Links ausrichten' },
  { kind: 'hcenter', icon: 'alignHCenter', title: 'Horizontal zentrieren' },
  { kind: 'right', icon: 'alignRight', title: 'Rechts ausrichten' },
  { kind: 'top', icon: 'alignTop', title: 'Oben ausrichten' },
  { kind: 'vcenter', icon: 'alignVCenter', title: 'Vertikal zentrieren' },
  { kind: 'bottom', icon: 'alignBottom', title: 'Unten ausrichten' },
]

/** Schwebende Mini-Toolbar am ausgewählten Element: das Schnelle direkt an der Folie. */
export function MiniToolbar({ elements, brand, editEach, onAlign, onGroup, onUngroup, onDuplicate, onDelete }: Props) {
  const [colorOpen, setColorOpen] = useState(false)
  const el = elements.length === 1 ? elements[0] : undefined
  const multi = elements.length > 1
  const grouped = elements.some((e) => e.group)
  const sameGroup = multi && elements.every((e) => e.group && e.group === elements[0]!.group)

  const colorOf = (e: Element): string | undefined =>
    e.type === 'text' || e.type === 'icon' || e.type === 'chart' ? e.color : e.type === 'shape' ? (e.shape === 'line' || e.shape === 'arrow' ? e.stroke?.color : e.fill) : undefined
  const colorable = elements.filter((e) => ['text', 'icon', 'chart', 'shape'].includes(e.type))
  const current = colorable[0] ? colorOf(colorable[0]) : undefined

  const setColor = (token: string) =>
    editEach((x) => {
      if (x.type === 'text' || x.type === 'icon' || x.type === 'chart') x.color = token
      if (x.type === 'shape') {
        if (x.shape === 'line' || x.shape === 'arrow') x.stroke = { width: x.stroke?.width ?? 4, color: token }
        else x.fill = token
      }
    })

  const preset = elements[0]?.build?.in?.preset
  const samePreset = elements.every((e) => e.build?.in?.preset === preset)
  const setPreset = (p: Animation['preset'] | 'none') =>
    editEach((x, i) => {
      if (p === 'none') {
        if (x.build) delete x.build.in
        if (x.build && !x.build.out) delete x.build
        return
      }
      const fresh = !x.build?.in
      x.build ??= {}
      x.build.in = { ...x.build.in, preset: p }
      // Mehrere neu animierte Elemente: erstes per Klick, der Rest gleichzeitig.
      if (fresh && i > 0) x.build.trigger = 'withPrevious'
    })

  return (
    <div className="mini-toolbar material" onPointerDown={(e) => e.stopPropagation()}>
      {el?.type === 'text' && (
        <>
          <select
            className="mini-select"
            title="Textstil"
            value={el.style ?? 'body'}
            onChange={(e) => editEach((x) => void (x.type === 'text' && (x.style = e.target.value as TextStyle)))}
          >
            {TEXT_STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mini-segment">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={(el.align ?? 'left') === a ? 'is-on' : ''}
                title={{ left: 'Linksbündig', center: 'Zentriert', right: 'Rechtsbündig' }[a]}
                onClick={() => editEach((x) => void (x.type === 'text' && (x.align = a === 'left' ? undefined : a)))}
              >
                <Icon name={a === 'left' ? 'alignLeft' : a === 'center' ? 'alignHCenter' : 'alignRight'} size={14} />
              </button>
            ))}
          </span>
        </>
      )}

      {multi && (
        <span className="mini-segment">
          {ALIGN.map((a) => (
            <button key={a.kind} type="button" title={a.title} onClick={() => onAlign(a.kind)}>
              <Icon name={a.icon} size={14} />
            </button>
          ))}
        </span>
      )}
      {!multi && el && (
        <span className="mini-segment">
          <button type="button" title="Auf der Folie horizontal zentrieren" onClick={() => onAlign('hcenter')}>
            <Icon name="alignHCenter" size={14} />
          </button>
          <button type="button" title="Auf der Folie vertikal zentrieren" onClick={() => onAlign('vcenter')}>
            <Icon name="alignVCenter" size={14} />
          </button>
        </span>
      )}

      {colorable.length > 0 && (
        <span className="mini-color">
          <button type="button" className="mini-btn" title="Farbe" onClick={() => setColorOpen((o) => !o)}>
            <span className="mini-color__dot" style={{ background: resolveColor(current) ?? 'transparent' }} />
          </button>
          {colorOpen && (
            <span className="mini-color__pop material">
              {Object.entries(brand).map(([token, hex]) => (
                <button
                  key={token}
                  type="button"
                  className={`swatch ${current === `brand.${token}` ? 'is-on' : ''}`}
                  style={{ background: hex }}
                  title={`brand.${token}`}
                  onClick={() => {
                    setColor(`brand.${token}`)
                    setColorOpen(false)
                  }}
                />
              ))}
            </span>
          )}
        </span>
      )}

      <span className="mini-sep" />
      <select
        className="mini-select"
        title="Einblenden"
        value={samePreset ? (preset ?? 'none') : ''}
        onChange={(e) => setPreset(e.target.value as Animation['preset'] | 'none')}
      >
        {!samePreset && <option value="">Gemischt</option>}
        <option value="none">Kein Build</option>
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <span className="mini-sep" />

      {multi && !sameGroup && (
        <button type="button" className="mini-btn" title="Gruppieren (⌥⌘G)" onClick={onGroup}>
          <Icon name="group" size={14} />
        </button>
      )}
      {grouped && (
        <button type="button" className="mini-btn" title="Gruppe auflösen (⇧⌥⌘G)" onClick={onUngroup}>
          <Icon name="ungroup" size={14} />
        </button>
      )}
      <button type="button" className="mini-btn" title="Duplizieren (⌘D)" onClick={onDuplicate}>
        <Icon name="copy" size={14} />
      </button>
      <button type="button" className="mini-btn" title="Löschen (⌫)" onClick={onDelete}>
        <Icon name="trash" size={14} />
      </button>
    </div>
  )
}
