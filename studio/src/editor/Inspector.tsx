import type { Draft } from 'immer'
import { useState, type DragEvent as ReactDragEvent } from 'react'
import { useTextStyles } from '../engine/context'
import { findMaster } from '../engine/masters'
import { computeSteps, PRESET_DURATION } from '../engine/timeline'
import { TRANSITION_DURATION } from '../engine/transitions'
import type { Animation, Build, Deck, DeckTextStyle, Effect, Element, Master, Slide, TextStyle, Transition } from '../schema/deck'
import type { Issue } from '../schema/issues'
import { Icon } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import { ColorField, Group, NumberField, Row, Segmented, Select, Slider, TextField, Toggle } from './fields'
import { layerName } from './Layers'
import { TEXT_OVERRIDES, type AlignKind, type Page } from './model'

export type InspectorTab = 'stil' | 'animation' | 'folie'

type Props = {
  deck: Deck
  /** Bearbeitete Seite: Folie oder Master. */
  page: Page
  isMaster: boolean
  /** Ausgewählte Elemente der Seite. */
  elements: Element[]
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
  edit: (recipe: (draft: Draft<Deck>) => void, merge?: string) => void
  editPage: (recipe: (page: Draft<Page>) => void, merge?: string) => void
  brand: Record<string, string>
  /** Vorschau der Builds, optional ab einem Klick-Schritt. */
  onPreview: (fromStep?: number) => void
  onSelect: (ids: string[]) => void
  onAlign: (kind: AlignKind | 'distributeX' | 'distributeY') => void
  onGroup: () => void
  onUngroup: () => void
  onEditMaster: (id: string) => void
  onNewMaster: () => void
  onOpenFonts: () => void
  saveIssues: Issue[]
}

type ElementProps = Props & { element: Element }

export const TEXT_STYLE_OPTIONS: { value: TextStyle; label: string }[] = [
  { value: 'display', label: 'Display' },
  { value: 'title', label: 'Titel' },
  { value: 'heading', label: 'Überschrift' },
  { value: 'subtitle', label: 'Untertitel' },
  { value: 'body', label: 'Text' },
  { value: 'caption', label: 'Bildunterschrift' },
  { value: 'label', label: 'Label' },
]

export const PRESETS: { value: Animation['preset']; label: string }[] = [
  { value: 'blurRise', label: 'Blur-Rise (Seide)' },
  { value: 'rise', label: 'Aufsteigen' },
  { value: 'fade', label: 'Einblenden' },
  { value: 'scaleIn', label: 'Wachsen' },
  { value: 'maskReveal', label: 'Mask-Reveal' },
  { value: 'wordByWord', label: 'Wort für Wort' },
  { value: 'lineByLine', label: 'Zeile für Zeile' },
  { value: 'drawLine', label: 'Linie zeichnen' },
  { value: 'countUp', label: 'Hochzählen' },
  { value: 'kenBurns', label: 'Ken Burns' },
  { value: 'grow', label: 'Aufbauen (Charts)' },
]

const EASINGS: { value: NonNullable<Animation['easing']>; label: string }[] = [
  { value: 'smooth', label: 'Weich' },
  { value: 'spring', label: 'Feder' },
  { value: 'out', label: 'Auslaufend' },
  { value: 'inOut', label: 'Ein & aus' },
  { value: 'in', label: 'Anlaufend' },
  { value: 'linear', label: 'Linear' },
]

const DIRECTIONS: { value: NonNullable<Animation['direction']>; label: string; title: string }[] = [
  { value: 'up', label: '↑', title: 'Nach oben' },
  { value: 'down', label: '↓', title: 'Nach unten' },
  { value: 'left', label: '←', title: 'Nach links' },
  { value: 'right', label: '→', title: 'Nach rechts' },
]

const TRIGGERS: { value: NonNullable<Build['trigger']>; label: string }[] = [
  { value: 'click', label: 'Bei Klick' },
  { value: 'withPrevious', label: 'Mit vorherigem' },
  { value: 'afterPrevious', label: 'Nach vorherigem' },
]

export const TRANSITIONS: { value: Transition['type']; label: string }[] = [
  { value: 'none', label: 'Keiner' },
  { value: 'blurDissolve', label: 'Blur-Überblenden' },
  { value: 'dissolve', label: 'Überblenden' },
  { value: 'magicMove', label: 'Magic Move' },
  { value: 'push', label: 'Schieben' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'maskReveal', label: 'Kreis-Reveal' },
  { value: 'whipPan', label: 'Whip-Pan' },
  { value: 'camera', label: 'Kamerafahrt' },
  { value: 'lightLeak', label: 'Light Leak' },
]

export function Inspector(props: Props) {
  const { tab, onTab, elements } = props
  const element = elements.length === 1 ? elements[0] : undefined
  return (
    <div className="inspector">
      <div className="inspector__tabs">
        <Segmented
          value={tab}
          onChange={onTab}
          options={[
            { value: 'stil', label: 'Stil' },
            { value: 'animation', label: 'Animation' },
            { value: 'folie', label: 'Folie' },
          ]}
        />
      </div>
      <div className="inspector__body">
        {tab === 'stil' && (element ? <ElementStyle {...props} element={element} /> : elements.length > 1 ? <MultiStyle {...props} /> : <Hint />)}
        {tab === 'animation' &&
          (props.isMaster ? (
            <p className="inspector__hint muted">Elemente auf Master-Folien stehen ruhig – Builds setzt du auf den einzelnen Folien.</p>
          ) : (
            <AnimationTab {...props} />
          ))}
        {tab === 'folie' && (props.isMaster ? <MasterTab {...props} /> : <SlideTab {...props} />)}
        {props.saveIssues.length > 0 && <IssueList title="Speichern fehlgeschlagen" issues={props.saveIssues} />}
      </div>
    </div>
  )
}

function Hint() {
  return (
    <p className="inspector__hint muted">
      Wähle ein Element auf der Folie aus – mit ⇧ mehrere, oder ziehe einen Rahmen. Doppelklick auf Text bearbeitet ihn
      direkt.
    </p>
  )
}

