import { gsap } from 'gsap'
import { formatChartValue } from './chart'
import type { Element, Slide, Transition, World } from '../schema/deck'
import type { TextStyles } from './brand'
import { resolveRgba } from './gl/color'
import { createProgram } from './gl/program'
import { LEAK } from './gl/shaders'
import { ease } from './timeline'

/** Unschärfe beim Blur-Überblenden. Auf Touch-Geräten (iPad) weniger – Vollbild-Blur kostet dort viel. */
const BLUR = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 10 : 24

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

/** Ersatz, falls ein Übergang auf diesem Gerät nicht möglich ist. */
const FALLBACK: Partial<Record<Transition['type'], Transition['type']>> = {}

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
  /** Raum-Positionen beider Folien (für die Kamerafahrt). */
  fromWorld?: Required<World>
  toWorld?: Required<World>
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
      tl.to(from, { opacity: 0, filter: `blur(${BLUR}px)`, duration, ease: e }, 0)
      tl.fromTo(to, { opacity: 0, filter: `blur(${BLUR}px)` }, { opacity: 1, filter: 'blur(0px)', duration, ease: e }, 0)
      break
    case 'push':
    case 'whipPan': {
      const dir = transition?.direction ?? 'left'
      const axis = dir === 'left' || dir === 'right' ? 'x' : 'y'
      const size = axis === 'x' ? W : H
      const sign = dir === 'left' || dir === 'up' ? -1 : 1
      const blur = type === 'whipPan' ? `blur(${Math.round(BLUR * 1.15)}px)` : 'blur(0px)'
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
    case 'camera':
      cameraMove(args, tl, duration)
      break
    case 'lightLeak':
      lightLeak(args, tl, duration)
      break
  }
  // Ausgangsfolie am Ende sicher ausblenden; Eingangsfolie auf Normalzustand.
  tl.set(from, { opacity: 0 })
  tl.set(to, { clearProps: 'opacity,filter,clipPath,transform' })
  return { timeline: tl, matched }
}

/**
 * Folie nach einem (abgebrochenen) Übergang wieder auf den Stand bringen, den React gerendert hat.
 * Nötig, wenn eine gerade ausgeblendete Folie sofort wieder gezeigt wird (z. B. „zurück“ mitten im Übergang).
 */
export function resetSlideDom(root: HTMLElement, slide: Slide) {
  gsap.set(root, { clearProps: 'opacity,filter,clipPath,transform' })
  for (const el of slide.elements) {
    const node = elOf(root, el.id)
    if (!node) continue
    gsap.set(node, { clearProps: 'transform,opacity,left,top,width,height,transformOrigin' })
    const f = el.frame
    node.style.left = `${f.x}px`
    node.style.top = `${f.y}px`
    node.style.width = `${f.w}px`
    node.style.height = `${f.h}px`
    node.style.transform = f.rotation ? `rotate(${f.rotation}deg)` : ''
    node.style.opacity = el.opacity === undefined ? '' : String(el.opacity)
  }
}

/* ---------- Kamerafahrt ---------- */

type Cam = Required<World>

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Die Kamera fliegt von der Raum-Position der alten zur neuen Folie. Beide Folien werden relativ zur
 * Kamera platziert (Verschiebung, Drehung, Maßstab, Tiefe). Elemente mit `depth` bewegen sich dabei
 * unterschiedlich schnell – Parallax. Kurz vor der Mitte entsteht leichte Bewegungsunschärfe.
 */
