import type { Deck, Element, Frame, Slide } from '../schema/deck'
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

export type NewElementKind = 'text' | 'rect' | 'ellipse' | 'line' | 'icon' | 'image'

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