/** Änderung am ausgewählten Element. */
function useElementEdit({ element, editPage }: Pick<ElementProps, 'element' | 'editPage'>) {
  return (recipe: (el: Draft<Element>) => void, merge?: string) =>
    editPage((p) => {
      const el = p.elements.find((e) => e.id === element.id)
      if (el) recipe(el)
    }, merge ? `${merge}-${element.id}` : undefined)
}

/* ---------- Stil ---------- */

function setTilt(e: Draft<Element>, axis: 'x' | 'y', v: number | undefined) {
  const tilt = { ...e.tilt, [axis]: v || undefined }
  if (!tilt.x && !tilt.y) delete e.tilt
  else e.tilt = tilt
}

function ElementStyle(props: ElementProps) {
  const { element: el, brand } = props
  const set = useElementEdit(props)
  const f = el.frame
  return (
    <>
      <Group title="Anordnung">
        <div className="grid2">
          <Row label="X">
            <NumberField value={f.x} onChange={(v) => set((e) => void (e.frame.x = v ?? 0), 'x')} />
          </Row>
          <Row label="Y">
            <NumberField value={f.y} onChange={(v) => set((e) => void (e.frame.y = v ?? 0), 'y')} />
          </Row>
          <Row label="Breite">
            <NumberField value={f.w} min={1} onChange={(v) => set((e) => void (e.frame.w = v ?? 1), 'w')} />
          </Row>
          <Row label="Höhe">
            <NumberField value={f.h} min={1} onChange={(v) => set((e) => void (e.frame.h = v ?? 1), 'h')} />
          </Row>
          <Row label="Drehung">
            <NumberField
              value={f.rotation ?? 0}
              suffix="°"
              min={-360}
              max={360}
              onChange={(v) =>
                set((e) => {
                  if (v) e.frame.rotation = v
                  else delete e.frame.rotation
                }, 'rot')
              }
            />
          </Row>
        </div>
        <div className="grid2">
          <Row label="Tiefe">
            <NumberField
              value={el.depth}
              placeholder="0"
              step={0.5}
              min={-10}
              max={10}
              onChange={(v) => set((e) => void (e.depth = v || undefined), 'depth')}
            />
          </Row>
          <Row label="Kippen">
            <NumberField
              value={el.tilt?.x}
              placeholder="0"
              suffix="°"
              min={-60}
              max={60}
              onChange={(v) => set((e) => setTilt(e, 'x', v), 'tiltx')}
            />
          </Row>
          <Row label="Wenden">
            <NumberField
              value={el.tilt?.y}
              placeholder="0"
              suffix="°"
              min={-60}
              max={60}
              onChange={(v) => set((e) => setTilt(e, 'y', v), 'tilty')}
            />
          </Row>
        </div>
        <Row label="Deckkraft">
          <Slider
            value={el.opacity ?? 1}
            onChange={(v) =>
              set((e) => {
                if (v >= 1) delete e.opacity
                else e.opacity = v
              }, 'opacity')
            }
          />
        </Row>
      </Group>

      {el.type === 'text' && (
        <Group title="Text">
          <textarea
            className="field"
            rows={3}
            value={el.content}
            onChange={(e) => set((x) => void (x.type === 'text' && (x.content = e.target.value)), 'content')}
          />
          <Row label="Stil">
            <Select value={el.style ?? 'body'} onChange={(v) => set((x) => void (x.type === 'text' && (x.style = v)))} options={TEXT_STYLE_OPTIONS} />
          </Row>
          <StyleSync {...props} element={el} />
          <Row label="Größe">
            <NumberField
              value={el.fontSize}
              placeholder="Stil"
              min={4}
              onChange={(v) =>
                set((x) => {
                  if (x.type !== 'text') return
                  if (v === undefined) delete x.fontSize
                  else x.fontSize = v
                }, 'fontSize')
              }
            />
          </Row>
          <Row label="Ausrichtung">
            <Segmented
              value={el.align ?? 'left'}
              onChange={(v) => set((x) => void (x.type === 'text' && (x.align = v)))}
              options={[
                { value: 'left', label: 'Links' },
                { value: 'center', label: 'Mitte' },
                { value: 'right', label: 'Rechts' },
              ]}
            />
          </Row>
          <Row label="Vertikal">
            <Segmented
              value={el.verticalAlign ?? 'top'}
              onChange={(v) => set((x) => void (x.type === 'text' && (x.verticalAlign = v)))}
              options={[
                { value: 'top', label: 'Oben' },
                { value: 'middle', label: 'Mitte' },
                { value: 'bottom', label: 'Unten' },
              ]}
            />
          </Row>
          <Row label="Farbe">
            <ColorField
              brand={brand}
              allowNone
              value={el.color}
              onChange={(v) =>
                set((x) => {
                  if (x.type !== 'text') return
                  if (v === undefined) delete x.color
                  else x.color = v
                }, 'color')
              }
            />
          </Row>
        </Group>
      )}

      {(el.type === 'image' || el.type === 'video') && (
        <Group title={el.type === 'image' ? 'Bild' : 'Video'}>
          <Row label="Datei">
            <TextField
              mono
              value={el.src}
              placeholder="assets/foto.jpg"
              onChange={(v) => set((x) => void ((x.type === 'image' || x.type === 'video') && (x.src = v)), 'src')}
            />
          </Row>
          <Row label="Anpassen">
            <Segmented
              value={el.fit ?? 'cover'}
              onChange={(v) => set((x) => void ((x.type === 'image' || x.type === 'video') && (x.fit = v)))}
              options={[
                { value: 'cover', label: 'Füllen' },
                { value: 'contain', label: 'Einpassen' },
              ]}
            />
          </Row>
          <Row label="Ecken">
            <NumberField
              value={el.radius ?? 0}
              min={0}
              onChange={(v) => set((x) => void ((x.type === 'image' || x.type === 'video') && (x.radius = v || undefined)), 'radius')}
            />
          </Row>
        </Group>
      )}

      {el.type === 'shape' && (
        <Group title="Form">
          <Row label="Art">
            <Select
              value={el.shape}
              onChange={(v) => set((x) => void (x.type === 'shape' && (x.shape = v)))}
              options={[
                { value: 'rect', label: 'Rechteck' },
                { value: 'ellipse', label: 'Ellipse' },
                { value: 'line', label: 'Linie' },
                { value: 'arrow', label: 'Pfeil' },
              ]}
            />
          </Row>
          {(el.shape === 'rect' || el.shape === 'ellipse') && (
            <Row label="Füllung">
              <ColorField
                brand={brand}
                allowNone
                value={el.fill}
                onChange={(v) =>
                  set((x) => {
                    if (x.type !== 'shape') return
                    if (v === undefined) delete x.fill
                    else x.fill = v
                  }, 'fill')
                }
              />
            </Row>
          )}
          <Row label="Kontur">
            <ColorField
              brand={brand}
              allowNone
              value={el.stroke?.color}
              onChange={(v) =>
                set((x) => {
                  if (x.type !== 'shape') return
                  if (v === undefined) delete x.stroke
                  else x.stroke = { color: v, width: x.stroke?.width ?? 2 }
                }, 'stroke')
              }
            />
          </Row>
          {el.stroke && (
            <Row label="Stärke">
              <NumberField
                value={el.stroke.width}
                min={0.5}
                step={0.5}
                onChange={(v) => set((x) => void (x.type === 'shape' && x.stroke && (x.stroke.width = v ?? 1)), 'strokeW')}
              />
            </Row>
          )}
          {(el.shape === 'rect' || el.shape === 'ellipse') && (
            <Row label="Glas">
              <Slider value={el.glass ?? 0} onChange={(v) => set((x) => void (x.type === 'shape' && (x.glass = v > 0 ? v : undefined)), 'glass')} />
            </Row>
          )}
          {el.shape === 'rect' && (
            <Row label="Ecken">
              <NumberField value={el.radius ?? 0} min={0} onChange={(v) => set((x) => void (x.type === 'shape' && (x.radius = v || undefined)), 'radius')} />
            </Row>
          )}
        </Group>
      )}

      {el.type === 'icon' && (
        <Group title="Icon">
          <Row label="Name">
            <TextField mono value={el.icon} placeholder="camera" onChange={(v) => set((x) => void (x.type === 'icon' && (x.icon = v)), 'icon')} />
          </Row>
          <p className="field-hint muted">
            Namen siehe lucide.dev/icons, z. B. camera, aperture, film, sparkles – oder eine SVG-Datei wie assets/zeichen.svg.
          </p>
          <Row label="Farbe">
            <ColorField brand={brand} value={el.color} onChange={(v) => set((x) => void (x.type === 'icon' && (x.color = v)), 'color')} />
          </Row>
          <Row label="Strich">
            <NumberField value={el.strokeWidth ?? 1.5} step={0.25} min={0.25} onChange={(v) => set((x) => void (x.type === 'icon' && (x.strokeWidth = v)), 'sw')} />
          </Row>
        </Group>
      )}

      {el.type === 'chart' && <ChartFields {...props} element={el} />}

      {el.type === 'lottie' && (
        <Group title="Lottie">
          <Row label="Datei">
            <TextField mono value={el.src} placeholder="assets/animation.json" onChange={(v) => set((x) => void (x.type === 'lottie' && (x.src = v)), 'src')} />
          </Row>
          <Row label="Tempo">
            <NumberField value={el.speed ?? 1} step={0.1} min={0.1} max={8} onChange={(v) => set((x) => void (x.type === 'lottie' && (x.speed = v === 1 ? undefined : v)), 'speed')} />
          </Row>
          <Toggle label="Endlos wiederholen" value={Boolean(el.loop)} onChange={(v) => set((x) => void (x.type === 'lottie' && (x.loop = v || undefined)))} />
          <p className="field-hint muted">Export aus After Effects mit Bodymovin als .json in den assets-Ordner legen.</p>
        </Group>
      )}

      {el.type === 'custom' && (
        <Group title={`Komponente ${el.component}`}>
          <PropsEditor value={el.props ?? {}} onChange={(p) => set((x) => void (x.type === 'custom' && (x.props = p)), 'props')} />
        </Group>
      )}

      <Group title="Element">
        <Row label="Name">
          <TextField value={el.name ?? ''} placeholder={el.id} onChange={(v) => set((x) => void (x.name = v || undefined), 'name')} />
        </Row>
        <Row label="Magic Move">
          <TextField
            mono
            value={el.match ?? ''}
            placeholder="Partner-Schlüssel"
            onChange={(v) => set((x) => void (x.match = v.toLowerCase().replace(/[^a-z0-9-]/g, '') || undefined), 'match')}
          />
        </Row>
        <p className="field-hint muted">Gleicher Schlüssel auf der nächsten Folie → das Element fließt per Magic Move hinüber.</p>
        <Toggle label="Gesperrt" value={Boolean(el.locked)} onChange={(v) => set((x) => void (x.locked = v || undefined))} />
        <Toggle label="Ausgeblendet" value={Boolean(el.hidden)} onChange={(v) => set((x) => void (x.hidden = v || undefined))} />
        {el.group && (
          <div className="inline-actions">
            <span className="muted">Gruppe „{el.group.replace(/-/g, ' ')}“</span>
            <button type="button" className="btn" onClick={props.onUngroup}>
              Auflösen
            </button>
          </div>
        )}
      </Group>
    </>
  )
}