function cameraMove(args: Args, tl: gsap.core.Timeline, duration: number) {
  const { from, to, width: W } = args
  const A = args.fromWorld ?? { x: 0, y: 0, z: 0, rotate: 0, scale: 1 }
  const B = args.toWorld ?? { x: W * 1.25, y: 0, z: 0, rotate: 0, scale: 1 }
  const layers: [HTMLElement, Cam][] = [
    [from, A],
    [to, B],
  ]
  const depthNodes = layers.map(([root]) =>
    [...root.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => ({
      node: el.querySelector<HTMLElement>(':scope > .el-anim'),
      depth: Number(el.dataset.depth ?? 0),
    })),
  )
  const place = (t: number) => {
    const cam: Cam = {
      x: lerp(A.x, B.x, t),
      y: lerp(A.y, B.y, t),
      z: lerp(A.z, B.z, t),
      rotate: lerp(A.rotate, B.rotate, t),
      // Maßstab logarithmisch, damit Zoomen gleichmäßig wirkt.
      scale: Math.exp(lerp(Math.log(A.scale), Math.log(B.scale), t)),
    }
    const rad = (-cam.rotate * Math.PI) / 180
    const blur = Math.sin(Math.PI * t) * 2.5
    layers.forEach(([root, L], i) => {
      const dx = (L.x - cam.x) / cam.scale
      const dy = (L.y - cam.y) / cam.scale
      const rx = dx * Math.cos(rad) - dy * Math.sin(rad)
      const ry = dx * Math.sin(rad) + dy * Math.cos(rad)
      const dz = (L.z - cam.z) / cam.scale
      root.style.transform = `perspective(2400px) translate3d(${rx}px, ${ry}px, ${dz}px) rotate(${L.rotate - cam.rotate}deg) scale(${L.scale / cam.scale})`
      root.style.filter = blur > 0.05 ? `blur(${blur}px)` : ''
      for (const { node, depth } of depthNodes[i] ?? []) {
        if (node) node.style.translate = `${rx * depth * 0.035}px ${ry * depth * 0.035}px`
      }
    })
  }
  const proxy = { t: 0 }
  place(0)
  tl.to(proxy, { t: 1, duration, ease: 'power3.inOut', onUpdate: () => place(proxy.t) }, 0)
  tl.call(
    () => {
      for (const [root] of layers) {
        root.style.transform = ''
        root.style.filter = ''
      }
      for (const { node } of depthNodes.flat()) if (node) node.style.translate = ''
    },
    undefined,
    duration,
  )
}

/* ---------- Light Leak ---------- */

/** Organisches Licht flutet über den Schnitt (WebGL); darunter blendet die Folie über. */
function lightLeak(args: Args, tl: gsap.core.Timeline, duration: number) {
  const { to } = args
  tl.fromTo(to, { opacity: 0 }, { opacity: 1, duration: duration * 0.35, ease: 'none' }, duration * 0.3)
  const container = to.parentElement?.parentElement
  if (!container) return
  const canvas = document.createElement('canvas')
  canvas.className = 'fx-gl fx-leak'
  container.appendChild(canvas)
  const program = createProgram(canvas, LEAK)
  if (!program) {
    canvas.remove()
    return
  }
  const tint = resolveRgba('brand.accent', {}, [1, 0.9, 0.8, 1], to).slice(0, 3)
  const proxy = { p: 0 }
  const draw = () => {
    const rect = canvas.getBoundingClientRect()
    program.render({ u_progress: proxy.p, u_tint: tint, u_time: proxy.p * 4 }, Math.max(2, Math.round(rect.width * 0.5)), Math.max(2, Math.round(rect.height * 0.5)))
  }
  draw()
  tl.to(proxy, { p: 1, duration, ease: 'none', onUpdate: draw }, 0)
  tl.call(
    () => {
      program.destroy()
      canvas.remove()
    },
    undefined,
    duration,
  )
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

/** Gleichartige Formen, Icons und identische Bilder verwandeln sich direkt statt überzublenden. */
function morphsGeometry(a: Element, b: Element): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'shape' || a.type === 'icon' || a.type === 'path') return true
  // Daten-Magic-Move: gleiche Chart-Art baut sich um (Balken wachsen/schrumpfen, Linien verformen sich, Werte zählen).
  if (a.type === 'chart' && b.type === 'chart') return a.chart === b.chart
  if ((a.type === 'image' || a.type === 'video') && (b.type === 'image' || b.type === 'video')) return a.src === b.src
  return false
}

