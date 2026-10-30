import { gsap } from 'gsap'
import type { Element, Slide, Transition } from '../schema/deck'
import type { TextStyles } from './brand'
import { ease } from './timeline'

/** Standarddauer je Übergang in ms. */
export const TRANSITION_DURATION: Record<Transition['type'], number> = {
  none: 0,
  dissolve: 600,
  blurDissolve: 800,
  push: 700,
  zoom: 800,
  magicMove: 1000,
  camera: 1200,
  maskReveal: 900,
  lightLeak: 1000,
  whipPan: 550,
}

/** Übergänge, die erst in Phase 3 ihre eigene Umsetzung bekommen, nutzen bis dahin einen verwandten. */
const FALLBACK: Partial<Record<Transition['type'], Transition['type']>> = {
  camera: 'zoom',
  lightLeak: 'blurDissolve',
}

export type TransitionRun = {
  timeline: gsap.core.Timeline
  /** IDs der Elemente auf der neuen Folie, die per Magic Move ankommen (ohne eigenen Einblend-Build). */
  matched: Set<string>
}

type Args = {
  from: HTMLElement
  to: HTMLElement
  fromSlide: Slide
  toSlide: Slide
  transition: Transition | undefined
  styles: TextStyles
  width: number
  height: number
}

const elOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`:scope > .slide__content > [data-element-id="${CSS.escape(id)}"]`)

/** Elementpaare mit gleichem `match`. */
export function matchPairs(fromSlide: Slide, toSlide: Slide): [Element, Element][] {
  const byMatch = new Map(fromSlide.elements.filter((e) => e.match && !e.hidden).map((e) => [e.match!, e]))
  return toSlide.elements.flatMap((b) => {
    const a = b.match && !b.hidden ? byMatch.get(b.match) : undefined
    return a ? [[a, b] as [Element, Element]] : []
  })
}

/**
 * Spielt einen Übergang ab: `from` und `to` sind die .slide-Elemente beider Folien, übereinander gerendert.
 * Die neue Folie muss bereits ihren Build-Startzustand haben (Elemente mit Einblendung versteckt).
 */
export function runTransition(args: Args): TransitionRun {
  const { from, to, transition } = args
  const requested = transition?.type ?? 'none'
  const type = FALLBACK[requested] ?? requested
  const duration = (transition?.duration ?? TRANSITION_DURATION[requested]) / 1000
  const e = ease(transition?.easing ?? (type === 'whipPan' ? 'inOut' : 'smooth'))
  const tl = gsap.timeline()
  const matched = new Set<string>()
  const W = args.width
  const H = args.height

  switch (type) {
    case 'none':
      tl.set(from, { opacity: 0 })
      break
    case 'dissolve':
      tl.fromTo(to, { opacity: 0 }, { opacity: 1, duration, ease: 'none' })
      break
    case 'blurDissolve':
      tl.to(from, { opacity: 0, filter: 'blur(24px)', duration, ease: e }, 0)
      tl.fromTo(to, { opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0px)', duration, ease: e }, 0)
      break
    case 'push':
    case 'whipPan': {
      const dir = transition?.direction ?? 'left'
      const axis = dir === 'left' || dir === 'right' ? 'x' : 'y'
      const size = axis === 'x' ? W : H
      const sign = dir === 'left' || dir === 'up' ? -1 : 1
      const blur = type === 'whipPan' ? 'blur(28px)' : 'blur(0px)'
      tl.to(from, { [axis]: sign * size, duration, ease: e }, 0)
      tl.fromTo(to, { [axis]: -sign * size }, { [axis]: 0, duration, ease: e }, 0)
      if (type === 'whipPan') {
        // Bewegungsunschärfe in der Mitte des Schwenks.
        tl.to([from, to], { filter: blur, duration: duration / 2, ease: 'power2.in' }, 0)
        tl.to([from, to], { filter: 'blur(0px)', duration: duration / 2, ease: 'power2.out' }, duration / 2)
      }
      break
    }
    case 'zoom':
      tl.to(from, { opacity: 0, scale: 1.15, duration, ease: e }, 0)
      tl.fromTo(to, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration, ease: e }, 0)
      break
    case 'maskReveal':
      tl.fromTo(
        to,
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(75% at 50% 50%)', duration, ease: e },
        0,
      )
      break
    case 'magicMove':
      magicMove(args, tl, duration, e, matched)
      break
  }
  // Ausgangsfolie am Ende sicher ausblenden; Eingangsfolie auf Normalzustand.
  tl.set(from, { opacity: 0 })
  tl.set(to, { clearProps: 'opacity,filter,clipPath,transform' })
  return { timeline: tl, matched }
}

/* ---------- Magic Move ---------- */

type Box = { x: number; y: number; w: number; h: number }