/**
 * Textstil abgleichen: eigene Werte des Textes in den Stil übernehmen („Stil aktualisieren“ wirkt dann auf alle
 * Texte dieses Stils im Deck) oder auf den Stil zurücksetzen.
 */
function StyleSync(props: ElementProps & { element: Extract<Element, { type: 'text' }> }) {
  const { element: el, edit, editPage } = props
  const overrides = TEXT_OVERRIDES.filter((k) => el[k] !== undefined)
  if (!overrides.length) return null
  const style = el.style ?? 'body'
  const label = TEXT_STYLE_OPTIONS.find((o) => o.value === style)?.label
  const strip = (p: Draft<Page>) => {
    const t = p.elements.find((x) => x.id === el.id)
    if (t?.type === 'text') for (const k of TEXT_OVERRIDES) delete t[k]
  }
  const update = () => {
    const def: DeckTextStyle = {}
    if (el.font) def.font = el.font
    if (el.fontSize !== undefined) def.size = el.fontSize
    if (el.fontWeight !== undefined) def.weight = el.fontWeight
    if (el.lineHeight !== undefined) def.lineHeight = el.lineHeight
    if (el.letterSpacing !== undefined) def.letterSpacing = el.letterSpacing
    if (el.color) def.color = el.color
    edit((d) => {
      d.textStyles ??= {}
      d.textStyles[style] = { ...d.textStyles[style], ...def }
    })
    editPage(strip)
  }
  return (
    <div className="style-sync">
      <span className="muted">Weicht vom Stil „{label}“ ab</span>
      <span className="inline-actions">
        <button type="button" className="btn" title={`Werte in den Stil „${label}“ übernehmen – wirkt auf alle Texte dieses Stils`} onClick={update}>
          Stil aktualisieren
        </button>
        <button type="button" className="btn btn--plain" title="Eigene Werte entfernen" onClick={() => editPage(strip)}>
          Zurücksetzen
        </button>
      </span>
    </div>
  )
}

