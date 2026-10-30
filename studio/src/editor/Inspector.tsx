import type { Draft } from 'immer'
import { useState } from 'react'
import { computeSteps, PRESET_DURATION } from '../engine/timeline'
import { TRANSITION_DURATION } from '../engine/transitions'
import type { Animation, Build, Deck, Effect, Element, Slide, Transition } from '../schema/deck'
import type { Issue } from '../schema/issues'
import { IssueList } from '../ui/IssueList'
import { ColorField, Group, NumberField, Row, Segmented, Select, Slider, TextField, Toggle } from './fields'

export type InspectorTab = 'stil' | 'animation' | 'folie'

type Props = {
  deck: Deck
  slide: Slide
  element: Element | undefined
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
  edit: (recipe: (draft: Draft<Deck>) => void, merge?: string) => void
  brand: Record<string, string>
  onPreview: () => void
  saveIssues: Issue[]
}

const PRESETS: { value: Animation['preset']; label: string }[] = [
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
  const { tab, onTab, element } = props
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
        {tab === 'stil' && (element ? <ElementStyle {...props} element={element} /> : <Hint />)}
        {tab === 'animation' && <AnimationTab {...props} />}
        {tab === 'folie' && <SlideTab {...props} />}
        {props.saveIssues.length > 0 && <IssueList title="Speichern fehlgeschlagen" issues={props.saveIssues} />}
      </div>
    </div>
  )
}

function Hint() {
  return (
    <p className="inspector__hint muted">
      Wähle ein Element auf der Folie aus. Doppelklick auf Text bearbeitet ihn direkt.
    </p>
  )
}

/** Änderung am ausgewählten Element. */
function useElementEdit({ deck, slide, element, edit }: Props) {
  const si = deck.slides.indexOf(slide)
  return (recipe: (el: Draft<Element>) => void, merge?: string) =>
    edit((d) => {
      const el = d.slides[si]?.elements.find((e) => e.id === element?.id)
      if (el) recipe(el)
    }, merge && element ? `${merge}-${element.id}` : undefined)
}

/* ---------- Stil ---------- */

function setTilt(e: Draft<Element>, axis: 'x' | 'y', v: number | undefined) {
  const tilt = { ...e.tilt, [axis]: v || undefined }
  if (!tilt.x && !tilt.y) delete e.tilt
  else e.tilt = tilt
}

function ElementStyle(props: Props & { element: Element }) {
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
            <Select
              value={el.style ?? 'body'}
              onChange={(v) => set((x) => void (x.type === 'text' && (x.style = v)))}
              options={[
                { value: 'display', label: 'Display' },
                { value: 'title', label: 'Titel' },
                { value: 'heading', label: 'Überschrift' },
                { value: 'subtitle', label: 'Untertitel' },
                { value: 'body', label: 'Text' },
                { value: 'caption', label: 'Bildunterschrift' },
                { value: 'label', label: 'Label' },
              ]}
            />
          </Row>
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
      </Group>
    </>
  )
}

/** Chart-Daten: Art, Werte, Beschriftungen. */
function ChartFields(props: Props & { element: Extract<Element, { type: 'chart' }> }) {
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
  const { slide, element, onPreview } = props
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
          <button type="button" className="btn" onClick={onPreview}>
            ▶ Vorschau
          </button>
        </div>
      </Group>
      {element ? <ElementAnimation {...props} element={element} /> : <Hint />}
      <BuildOrder slide={slide} />
    </>
  )
}