function fontSize(el: Element, styles: TextStyles): number {
  return el.type === 'text' ? (el.fontSize ?? styles[el.style ?? 'body'].size) : 0
}

/** Sichtbarer Textblock eines Text-Elements in Folien-Koordinaten (unabhängig von der Bühnen-Skalierung). */
function measureText(node: HTMLElement, root: HTMLElement, logicalWidth: number): Box | null {
  const content = node.querySelector('.el-text > div')
  if (!content) return null
  const range = document.createRange()
  range.selectNodeContents(content)
  const r = range.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  const scale = rootRect.width / logicalWidth
  if (!r.width || !scale) return null
  return { x: (r.left - rootRect.left) / scale, y: (r.top - rootRect.top) / scale, w: r.width / scale, h: r.height / scale }
}

/**
 * Transform, mit dem `self` dort erscheint, wo `other` ist.
 * Text: an der sichtbaren Textkante ausgerichtet, gleichmäßig nach Schriftgröße skaliert.
 * Alles andere: am Rahmen, Breite und Höhe getrennt skaliert.
 */
function flip(self: Element, other: Element, selfBox: Box, otherBox: Box, styles: TextStyles) {
  const isText = self.type === 'text' && other.type === 'text'
  const scaleX = isText ? fontSize(other, styles) / fontSize(self, styles) : otherBox.w / selfBox.w
  const scaleY = isText ? scaleX : otherBox.h / selfBox.h
  return {
    transformOrigin: `${selfBox.x - self.frame.x}px ${selfBox.y - self.frame.y}px`,
    x: otherBox.x - selfBox.x,
    y: otherBox.y - selfBox.y,
    scaleX,
    scaleY,
    rotation: other.frame.rotation ?? 0,
  }
}

function magicMove(args: Args, tl: gsap.core.Timeline, duration: number, e: ReturnType<typeof ease>, matched: Set<string>) {
  const { from, to, fromSlide, toSlide, styles } = args
  const pairs = matchPairs(fromSlide, toSlide)
  const pairedFrom = new Set(pairs.map(([a]) => a.id))
  const pairedTo = new Set(pairs.map(([, b]) => b.id))

  // Hintergründe und Effekte überblenden.
  const toBackdrop = to.querySelectorAll(':scope > .slide__content > .slide__bg, :scope > .slide__fx')
  tl.fromTo(toBackdrop, { opacity: 0 }, { opacity: 1, duration, ease: 'none' }, 0)

  // Ungepaarte Elemente: alte blenden schnell aus, neue in der zweiten Hälfte ein.
  for (const el of fromSlide.elements) {
    const node = elOf(from, el.id)
    if (node && !pairedFrom.has(el.id)) tl.to(node, { opacity: 0, duration: duration * 0.45, ease: 'none' }, 0)
  }
  for (const el of toSlide.elements) {
    const node = elOf(to, el.id)
    if (node && !pairedTo.has(el.id)) {
      tl.fromTo(node, { opacity: 0 }, { opacity: el.opacity ?? 1, duration: duration * 0.55, ease: 'none' }, duration * 0.45)
    }
  }

  // Paare: beide bewegen sich auf derselben Bahn und blenden ineinander über.
  for (const [a, b] of pairs) {
    const nodeA = elOf(from, a.id)
    const nodeB = elOf(to, b.id)
    if (!nodeA || !nodeB) continue
    matched.add(b.id)
    const frameBox = (el: Element): Box => ({ x: el.frame.x, y: el.frame.y, w: el.frame.w, h: el.frame.h })
    const isText = a.type === 'text' && b.type === 'text'
    const boxA = (isText && measureText(nodeA, from, args.width)) || frameBox(a)
    const boxB = (isText && measureText(nodeB, to, args.width)) || frameBox(b)
    const toB = flip(a, b, boxA, boxB, styles)
    const fromA = flip(b, a, boxB, boxA, styles)
    const rotA = a.frame.rotation ?? 0
    const rotB = b.frame.rotation ?? 0
    tl.fromTo(
      nodeA,
      { transformOrigin: toB.transformOrigin, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: rotA },
      { x: toB.x, y: toB.y, scaleX: toB.scaleX, scaleY: toB.scaleY, rotation: rotB, duration, ease: e },
      0,
    )
    tl.to(nodeA, { opacity: 0, duration: duration * 0.6, ease: 'none' }, duration * 0.2)
    tl.fromTo(
      nodeB,
      {
        transformOrigin: fromA.transformOrigin,
        x: fromA.x,
        y: fromA.y,
        scaleX: fromA.scaleX,
        scaleY: fromA.scaleY,
        rotation: rotA,
        opacity: 0,
      },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: rotB, duration, ease: e },
      0,
    )
    tl.to(nodeB, { opacity: b.opacity ?? 1, duration: duration * 0.6, ease: 'none' }, duration * 0.2)
  }
}