/** Mehrere Elemente: ausrichten, verteilen, gruppieren und gemeinsame Werte. */
function MultiStyle(props: Props) {
  const { elements, editPage, onAlign, onGroup, onUngroup } = props
  const ids = elements.map((e) => e.id)
  const each = (recipe: (el: Draft<Element>) => void, merge?: string) =>
    editPage((p) => {
      for (const el of p.elements) if (ids.includes(el.id)) recipe(el)
    }, merge ? `${merge}-multi` : undefined)
  const sameGroup = elements.every((e) => e.group && e.group === elements[0]!.group)
  const opacity = elements[0]?.opacity ?? 1
  const btn = (kind: AlignKind | 'distributeX' | 'distributeY', icon: Parameters<typeof Icon>[0]['name'], title: string, disabled = false) => (
    <button type="button" className="btn btn--icon" title={title} disabled={disabled} onClick={() => onAlign(kind)}>
      <Icon name={icon} />
    </button>
  )
  return (
    <>
      <Group title={`${elements.length} Elemente`}>
        <div className="align-grid">
          {btn('left', 'alignLeft', 'Links ausrichten')}
          {btn('hcenter', 'alignHCenter', 'Horizontal zentrieren')}
          {btn('right', 'alignRight', 'Rechts ausrichten')}
          {btn('distributeX', 'distributeH', 'Horizontal verteilen (ab 3)', elements.length < 3)}
          {btn('top', 'alignTop', 'Oben ausrichten')}
          {btn('vcenter', 'alignVCenter', 'Vertikal zentrieren')}
          {btn('bottom', 'alignBottom', 'Unten ausrichten')}
          {btn('distributeY', 'distributeV', 'Vertikal verteilen (ab 3)', elements.length < 3)}
        </div>
        <div className="inline-actions">
          {!sameGroup && (
            <button type="button" className="btn" onClick={onGroup}>
              <Icon name="group" size={14} /> Gruppieren
            </button>
          )}
          {elements.some((e) => e.group) && (
            <button type="button" className="btn" onClick={onUngroup}>
              <Icon name="ungroup" size={14} /> Auflösen
            </button>
          )}
        </div>
        <Row label="Deckkraft">
          <Slider
            value={opacity}
            onChange={(v) =>
              each((e) => {
                if (v >= 1) delete e.opacity
                else e.opacity = v
              }, 'opacity')
            }
          />
        </Row>
        <Toggle label="Gesperrt" value={elements.every((e) => e.locked)} onChange={(v) => each((x) => void (x.locked = v || undefined))} />
        <Toggle label="Ausgeblendet" value={elements.every((e) => e.hidden)} onChange={(v) => each((x) => void (x.hidden = v || undefined))} />
      </Group>
    </>
  )
}

