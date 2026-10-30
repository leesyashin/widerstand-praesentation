import type { Draft } from 'immer'
import type { Deck, Element, Frame, Master, Slide } from '../schema/deck'
import type { Layout } from '../schema/layout'
import type { Theme } from '../schema/theme'

/** "titel" → "titel", "titel-2", "titel-3" … – je nachdem, was schon vergeben ist. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const clean =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-\d+$/, '') || 'element'
  if (!used.has(clean)) return clean
  for (let n = 2; ; n++) if (!used.has(`${clean}-${n}`)) return `${clean}-${n}`
}

export function roundFrame(f: Frame): Frame {
  const r = (v: number) => Math.round(v)
  return { ...f, x: r(f.x), y: r(f.y), w: Math.max(1, r(f.w)), h: Math.max(1, r(f.h)) }
}

/** Neue Folie aus einem Layout – Elemente werden auf das Deck-Format skaliert, Hintergrund kommt vom Theme. */
export function slideFromLayout(layout: Layout, deck: Deck, theme: Theme | null): Slide {
  const sx = deck.format.width / layout.width
  const sy = deck.format.height / layout.height
  const elements = structuredClone(layout.elements).map((el) => ({
    ...el,
    frame: roundFrame({ ...el.frame, x: el.frame.x * sx, y: el.frame.y * sy, w: el.frame.w * sx, h: el.frame.h * sy }),
  }))
  const slide: Slide = {
    id: uniqueId(layout.name, deck.slides.map((s) => s.id)),
    layout: layout.name,
    elements,
  }
  const background = theme?.backgrounds[layout.surface]
  if (background) slide.background = structuredClone(background)
  const effects = theme?.effects?.[layout.surface]
  if (effects?.length) slide.effects = structuredClone(effects)
  if (deck.slides.length > 0) slide.transition = { type: 'blurDissolve' }
  return slide
}

export type NewElementKind = 'text' | 'rect' | 'ellipse' | 'line' | 'icon' | 'image' | 'chart'

/** Neues Element mittig auf der Folie. */
export function newElement(kind: NewElementKind, slide: Slide, deck: Deck): Element {
  const W = deck.format.width
  const H = deck.format.height
  const taken = slide.elements.map((e) => e.id)
  const center = (w: number, h: number): Frame => roundFrame({ x: (W - w) / 2, y: (H - h) / 2, w, h })
  switch (kind) {
    case 'text':
      return {
        id: uniqueId('text', taken),
        type: 'text',
        style: 'heading',
        content: 'Neuer Text',
        frame: center(900, 90),
      }
    case 'rect':
      return {
        id: uniqueId('form', taken),
        type: 'shape',
        shape: 'rect',
        fill: 'brand.surface',
        radius: 24,
        frame: center(480, 320),
      }
    case 'ellipse':
      return { id: uniqueId('kreis', taken), type: 'shape', shape: 'ellipse', fill: 'brand.accent', frame: center(240, 240) }
    case 'line':
      return {
        id: uniqueId('linie', taken),
        type: 'shape',
        shape: 'line',
        stroke: { color: 'brand.accent', width: 4 },
        frame: center(480, 8),
      }
    case 'icon':
      return { id: uniqueId('icon', taken), type: 'icon', icon: 'camera', color: 'brand.text', frame: center(160, 160) }
    case 'chart':
      return {
        id: uniqueId('chart', taken),
        type: 'chart',
        chart: 'bar',
        data: [
          { label: '2023', value: 40 },
          { label: '2024', value: 65 },
          { label: '2025', value: 90 },
        ],
        frame: center(900, 520),
        build: { in: { preset: 'grow' }, trigger: 'click' },
      }
    case 'image':
      return {
        id: uniqueId('bild', taken),
        type: 'image',
        src: 'brand/platzhalter.svg',
        fit: 'cover',
        radius: 16,
        frame: center(800, 450),
      }
  }
}

/** Kopie eines Elements mit neuer ID, leicht versetzt. Magic-Move-Partner werden nicht mitkopiert. */
export function duplicateElement(el: Element, slide: Slide, offset = 24): Element {
  const copy = structuredClone(el)
  copy.id = uniqueId(el.id, slide.elements.map((e) => e.id))
  delete copy.match
  copy.frame = { ...copy.frame, x: copy.frame.x + offset, y: copy.frame.y + offset }
  return copy
}

/** Kopie einer Folie mit neuer ID. */
export function duplicateSlide(slide: Slide, deck: Deck): Slide {
  const copy = structuredClone(slide)
  copy.id = uniqueId(slide.id, deck.slides.map((s) => s.id))
  return copy
}

/* ---------- Seiten: Folie oder Master ---------- */

/** Was gerade bearbeitet wird: eine Folie oder eine Master-Folie. */
export type PageRef = { kind: 'slide' | 'master'; index: number }
export type Page = Slide | Master