/** Ein Element wandert in Position, Größe, Drehung, Deckkraft, Farbe und Rundung zur neuen Form. */
function morph(
  tl: gsap.core.Timeline,
  a: Element,
  b: Element,
  nodeA: HTMLElement,
  nodeB: HTMLElement,
  duration: number,
  e: ReturnType<typeof ease>,
) {
  tl.set(nodeA, { opacity: 0 }, 0)
  tl.fromTo(
    nodeB,
    { left: a.frame.x, top: a.frame.y, width: a.frame.w, height: a.frame.h, rotation: a.frame.rotation ?? 0, opacity: a.opacity ?? 1 },
    { left: b.frame.x, top: b.frame.y, width: b.frame.w, height: b.frame.h, rotation: b.frame.rotation ?? 0, opacity: b.opacity ?? 1, duration, ease: e },
    0,
  )
  // Fläche: Farbe und Rundung mitnehmen (gemessen, damit auch Brand-Tokens stimmen).
  const innerA = nodeA.querySelector<HTMLElement>('div.el-shape, img.el-media, video.el-media')
  const innerB = nodeB.querySelector<HTMLElement>('div.el-shape, img.el-media, video.el-media')
  if (innerA && innerB) {
    const sa = getComputedStyle(innerA)
    const sb = getComputedStyle(innerB)
    const props = innerB.matches('div.el-shape') ? ['backgroundColor', 'borderRadius'] : ['borderRadius']
    const fromVars = Object.fromEntries(props.map((p) => [p, sa[p as 'borderRadius']]))
    const toVars = Object.fromEntries(props.map((p) => [p, sb[p as 'borderRadius']]))
    // Endwerte bleiben stehen (= berechnete Zielwerte); clearProps würde Reacts background-Kurzform zerstören.
    tl.fromTo(innerB, fromVars, { ...toVars, duration, ease: e }, 0)
  }
  if (a.type === 'path') morphPath(tl, nodeA, nodeB, duration, e)
  if (a.type === 'chart' && b.type === 'chart') morphChart(tl, nodeA, nodeB, b.unit, duration, e)
}

/** Pfad → Pfad: Form, Kontur und Füllung verwandeln sich. */
function morphPath(tl: gsap.core.Timeline, nodeA: HTMLElement, nodeB: HTMLElement, duration: number, e: ReturnType<typeof ease>) {
  const pa = nodeA.querySelector<SVGPathElement>('path.el-path')
  const pb = nodeB.querySelector<SVGPathElement>('path.el-path')
  if (!pa || !pb) return
  const sa = getComputedStyle(pa)
  const sb = getComputedStyle(pb)
  tl.fromTo(
    pb,
    { morphSVG: pa.getAttribute('d') ?? '', stroke: sa.stroke, fill: sa.fill, strokeWidth: sa.strokeWidth },
    { morphSVG: pb.getAttribute('d') ?? '', stroke: sb.stroke, fill: sb.fill, strokeWidth: sb.strokeWidth, duration, ease: e },
    0,
  )
}