/** Chart-Daten: Art, Werte, Beschriftungen. */
function ChartFields(props: ElementProps & { element: Extract<Element, { type: 'chart' }> }) {
  const { element: el, brand } = props
  const set = useElementEdit(props)
  const chart = (recipe: (c: Draft<Extract<Element, { type: 'chart' }>>) => void, merge?: string) =>
    set((x) => {
      if (x.type === 'chart') recipe(x)
    }, merge)
  return (
    <Group title="Chart">
      <Row label="Art">
        <Segmented
          value={el.chart}
          onChange={(v) => chart((c) => void (c.chart = v))}
          options={[
            { value: 'bar', label: 'Balken' },
            { value: 'line', label: 'Linie' },
            { value: 'donut', label: 'Ring' },
          ]}
        />
      </Row>
      <div className="chart-data">
        {el.data.map((d, i) => (
          <div key={i} className="chart-data__row">
            <input
              className="field field--sm"
              value={d.label}
              placeholder="Beschriftung"
              onChange={(e) => chart((c) => void (c.data[i] && (c.data[i].label = e.target.value)), `label-${i}`)}
            />
            <NumberField value={d.value} onChange={(v) => chart((c) => void (c.data[i] && (c.data[i].value = v ?? 0)), `value-${i}`)} />
            <button
              type="button"
              className="btn btn--plain btn--icon"
              title="Wert entfernen"
              disabled={el.data.length <= 1}
              onClick={() => chart((c) => void c.data.splice(i, 1))}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          disabled={el.data.length >= 24}
          onClick={() => chart((c) => void c.data.push({ label: `Wert ${c.data.length + 1}`, value: c.data[c.data.length - 1]?.value ?? 10 }))}
        >
          + Wert
        </button>
      </div>
      <div className="grid2">
        <Row label="Einheit">
          <TextField value={el.unit ?? ''} placeholder="%" onChange={(v) => chart((c) => void (c.unit = v || undefined), 'unit')} />
        </Row>
        <Row label="Max">
          <NumberField value={el.max} placeholder="auto" min={0} onChange={(v) => chart((c) => void (c.max = v || undefined), 'max')} />
        </Row>
      </div>
      <Row label="Farbe">
        <ColorField brand={brand} allowNone value={el.color} onChange={(v) => chart((c) => void (c.color = v), 'color')} />
      </Row>
      <Toggle label="Werte zeigen" value={el.showValues ?? true} onChange={(v) => chart((c) => void (c.showValues = v ? undefined : false))} />
      <Toggle label="Beschriftungen zeigen" value={el.showLabels ?? true} onChange={(v) => chart((c) => void (c.showLabels = v ? undefined : false))} />
    </Group>
  )
}

/** Props einer eigenen Komponente als JSON bearbeiten. */
function PropsEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <textarea
        className="field mono"
        rows={6}
        value={text ?? JSON.stringify(value, null, 2)}
        onChange={(e) => {
          setText(e.target.value)
          try {
            const parsed: unknown = JSON.parse(e.target.value)
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Muss ein Objekt sein')
            setError(null)
            onChange(parsed as Record<string, unknown>)
          } catch (err) {
            setError((err as Error).message)
          }
        }}
        onBlur={() => setText(null)}
      />
      {error && <p className="field-hint field-hint--error">{error}</p>}
    </>
  )
}

/* ---------- Animation ---------- */

function AnimationTab(props: Props) {
  const { page, elements, onPreview } = props
  const slide = page as Slide
  const element = elements.length === 1 ? elements[0] : undefined
  const steps = computeSteps(slide)
  const clicks = steps.length - 1
  return (
    <>
      <Group>
        <div className="anim-summary">
          <span className="muted">
            {clicks === 0 ? 'Keine Klicks' : clicks === 1 ? '1 Klick' : `${clicks} Klicks`}
            {steps[0]?.items.length ? ' · Automatik beim Betreten' : ''}
          </span>
          <button type="button" className="btn" onClick={() => onPreview()}>
            ▶ Vorschau
          </button>
        </div>
      </Group>
      {element ? <ElementAnimation {...props} element={element} /> : elements.length > 1 ? null : <Hint />}
      <BuildOrder {...props} slide={slide} />
    </>
  )
}

function ElementAnimation(props: ElementProps) {
  const { element: el } = props
  const set = useElementEdit(props)
  const build = el.build
  const setAnim = (kind: 'in' | 'out', preset: Animation['preset'] | 'none') =>
    set((x) => {
      if (preset === 'none') {
        if (x.build) delete x.build[kind]
        if (x.build && !x.build.in && !x.build.out) delete x.build
        return
      }
      x.build ??= {}
      x.build[kind] = { ...x.build[kind], preset }
    })
  return (
    <>
      <Group title="Einblenden">
        <AnimFields kind="in" anim={build?.in} setAnim={setAnim} set={set} />
        {build?.in && (
          <Row label="Start">
            <Select
              value={build.trigger ?? 'click'}
              options={TRIGGERS}
              onChange={(v) => set((x) => void (x.build && (x.build.trigger = v === 'click' ? undefined : v)))}
            />
          </Row>
        )}
      </Group>
      <Group title="Ausblenden">
        <AnimFields kind="out" anim={build?.out} setAnim={setAnim} set={set} />
      </Group>
    </>
  )
}

function AnimFields({
  kind,
  anim,
  setAnim,
  set,
}: {
  kind: 'in' | 'out'
  anim: Animation | undefined
  setAnim: (kind: 'in' | 'out', preset: Animation['preset'] | 'none') => void
  set: (recipe: (el: Draft<Element>) => void, merge?: string) => void
}) {
  const patch = (p: Partial<Animation>, merge?: string) =>
    set((x) => {
      const a = x.build?.[kind]
      if (!a) return
      for (const [k, v] of Object.entries(p)) {
        if (v === undefined) delete (a as Record<string, unknown>)[k]
        else (a as Record<string, unknown>)[k] = v
      }
    }, merge)
  return (
    <>
      <Row label="Effekt">
        <Select
          value={anim?.preset ?? 'none'}
          options={[{ value: 'none' as const, label: 'Keiner' }, ...PRESETS]}
          onChange={(v) => setAnim(kind, v)}
        />
      </Row>
      {anim && (
        <>
          <div className="grid2">
            <Row label="Dauer">
              <NumberField
                value={anim.duration}
                placeholder={String(PRESET_DURATION[anim.preset])}
                suffix="ms"
                step={50}
                min={0}
                max={20000}
                onChange={(v) => patch({ duration: v }, `${kind}-dur`)}
              />
            </Row>
            <Row label="Verzög.">
              <NumberField
                value={anim.delay}
                placeholder="0"
                suffix="ms"
                step={50}
                min={0}
                max={20000}
                onChange={(v) => patch({ delay: v || undefined }, `${kind}-delay`)}
              />
            </Row>
          </div>
          <Row label="Kurve">
            <Select value={anim.easing ?? 'smooth'} options={EASINGS} onChange={(v) => patch({ easing: v === 'smooth' ? undefined : v })} />
          </Row>
          {['rise', 'blurRise', 'maskReveal', 'wordByWord', 'lineByLine'].includes(anim.preset) && (
            <Row label="Richtung">
              <Segmented
                value={anim.direction ?? (anim.preset === 'maskReveal' ? 'right' : 'up')}
                options={DIRECTIONS}
                onChange={(v) => patch({ direction: v })}
              />
            </Row>
          )}
        </>
      )}
    </>
  )
}

const PRESET_LABEL = Object.fromEntries(PRESETS.map((p) => [p.value, p.label])) as Record<Animation['preset'], string>

/**
 * Reihenfolge aller Builds der Folie: ziehen ordnet um (schreibt `build.order`), „Start“ wählt Klick/mit/nach,
 * ▶ spielt ab diesem Schritt. Klick auf eine Zeile wählt das Element aus.
 */
function BuildOrder(props: Props & { slide: Slide }) {
  const { slide, elements, editPage, onSelect, onPreview } = props
  const [dropAt, setDropAt] = useState<{ id: string; before: boolean } | null>(null)
  const steps = computeSteps(slide)
  if (steps.every((s) => !s.items.length)) return null
  // Einblendungen in Abspielfolge – nur sie lassen sich umsortieren; Ausblendungen folgen automatisch danach.
  const ins = steps.flatMap((s) => s.items.filter((it) => it.kind === 'in').map((it) => it.element.id))

  const reorder = (id: string, target: { id: string; before: boolean }) => {
    const list = ins.filter((x) => x !== id)
    const at = list.indexOf(target.id) + (target.before ? 0 : 1)
    list.splice(at, 0, id)
    editPage((p) => {
      p.elements.forEach((e) => {
        const i = list.indexOf(e.id)
        if (i >= 0 && e.build) e.build.order = i
      })
    })
  }
  const setTrigger = (id: string, trigger: NonNullable<Build['trigger']>) =>
    editPage((p) => {
      const e = p.elements.find((x) => x.id === id)
      if (e?.build) e.build.trigger = trigger === 'click' ? undefined : trigger
    })

  return (
    <Group title="Reihenfolge">
      <ol className="build-list" onDragLeave={() => setDropAt(null)}>
        {steps.map((step, i) =>
          step.items.length ? (
            <li key={i} className="build-step">
              <div className="build-step__head">
                <span>{i === 0 ? 'Automatisch beim Betreten' : `Klick ${i}`}</span>
                <button type="button" className="btn btn--plain btn--icon" title={i === 0 ? 'Vorschau' : `Vorschau ab Klick ${i}`} onClick={() => onPreview(i)}>
                  ▶
                </button>
              </div>
              {step.items.map((it, j) => {
                const el = it.element
                const isIn = it.kind === 'in'
                const drop = dropAt?.id === el.id && isIn ? (dropAt.before ? 'drop-above' : 'drop-below') : ''
                return (
                  <div
                    key={`${el.id}-${it.kind}`}
                    className={`build-item ${elements.some((e) => e.id === el.id) ? 'is-selected' : ''} ${drop}`}
                    draggable={isIn}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-studio-build', el.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      if (!isIn || ![...e.dataTransfer.types].includes('application/x-studio-build')) return
                      e.preventDefault()
                      const r = e.currentTarget.getBoundingClientRect()
                      setDropAt({ id: el.id, before: e.clientY < r.top + r.height / 2 })
                    }}
                    onDrop={(e: ReactDragEvent) => {
                      e.preventDefault()
                      const id = e.dataTransfer.getData('application/x-studio-build')
                      if (dropAt && id && id !== dropAt.id) reorder(id, dropAt)
                      setDropAt(null)
                    }}
                    onClick={() => onSelect([el.id])}
                  >
                    <span className="build-item__grip" aria-hidden>
                      {isIn ? '⋮⋮' : ''}
                    </span>
                    <span className="build-item__name">
                      {layerName(el)}
                      <span className="muted"> · {PRESET_LABEL[it.anim.preset]}{isIn ? '' : ' (aus)'}</span>
                    </span>
                    {isIn && !(i === 0 && j === 0 && !el.build?.trigger) && (
                      <select
                        className="build-item__trigger"
                        value={el.build?.trigger ?? 'click'}
                        title="Start"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setTrigger(el.id, e.target.value as NonNullable<Build['trigger']>)}
                      >
                        {TRIGGERS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {{ click: 'Klick', withPrevious: 'Mit vorh.', afterPrevious: 'Nach vorh.' }[t.value]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </li>
          ) : null,
        )}
      </ol>
      <p className="field-hint muted">Ziehen ändert die Reihenfolge der Einblendungen. Ausblendungen kommen danach.</p>
    </Group>
  )
}

/* ---------- Folie ---------- */

type PageSetter = (recipe: (p: Draft<Page>) => void, merge?: string) => void

function SlideTab(props: Props) {
  const { deck, page, edit, editPage, onEditMaster, onNewMaster } = props
  const slide = page as Slide
  const si = deck.slides.findIndex((s) => s.id === slide.id)
  const setSlide = (recipe: (s: Draft<Slide>) => void, merge?: string) =>
    editPage((p) => recipe(p as Draft<Slide>), merge ? `${merge}-${slide.id}` : undefined)
  const master = findMaster(deck, slide.master)
  const transition = slide.transition
  return (
    <>
      <Group title="Master-Folie">
        <Row label="Master">
          <Select
            value={slide.master ?? ''}
            options={[{ value: '', label: 'Keiner' }, ...(deck.masters ?? []).map((m) => ({ value: m.id, label: m.name ?? m.id }))]}
            onChange={(v) => setSlide((s) => void (s.master = v || undefined))}
          />
        </Row>
        {master && (slide.background || slide.effects) && (
          <div className="inline-actions">
            <span className="muted">Eigener Hintergrund überdeckt den Master.</span>
            <button
              type="button"
              className="btn"
              onClick={() =>
                setSlide((s) => {
                  delete s.background
                  delete s.effects
                })
              }
            >
              Vom Master
            </button>
          </div>
        )}
        <div className="inline-actions">
          {master && (
            <button type="button" className="btn" onClick={() => onEditMaster(master.id)}>
              Master bearbeiten
            </button>
          )}
          <button type="button" className="btn" onClick={onNewMaster} title="Hintergrund, Effekte und ausgewählte Elemente werden zum Master">
            Neuer Master aus Folie
          </button>
        </div>
      </Group>

      <Group title="Übergang zu dieser Folie">
        <Row label="Art">
          <Select
            value={transition?.type ?? 'none'}
            options={TRANSITIONS}
            onChange={(v) =>
              setSlide((s) => {
                if (v === 'none') delete s.transition
                else s.transition = { type: v }
              })
            }
          />
        </Row>
        {transition && transition.type !== 'none' && (
          <Row label="Dauer">
            <NumberField
              value={transition.duration}
              placeholder={String(TRANSITION_DURATION[transition.type])}
              suffix="ms"
              step={50}
              min={0}
              onChange={(v) =>
                setSlide((s) => {
                  if (!s.transition) return
                  if (v === undefined) delete s.transition.duration
                  else s.transition.duration = v
                }, 'tdur')
              }
            />
          </Row>
        )}
        {(transition?.type === 'push' || transition?.type === 'whipPan') && (
          <Row label="Richtung">
            <Segmented
              value={transition.direction ?? 'left'}
              options={DIRECTIONS}
              onChange={(v) => setSlide((s) => void (s.transition && (s.transition.direction = v)))}
            />
          </Row>
        )}
      </Group>

      <BackgroundGroup {...props} set={(r, m) => editPage(r, m ? `${m}-${slide.id}` : undefined)} inherited={master && !slide.background ? master.background : undefined} />
      <EffectsGroup {...props} set={(r, m) => editPage(r, m ? `${m}-${slide.id}` : undefined)} />

      <Group title="Raum (Kamerafahrt)">
        <div className="grid2">
          {(['x', 'y', 'z', 'rotate', 'scale'] as const).map((k) => (
            <Row key={k} label={{ x: 'X', y: 'Y', z: 'Tiefe', rotate: 'Drehung', scale: 'Maßstab' }[k]}>
              <NumberField
                value={slide.world?.[k]}
                placeholder={k === 'scale' ? '1' : k === 'x' ? String(Math.round(si * deck.format.width * 1.25)) : '0'}
                step={k === 'scale' ? 0.1 : 10}
                min={k === 'scale' ? 0.1 : undefined}
                onChange={(v) =>
                  setSlide((s) => {
                    const w = { x: si * deck.format.width * 1.25, y: 0, ...s.world }
                    if (v === undefined && k !== 'x' && k !== 'y') delete w[k]
                    else w[k] = v ?? 0
                    s.world = w
                  }, `world-${k}`)
                }
              />
            </Row>
          ))}
        </div>
        <p className="field-hint muted">Wirkt mit dem Übergang „Kamerafahrt“. Anordnen geht am einfachsten in der Raum-Ansicht.</p>
      </Group>

      <DeckGroup {...props} edit={edit} />

      <Group title="Notizen">
        <textarea
          className="field"
          rows={5}
          placeholder="Notizen für die Referentenansicht …"
          value={slide.notes ?? ''}
          onChange={(e) => setSlide((s) => void (s.notes = e.target.value || undefined), 'notes')}
        />
        <Toggle label="Beim Präsentieren überspringen" value={Boolean(slide.skip)} onChange={(v) => setSlide((s) => void (s.skip = v || undefined))} />
      </Group>
    </>
  )
}

/** Folie-Tab im Master-Modus: Name, Hintergrund, Effekte – wirkt auf alle Folien mit diesem Master. */
function MasterTab(props: Props) {
  const { deck, page, editPage } = props
  const master = page as Master
  const users = deck.slides.filter((s) => s.master === master.id).length
  return (
    <>
      <Group title="Master-Folie">
        <Row label="Name">
          <TextField value={master.name ?? ''} placeholder={master.id} onChange={(v) => editPage((p) => void ((p as Draft<Master>).name = v || undefined), `mname-${master.id}`)} />
        </Row>
        <p className="field-hint muted">
          {users === 0 ? 'Noch keine Folie nutzt diesen Master.' : users === 1 ? 'Genutzt von 1 Folie.' : `Genutzt von ${users} Folien.`} Elemente
          liegen auf jeder dieser Folien ganz hinten; Hintergrund und Effekte gelten, solange eine Folie keine eigenen hat.
        </p>
      </Group>
      <BackgroundGroup {...props} set={(r, m) => editPage(r, m ? `${m}-${master.id}` : undefined)} />
      <EffectsGroup {...props} set={(r, m) => editPage(r, m ? `${m}-${master.id}` : undefined)} />
    </>
  )
}

function BackgroundGroup({ page, brand, set, inherited }: Props & { set: PageSetter; inherited?: Slide['background'] }) {
  const bg = page.background
  return (
    <Group title="Hintergrund">
      <Row label="Art">
        <Select
          value={bg?.type ?? (inherited ? 'master' : 'color')}
          options={[
            ...(inherited ? [{ value: 'master', label: 'Vom Master' }] : []),
            { value: 'color', label: 'Farbe' },
            { value: 'gradient', label: 'Verlauf' },
            { value: 'meshGradient', label: 'Licht-Verlauf' },
            { value: 'image', label: 'Bild' },
            { value: 'video', label: 'Video' },
          ]}
          onChange={(v) =>
            set((s) => {
              if (v === 'master') delete s.background
              if (v === 'color') s.background = { type: 'color', color: 'brand.background' }
              if (v === 'gradient') s.background = { type: 'gradient', from: 'brand.surface', to: 'brand.background', angle: 180 }
              if (v === 'meshGradient') {
                s.background = {
                  type: 'meshGradient',
                  colors: ['brand.background', 'brand.accent2', 'brand.accent', 'brand.surface'],
                  animate: true,
                }
              }
              if (v === 'image') s.background = { type: 'image', src: 'brand/platzhalter.svg' }
              if (v === 'video') s.background = { type: 'video', src: 'assets/video.mp4' }
            })
          }
        />
      </Row>
      {bg?.type === 'color' && (
        <Row label="Farbe">
          <ColorField brand={brand} value={bg.color} onChange={(v) => set((s) => void (s.background?.type === 'color' && v && (s.background.color = v)), 'bgc')} />
        </Row>
      )}
      {bg?.type === 'gradient' && (
        <>
          <Row label="Von">
            <ColorField brand={brand} value={bg.from} onChange={(v) => set((s) => void (s.background?.type === 'gradient' && v && (s.background.from = v)), 'bgf')} />
          </Row>
          <Row label="Nach">
            <ColorField brand={brand} value={bg.to} onChange={(v) => set((s) => void (s.background?.type === 'gradient' && v && (s.background.to = v)), 'bgt')} />
          </Row>
        </>
      )}
      {(bg?.type === 'image' || bg?.type === 'video') && (
        <Row label="Datei">
          <TextField
            mono
            value={bg.src}
            onChange={(v) => set((s) => void ((s.background?.type === 'image' || s.background?.type === 'video') && (s.background.src = v)), 'bgsrc')}
          />
        </Row>
      )}
      {bg?.type === 'meshGradient' && (
        <Toggle
          label="Langsam fließen"
          value={Boolean(bg.animate)}
          onChange={(v) => set((s) => void (s.background?.type === 'meshGradient' && (s.background.animate = v || undefined)))}
        />
      )}
    </Group>
  )
}

function EffectsGroup({ page, set }: Props & { set: PageSetter }) {
  const effect = <T extends Effect['type']>(type: T) => page.effects?.find((e) => e.type === type) as Extract<Effect, { type: T }> | undefined
  const setEffect = (type: 'grain' | 'vignette' | 'letterbox' | 'lightSweep' | 'float', amount: number) =>
    set((s) => {
      const list: Effect[] = (s.effects ?? []).filter((e) => e.type !== type)
      if (amount > 0) list.push({ type, amount })
      if (list.length) s.effects = list
      else delete s.effects
    }, `fx-${type}`)
  const look = effect('colorLook')
  return (
    <Group title="Effekte">
      <Row label="Korn">
        <Slider value={effect('grain')?.amount ?? 0} onChange={(v) => setEffect('grain', v)} />
      </Row>
      <Row label="Vignette">
        <Slider value={effect('vignette')?.amount ?? 0} onChange={(v) => setEffect('vignette', v)} />
      </Row>
      <Row label="Kinobalken">
        <Slider value={effect('letterbox')?.amount ?? 0} onChange={(v) => setEffect('letterbox', v)} />
      </Row>
      <Row label="Licht-Sweep">
        <Slider value={effect('lightSweep')?.amount ?? 0} onChange={(v) => setEffect('lightSweep', v)} />
      </Row>
      <Row label="Schweben">
        <Slider value={effect('float')?.amount ?? 0} onChange={(v) => setEffect('float', v)} />
      </Row>
      <p className="field-hint muted">Schweben bewegt Elemente mit „Tiefe“ (Stil-Tab) sanft gegeneinander.</p>
      <Row label="Farblook">
        <Select
          value={look?.look ?? 'none'}
          options={[
            { value: 'none', label: 'Keiner' },
            { value: 'mono', label: 'Schwarzweiß' },
            { value: 'muted', label: 'Gedämpft' },
            { value: 'warm', label: 'Warm' },
            { value: 'cool', label: 'Kühl' },
            { value: 'tealOrange', label: 'Teal & Orange' },
          ]}
          onChange={(v) =>
            set((s) => {
              const list: Effect[] = (s.effects ?? []).filter((e) => e.type !== 'colorLook')
              if (v !== 'none') list.push({ type: 'colorLook', look: v })
              if (list.length) s.effects = list
              else delete s.effects
            })
          }
        />
      </Row>
    </Group>
  )
}

/** Deck-weite Einstellungen: Intensität und Textstile (eine Änderung wirkt auf alle Texte des Stils). */
function DeckGroup({ deck, edit, brand, onOpenFonts }: Props) {
  const styles = useTextStyles()
  const [style, setStyle] = useState<TextStyle>('title')
  const def = styles[style]
  const own = deck.textStyles?.[style]
  const setDef = <K extends keyof DeckTextStyle>(key: K, value: DeckTextStyle[K] | undefined) =>
    edit((d) => {
      const next: DeckTextStyle = { ...d.textStyles?.[style] }
      if (value === undefined) delete next[key]
      else next[key] = value
      d.textStyles ??= {}
      if (Object.keys(next).length) d.textStyles[style] = next
      else delete d.textStyles[style]
      if (!Object.keys(d.textStyles).length) delete d.textStyles
    }, `ts-${style}-${key}`)
  const usage = deck.slides.reduce((n, s) => n + s.elements.filter((e) => e.type === 'text' && (e.style ?? 'body') === style).length, 0)
  return (
    <>
      <Group title="Deck">
        <Row label="Intensität">
          <Slider value={deck.intensity ?? 0.3} onChange={(v) => edit((d) => void (d.intensity = Math.round(v * 100) / 100), 'intensity')} />
        </Row>
        <p className="field-hint muted">Ruhig ↔ filmisch: skaliert Korn, Vignette, Licht und Bewegung im ganzen Deck.</p>
      </Group>
      <Group title="Textstile">
        <Row label="Stil">
          <Select value={style} options={TEXT_STYLE_OPTIONS} onChange={setStyle} />
        </Row>
        <div className="style-preview" style={{ fontFamily: `var(--font-${def.font})`, fontWeight: def.weight, letterSpacing: `${def.letterSpacing}em`, textTransform: def.uppercase ? 'uppercase' : undefined }}>
          {TEXT_STYLE_OPTIONS.find((o) => o.value === style)?.label} · Aa
        </div>
        <Row label="Schrift">
          <Segmented
            value={def.font}
            options={[
              { value: 'display', label: 'Display' },
              { value: 'text', label: 'Text' },
              { value: 'mono', label: 'Mono' },
            ]}
            onChange={(v) => setDef('font', v)}
          />
        </Row>
        <div className="grid2">
          <Row label="Größe">
            <NumberField value={def.size} min={4} onChange={(v) => setDef('size', v)} />
          </Row>
          <Row label="Gewicht">
            <NumberField value={def.weight} min={100} max={900} step={50} onChange={(v) => setDef('weight', v === undefined ? undefined : Math.round(v))} />
          </Row>
          <Row label="Zeile">
            <NumberField value={def.lineHeight} min={0.5} step={0.02} onChange={(v) => setDef('lineHeight', v)} />
          </Row>
          <Row label="Laufw.">
            <NumberField value={def.letterSpacing} step={0.005} onChange={(v) => setDef('letterSpacing', v)} />
          </Row>
        </div>
        <Row label="Farbe">
          <ColorField brand={brand} value={def.color} onChange={(v) => setDef('color', v)} />
        </Row>
        <Toggle label="Versalien" value={Boolean(def.uppercase)} onChange={(v) => setDef('uppercase', v)} />
        <p className="field-hint muted">
          Wirkt auf {usage === 1 ? '1 Text' : `${usage} Texte`} im Stil „{TEXT_STYLE_OPTIONS.find((o) => o.value === style)?.label}“.
        </p>
        <div className="inline-actions">
          {own && (
            <button
              type="button"
              className="btn btn--plain"
              onClick={() =>
                edit((d) => {
                  if (d.textStyles) delete d.textStyles[style]
                  if (d.textStyles && !Object.keys(d.textStyles).length) delete d.textStyles
                })
              }
            >
              Auf Theme zurücksetzen
            </button>
          )}
          <button type="button" className="btn" onClick={onOpenFonts}>
            <Icon name="font" size={14} /> Schriften …
          </button>
        </div>
      </Group>
    </>
  )
}