export function pageOf<D extends Deck | Draft<Deck>>(deck: D, ref: PageRef): D['slides'][number] | NonNullable<D['masters']>[number] | undefined {
  return ref.kind === 'slide' ? deck.slides[ref.index] : deck.masters?.[ref.index]
}

/* ---------- Auswahl, Gruppen, Ebenen ---------- */

/** Erweitert eine Auswahl um alle Mitglieder der betroffenen Gruppen. */
export function expandGroups(elements: Element[], ids: string[]): string[] {
  const groups = new Set(elements.filter((e) => ids.includes(e.id) && e.group).map((e) => e.group))
  return elements.filter((e) => ids.includes(e.id) || (e.group && groups.has(e.group))).map((e) => e.id)
}

/** Umgebender Rahmen mehrerer Elemente (Drehung wird ignoriert). */
export function unionFrame(frames: Frame[]): Frame {
  const x = Math.min(...frames.map((f) => f.x))
  const y = Math.min(...frames.map((f) => f.y))
  const r = Math.max(...frames.map((f) => f.x + f.w))
  const b = Math.max(...frames.map((f) => f.y + f.h))
  return { x, y, w: Math.max(1, r - x), h: Math.max(1, b - y) }
}

/**
 * Gruppiert Elemente über einen gemeinsamen `group`-Schlüssel. Die Ebenen-Reihenfolge bleibt unverändert,
 * damit sich am Aussehen der Folie nichts ändert.
 */
export function groupElements(page: Draft<Page>, ids: string[]): string | null {
  const members = page.elements.filter((e) => ids.includes(e.id))
  if (members.length < 2) return null
  const group = uniqueId('gruppe', page.elements.flatMap((e) => (e.group ? [e.group] : [])))
  for (const m of members) m.group = group
  return group
}

export function ungroupElements(page: Draft<Page>, ids: string[]) {
  for (const e of page.elements) if (ids.includes(e.id)) delete e.group
}

/** Ebenen-Reihenfolge: nach vorne/hinten (ein Schritt) oder ganz nach vorne/hinten. Gruppen bleiben zusammen. */
export function arrange(page: Draft<Page>, ids: string[], where: 'forward' | 'backward' | 'front' | 'back') {
  const moving = page.elements.filter((e) => ids.includes(e.id))
  if (!moving.length) return
  const rest = page.elements.filter((e) => !ids.includes(e.id))
  let at: number
  if (where === 'front') at = rest.length
  else if (where === 'back') at = 0
  else {
    const first = page.elements.indexOf(moving[0]!)
    const last = page.elements.indexOf(moving[moving.length - 1]!)
    // Position in `rest`: Anzahl der übrigen Elemente vor dem Block, ±1
    const before = page.elements.slice(0, first).filter((e) => !ids.includes(e.id)).length
    const after = page.elements.slice(0, last + 1).filter((e) => !ids.includes(e.id)).length
    at = where === 'forward' ? Math.min(rest.length, after + 1) : Math.max(0, before - 1)
  }
  page.elements = [...rest.slice(0, at), ...moving, ...rest.slice(at)]
}

/** Verschiebt ein Element in der Ebenen-Liste an Position `to` (Index im Array, 0 = ganz hinten). */
export function moveElement(page: Draft<Page>, id: string, to: number) {
  const from = page.elements.findIndex((e) => e.id === id)
  if (from < 0) return
  const [el] = page.elements.splice(from, 1)
  page.elements.splice(Math.max(0, Math.min(page.elements.length, to)), 0, el!)
}

export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

/**
 * Ausrichten: ein Element an der Folie, mehrere am gemeinsamen Rahmen.
 * Gruppen werden als Block behandelt (ihr gemeinsamer Rahmen bewegt sich).
 */
export function alignElements(page: Draft<Page>, ids: string[], kind: AlignKind, slideW: number, slideH: number) {
  const els = page.elements.filter((e) => ids.includes(e.id))
  if (!els.length) return
  const blocks = blocksOf(els)
  const box = blocks.length === 1 ? { x: 0, y: 0, w: slideW, h: slideH } : unionFrame(els.map((e) => e.frame))
  for (const block of blocks) {
    const f = unionFrame(block.map((e) => e.frame))
    let dx = 0
    let dy = 0
    if (kind === 'left') dx = box.x - f.x
    if (kind === 'hcenter') dx = box.x + box.w / 2 - (f.x + f.w / 2)
    if (kind === 'right') dx = box.x + box.w - (f.x + f.w)
    if (kind === 'top') dy = box.y - f.y
    if (kind === 'vcenter') dy = box.y + box.h / 2 - (f.y + f.h / 2)
    if (kind === 'bottom') dy = box.y + box.h - (f.y + f.h)
    for (const e of block) e.frame = roundFrame({ ...e.frame, x: e.frame.x + dx, y: e.frame.y + dy })
  }
}