function ElementAnimation(props: Props & { element: Element }) {
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
              onChange={(v) => set((x) => void (x.build && (x.build.trigger = v)))}
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

function BuildOrder({ slide }: { slide: Slide }) {
  const steps = computeSteps(slide)
  if (steps.every((s) => !s.items.length)) return null
  return (
    <Group title="Reihenfolge">
      <ol className="build-order">
        {steps.map((step, i) =>
          step.items.length ? (
            <li key={i}>
              <span className="build-order__step">{i === 0 ? 'Auto' : `Klick ${i}`}</span>
              <span>
                {step.items
                  .map((it) => `${it.element.name ?? it.element.id}${it.kind === 'out' ? ' (aus)' : ''}`)
                  .join(', ')}
              </span>
            </li>
          ) : null,
        )}
      </ol>
    </Group>
  )
}

/* ---------- Folie ---------- */

function SlideTab({ deck, slide, edit, brand }: Props) {
  const si = deck.slides.indexOf(slide)
  const setSlide = (recipe: (s: Draft<Slide>) => void, merge?: string) =>
    edit((d) => {
      const s = d.slides[si]
      if (s) recipe(s)
    }, merge ? `${merge}-${slide.id}` : undefined)
  const effect = <T extends Effect['type']>(type: T) => slide.effects?.find((e) => e.type === type) as Extract<Effect, { type: T }> | undefined
  const setEffect = (type: 'grain' | 'vignette' | 'letterbox' | 'lightSweep' | 'float', amount: number) =>
    setSlide((s) => {
      const list: Effect[] = (s.effects ?? []).filter((e) => e.type !== type)
      if (amount > 0) list.push({ type, amount })
      if (list.length) s.effects = list
      else delete s.effects
    }, `fx-${type}`)
  const look = effect('colorLook')
  const bg = slide.background
  const transition = slide.transition
  return (
    <>
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

      <Group title="Hintergrund">
        <Row label="Art">
          <Select
            value={bg?.type ?? 'color'}
            options={[
              { value: 'color', label: 'Farbe' },
              { value: 'gradient', label: 'Verlauf' },
              { value: 'meshGradient', label: 'Licht-Verlauf' },
              { value: 'image', label: 'Bild' },
              { value: 'video', label: 'Video' },
            ]}
            onChange={(v) =>
              setSlide((s) => {
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
            <ColorField brand={brand} value={bg.color} onChange={(v) => setSlide((s) => void (s.background?.type === 'color' && v && (s.background.color = v)), 'bgc')} />
          </Row>
        )}
        {bg?.type === 'gradient' && (
          <>
            <Row label="Von">
              <ColorField brand={brand} value={bg.from} onChange={(v) => setSlide((s) => void (s.background?.type === 'gradient' && v && (s.background.from = v)), 'bgf')} />
            </Row>
            <Row label="Nach">
              <ColorField brand={brand} value={bg.to} onChange={(v) => setSlide((s) => void (s.background?.type === 'gradient' && v && (s.background.to = v)), 'bgt')} />
            </Row>
          </>
        )}
        {(bg?.type === 'image' || bg?.type === 'video') && (
          <Row label="Datei">
            <TextField
              mono
              value={bg.src}
              onChange={(v) => setSlide((s) => void ((s.background?.type === 'image' || s.background?.type === 'video') && (s.background.src = v)), 'bgsrc')}
            />
          </Row>
        )}
        {bg?.type === 'meshGradient' && (
          <Toggle
            label="Langsam fließen"
            value={Boolean(bg.animate)}
            onChange={(v) => setSlide((s) => void (s.background?.type === 'meshGradient' && (s.background.animate = v || undefined)))}
          />
        )}
      </Group>

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
              setSlide((s) => {
                const list: Effect[] = (s.effects ?? []).filter((e) => e.type !== 'colorLook')
                if (v !== 'none') list.push({ type: 'colorLook', look: v })
                if (list.length) s.effects = list
                else delete s.effects
              })
            }
          />
        </Row>
      </Group>

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

      <Group title="Deck">
        <Row label="Intensität">
          <Slider value={deck.intensity ?? 0.3} onChange={(v) => edit((d) => void (d.intensity = Math.round(v * 100) / 100), 'intensity')} />
        </Row>
        <p className="field-hint muted">Ruhig ↔ filmisch: skaliert Korn, Vignette, Licht und Bewegung im ganzen Deck.</p>
      </Group>

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