/** Chart → Chart gleicher Art: Teile wandern von den alten zu den neuen Werten, Zahlen zählen mit. */
function morphChart(tl: gsap.core.Timeline, nodeA: HTMLElement, nodeB: HTMLElement, unit: string | undefined, duration: number, e: ReturnType<typeof ease>) {
  const all = (node: HTMLElement, sel: string) => [...node.querySelectorAll<SVGElement>(sel)]
  const num = (el: globalThis.Element | undefined, attr: string) => Number(el?.getAttribute(attr) ?? 0)
  const attrs = (el: SVGElement, names: string[]) => Object.fromEntries(names.map((n) => [n, num(el, n)]))

  // Balken: Position und Höhe; neue Balken wachsen aus der Grundlinie.
  const barsA = all(nodeA, '.chart-bar')
  all(nodeB, '.chart-bar').forEach((bar, i) => {
    const prev = barsA[i]
    const goal = attrs(bar, ['x', 'y', 'width', 'height'])
    const start = prev ? attrs(prev, ['x', 'y', 'width', 'height']) : { ...goal, y: goal.y! + goal.height!, height: 0 }
    const fill = prev ? getComputedStyle(prev).fill : getComputedStyle(bar).fill
    tl.fromTo(bar, { attr: start, fill }, { attr: goal, fill: getComputedStyle(bar).fill, duration, ease: e }, 0)
  })

  // Linie und Fläche verformen sich, Punkte wandern mit.
  const lineA = nodeA.querySelector('.chart-line')
  const lineB = nodeB.querySelector('.chart-line')
  if (lineA && lineB) tl.fromTo(lineB, { morphSVG: lineA.getAttribute('d') ?? '' }, { morphSVG: lineB.getAttribute('d') ?? '', duration, ease: e }, 0)
  const areaA = nodeA.querySelector('.chart-area')
  const areaB = nodeB.querySelector('.chart-area')
  if (areaA && areaB) tl.fromTo(areaB, { morphSVG: areaA.getAttribute('d') ?? '' }, { morphSVG: areaB.getAttribute('d') ?? '', duration, ease: e }, 0)
  const dotsA = all(nodeA, '.chart-dot')
  all(nodeB, '.chart-dot').forEach((dot, i) => {
    const prev = dotsA[i]
    if (prev) tl.fromTo(dot, { attr: attrs(prev, ['cx', 'cy']) }, { attr: attrs(dot, ['cx', 'cy']), duration, ease: e }, 0)
  })

  // Ring: Segmente verschieben und verlängern sich.
  const segsA = all(nodeA, '.chart-seg')
  all(nodeB, '.chart-seg').forEach((seg, i) => {
    const prev = segsA[i]
    const circ = Number(seg.dataset.circ ?? 0)
    const from = prev ? { strokeDasharray: prev.getAttribute('stroke-dasharray') ?? `0 ${circ}`, strokeDashoffset: num(prev, 'stroke-dashoffset') } : { strokeDasharray: `0 ${circ}` }
    tl.fromTo(seg, from, { strokeDasharray: seg.getAttribute('stroke-dasharray') ?? '', strokeDashoffset: num(seg, 'stroke-dashoffset'), duration, ease: e }, 0)
  })

  // Werte: wandern an ihren neuen Platz und zählen von alt nach neu.
  const valuesA = all(nodeA, '.chart-value')
  all(nodeB, '.chart-value').forEach((text, i) => {
    const prev = valuesA[i]
    const to = Number(text.dataset.value ?? 0)
    const from = prev ? Number(prev.dataset.value ?? 0) : 0
    if (prev) tl.fromTo(text, { attr: attrs(prev, ['x', 'y']) }, { attr: attrs(text, ['x', 'y']), duration, ease: e }, 0)
    const proxy = { v: from }
    const final = text.textContent
    tl.fromTo(
      proxy,
      { v: from },
      {
        v: to,
        duration,
        ease: e,
        onUpdate: () => {
          text.textContent = formatChartValue(Number.isInteger(to) && Number.isInteger(from) ? Math.round(proxy.v) : proxy.v, unit)
        },
        onComplete: () => {
          text.textContent = final
        },
      },
      0,
    )
  })
  // Beschriftungen wandern mit (Text bleibt der neue).
  const labelsA = all(nodeA, '.chart-label')
  all(nodeB, '.chart-label').forEach((label, i) => {
    const prev = labelsA[i]
    if (prev) tl.fromTo(label, { attr: attrs(prev, ['x', 'y']) }, { attr: attrs(label, ['x', 'y']), duration, ease: e }, 0)
    else tl.fromTo(label, { opacity: 0 }, { opacity: 1, duration, ease: 'none' }, 0)
  })
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
    if (morphsGeometry(a, b)) {
      morph(tl, a, b, nodeA, nodeB, duration, e)
      continue
    }
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