/** Verteilt Elemente (bzw. Gruppen) mit gleichen Abständen zwischen dem ersten und letzten. */
export function distributeElements(page: Draft<Page>, ids: string[], axis: 'x' | 'y') {
  const blocks = blocksOf(page.elements.filter((e) => ids.includes(e.id)))
  if (blocks.length < 3) return
  const pos = axis === 'x' ? 'x' : 'y'
  const size = axis === 'x' ? 'w' : 'h'
  const sorted = blocks.map((b) => ({ b, f: unionFrame(b.map((e) => e.frame)) })).sort((a, z) => a.f[pos] - z.f[pos])
  const first = sorted[0]!.f
  const last = sorted[sorted.length - 1]!.f
  const total = sorted.reduce((s, x) => s + x.f[size], 0)
  const gap = (last[pos] + last[size] - first[pos] - total) / (sorted.length - 1)
  let cursor = first[pos]
  for (const { b, f } of sorted) {
    const d = cursor - f[pos]
    for (const e of b) e.frame = roundFrame({ ...e.frame, [pos]: e.frame[pos] + d })
    cursor += f[size] + gap
  }
}

/** Fasst Elemente zu Blöcken zusammen: Gruppenmitglieder bilden einen Block, alle anderen je einen. */
function blocksOf<T extends { group?: string }>(els: T[]): T[][] {
  const groups = new Map<string, T[]>()
  const blocks: T[][] = []
  for (const e of els) {
    if (!e.group) blocks.push([e])
    else if (groups.has(e.group)) groups.get(e.group)!.push(e)
    else {
      const b = [e]
      groups.set(e.group, b)
      blocks.push(b)
    }
  }
  return blocks
}

/* ---------- Folien und Master ---------- */

/** Verschiebt eine Folie in der Reihenfolge. `to` = Zielindex nach dem Entfernen. */
export function moveSlide(deck: Draft<Deck>, from: number, to: number) {
  const [s] = deck.slides.splice(from, 1)
  if (s) deck.slides.splice(Math.max(0, Math.min(deck.slides.length, to)), 0, s)
}

/** Neuer, leerer Master (dunkle Fläche aus dem Theme). */
export function newMaster(deck: Deck, theme: Theme | null, from?: Slide, elements: Element[] = []): Master {
  const n = (deck.masters?.length ?? 0) + 1
  const master: Master = {
    id: uniqueId('master', deck.masters?.map((m) => m.id) ?? []),
    name: `Master ${n}`,
    elements: structuredClone(elements).map((e) => ({ ...e, build: undefined, match: undefined })),
  }
  const background = from?.background ?? theme?.backgrounds.content
  if (background) master.background = structuredClone(background)
  const effects = from?.effects
  if (effects?.length) master.effects = structuredClone(effects)
  // undefined-Felder nicht in die Datei schreiben
  master.elements = JSON.parse(JSON.stringify(master.elements)) as Element[]
  return master
}

/** Text-Werte, die vom Textstil abweichen. */
export const TEXT_OVERRIDES = ['font', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'] as const

/** Element für eine Mediendatei – im Seitenverhältnis der Datei, mittig am Punkt (Standard: Folienmitte). */
export function mediaElement(
  media: { path: string; kind: 'image' | 'video' | 'lottie'; width?: number; height?: number; poster?: string },
  page: Page,
  deck: Deck,
  point?: { x: number; y: number },
): Element {
  const W = deck.format.width
  const H = deck.format.height
  const ratio = media.width && media.height ? media.width / media.height : media.kind === 'lottie' ? 1 : 16 / 9
  let w = W * 0.5
  let h = w / ratio
  if (h > H * 0.6) {
    h = H * 0.6
    w = h * ratio
  }
  const cx = point?.x ?? W / 2
  const cy = point?.y ?? H / 2
  const frame = roundFrame({
    x: Math.min(W - w, Math.max(0, cx - w / 2)),
    y: Math.min(H - h, Math.max(0, cy - h / 2)),
    w,
    h,
  })
  const taken = page.elements.map((e) => e.id)
  const base = media.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? media.kind
  if (media.kind === 'video') {
    return {
      id: uniqueId(base, taken),
      type: 'video',
      src: media.path,
      ...(media.poster ? { poster: media.poster } : {}),
      fit: 'cover',
      playback: { autoplay: true, loop: true, muted: true },
      frame,
    }
  }
  if (media.kind === 'lottie') return { id: uniqueId(base, taken), type: 'lottie', src: media.path, frame }
  return { id: uniqueId(base, taken), type: 'image', src: media.path, fit: 'cover', frame }
}
