import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import type { Animation, Element, Slide } from '../schema/deck'
import { formatGermanNumber, parseGermanNumber } from './text'

gsap.registerPlugin(CustomEase)

/** Easing-Namen aus dem Schema → GSAP. "smooth" ist die Apple-Kurve aus den Motion-Tokens. */
const EASE = {
  smooth: CustomEase.create('studio-smooth', '0.32,0.72,0,1'),
  spring: 'expo.out',
  linear: 'none',
  in: 'power2.in',
  out: 'power3.out',
  inOut: 'power2.inOut',
} as const

export function ease(name: Animation['easing'] | undefined): gsap.EaseString | gsap.EaseFunction {
  return EASE[name ?? 'smooth']
}

/** Standarddauer je Preset in ms – ruhig, siehe STYLE.md. */
export const PRESET_DURATION: Record<Animation['preset'], number> = {
  fade: 500,
  rise: 600,
  blurRise: 800,
  scaleIn: 600,
  maskReveal: 900,
  wordByWord: 900,
  lineByLine: 900,
  drawLine: 1000,
  countUp: 1600,
  kenBurns: 6000,
}

/* ---------- Schritte berechnen ---------- */

export type BuildItem = {
  element: Element
  kind: 'in' | 'out'
  anim: Animation
  /** Start relativ zum Beginn des Schritts, in Sekunden. */
  start: number
  duration: number
}

/**
 * Ein Schritt = was mit einem Klick passiert. Schritt 0 läuft automatisch beim Betreten der Folie
 * (alle Builds vor dem ersten "click"); er kann leer sein. Klicks auf der Folie = steps.length - 1.
 */
export type Step = { items: BuildItem[]; duration: number }

export function computeSteps(slide: Slide, skipIn: ReadonlySet<string> = new Set()): Step[] {
  type Entry = { element: Element; kind: 'in' | 'out'; anim: Animation; trigger: string; order: number }
  const entries: Entry[] = []
  slide.elements.forEach((element, index) => {
    const b = element.build
    if (!b || element.hidden) return
    const order = b.order ?? index
    const trigger = b.trigger ?? 'click'
    if (b.in && !skipIn.has(element.id)) entries.push({ element, kind: 'in', anim: b.in, trigger, order })
    // Ausblendungen sind eigene Klicks nach allen Einblendungen der Folie.
    if (b.out) entries.push({ element, kind: 'out', anim: b.out, trigger: 'click', order: 1e6 + order })
  })
  entries.sort((a, b) => a.order - b.order)

  const steps: Step[] = [{ items: [], duration: 0 }]
  let prev: BuildItem | null = null
  for (const e of entries) {
    const duration = (e.anim.duration ?? PRESET_DURATION[e.anim.preset]) / 1000
    const delay = (e.anim.delay ?? 0) / 1000
    let step = steps[steps.length - 1]!
    let start: number
    if (e.trigger === 'click') {
      step = { items: [], duration: 0 }
      steps.push(step)
      start = delay
    } else if (e.trigger === 'withPrevious' && prev) {
      start = prev.start + delay
    } else {
      start = (prev ? prev.start + prev.duration : 0) + delay
    }
    const item: BuildItem = { element: e.element, kind: e.kind, anim: e.anim, start, duration }
    step.items.push(item)
    step.duration = Math.max(step.duration, start + duration)
    prev = item
  }
  return steps
}

/* ---------- Timeline auf dem DOM ---------- */

type Vars = gsap.TweenVars

function offset(direction: Animation['direction'], distance: number): Vars {
  switch (direction ?? 'up') {
    case 'up':
      return { y: distance }
    case 'down':
      return { y: -distance }
    case 'left':
      return { x: distance }
    case 'right':
      return { x: -distance }
  }
}

function maskFrom(direction: Animation['direction']): string {
  switch (direction ?? 'right') {
    case 'right':
      return 'inset(-20% 100% -20% -20%)'
    case 'left':
      return 'inset(-20% -20% -20% 100%)'
    case 'up':
      return 'inset(100% -20% -20% -20%)'
    case 'down':
      return 'inset(-20% -20% 100% -20%)'
  }
}
const MASK_OPEN = 'inset(-20% -20% -20% -20%)'

/** Unsichtbarer Ausgangszustand eines Presets (für Ausblend-Builds und einfache Einblendungen). */
function hiddenVars(anim: Animation): Vars {
  switch (anim.preset) {
    case 'rise':
      return { opacity: 0, ...offset(anim.direction, 40) }
    case 'blurRise':
      return { opacity: 0, ...offset(anim.direction, 50), filter: 'blur(16px)' }
    case 'scaleIn':
      return { opacity: 0, scale: 0.92 }
    case 'maskReveal':
      return { clipPath: maskFrom(anim.direction) }
    default:
      return { opacity: 0 }
  }
}

const shownVars: Vars = { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', clipPath: MASK_OPEN }

function shownFor(hidden: Vars): Vars {
  return Object.fromEntries(Object.keys(hidden).map((k) => [k, shownVars[k]]))
}

/** Fügt eine Einblendung ein. `at` = absolute Startzeit in der Timeline. */
function addIn(tl: gsap.core.Timeline, target: HTMLElement, item: BuildItem, at: number) {
  const { anim, duration } = item
  const e = ease(anim.easing)
  switch (anim.preset) {
    case 'wordByWord':
    case 'lineByLine': {
      const parts = target.querySelectorAll<HTMLElement>(anim.preset === 'wordByWord' ? '.w' : '.ln')
      if (!parts.length) break
      const each = Math.min(0.6, duration * 0.7)
      const stagger = parts.length > 1 ? (duration - each) / (parts.length - 1) : 0
      tl.fromTo(
        parts,
        { opacity: 0, ...offset(anim.direction, 24), filter: 'blur(8px)' },
        { opacity: 1, x: 0, y: 0, filter: 'blur(0px)', duration: each, ease: e, stagger },
        at,
      )
      return
    }
    case 'drawLine': {
      const shapes = target.querySelectorAll<SVGGeometryElement>('path, line, circle, rect, polyline, polygon, ellipse')
      const strokes = [...shapes].filter((s) => getComputedStyle(s).stroke !== 'none')
      if (!strokes.length) break
      strokes.forEach((s) => {
        const len = s.getTotalLength()
        tl.fromTo(
          s,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration, ease: e },
          at,
        )
      })
      // Gefüllte Teile (z. B. Pfeilspitze) blenden am Ende ein.
      const fills = [...shapes].filter((s) => !strokes.includes(s))
      if (fills.length) tl.fromTo(fills, { opacity: 0 }, { opacity: 1, duration: 0.25 }, at + duration * 0.8)
      return
    }
    case 'countUp': {
      const span = target.querySelector<HTMLElement>('.count')
      if (!span) break
      const raw = span.dataset.value ?? span.textContent ?? '0'
      const { value, decimals } = parseGermanNumber(raw)
      const grouping = raw.includes('.') || value >= 10000
      const proxy = { v: 0 }
      span.textContent = formatGermanNumber(0, decimals, grouping)
      tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, at)
      tl.fromTo(
        proxy,
        { v: 0 },
        {
          v: value,
          duration,
          ease: 'expo.out',
          onUpdate: () => {
            span.textContent = formatGermanNumber(proxy.v, decimals, grouping)
          },
        },
        at,
      )
      return
    }
    case 'kenBurns': {
      tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: Math.min(0.8, duration), ease: 'none' }, at)
      tl.fromTo(target, { scale: 1.12 }, { scale: 1, duration, ease: 'power1.out' }, at)
      return
    }
  }
  const hidden = hiddenVars(anim)
  tl.fromTo(target, hidden, { ...shownFor(hidden), duration, ease: e }, at)
}

function addOut(tl: gsap.core.Timeline, target: HTMLElement, item: BuildItem, at: number) {
  const hidden = hiddenVars(item.anim)
  tl.fromTo(target, shownFor(hidden), { ...hidden, duration: item.duration, ease: ease(item.anim.easing ?? 'inOut') }, at)
}

export type SlideTimeline = {
  timeline: gsap.core.Timeline
  steps: Step[]
  /** Endzeit jedes Schritts in Sekunden. */
  ends: number[]
  /** Startzeit jedes Schritts in Sekunden. */
  starts: number[]
  /** Zustand nach Schritt `index` (−1 = vor allem). Sofort, ohne Animation. */
  seek: (index: number) => void
  /** Spielt Schritt `index` ab (vorherige Schritte werden vorher abgeschlossen). */
  play: (index: number) => gsap.core.Tween
  /** Läuft gerade ein Schritt? Dann sofort zu Ende spielen und true liefern. */
  finish: () => boolean
  kill: () => void
}

/**
 * Baut die Build-Timeline einer gerenderten Folie. `root` ist das .slide-Element.
 * Nach dem Erzeugen sind alle Elemente mit Einblendung versteckt (Zustand −1).
 */
export function createSlideTimeline(
  root: HTMLElement,
  slide: Slide,
  options: { skipIn?: ReadonlySet<string> } = {},
): SlideTimeline {
  const steps = computeSteps(slide, options.skipIn)
  const timeline = gsap.timeline({ paused: true })
  const starts: number[] = []
  const ends: number[] = []
  let t = 0
  steps.forEach((step, i) => {
    starts.push(t)
    timeline.addLabel(`step-${i}`, t)
    for (const item of step.items) {
      const target = root.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(item.element.id)}"] > .el-anim`)
      if (!target) continue
      if (item.kind === 'in') addIn(timeline, target, item, t + item.start)
      else addOut(timeline, target, item, t + item.start)
    }
    // Kleine Lücke, damit Schrittgrenzen eindeutig sind.
    t += step.duration + 0.001
    ends.push(t)
  })
  timeline.seek(0, false)

  let current: gsap.core.Tween | null = null
  const stop = () => {
    current?.kill()
    current = null
  }
  return {
    timeline,
    steps,
    starts,
    ends,
    seek(index) {
      stop()
      timeline.seek(index < 0 ? 0 : (ends[index] ?? timeline.duration()), false)
    },
    play(index) {
      stop()
      timeline.seek(starts[index] ?? 0, false)
      current = timeline.tweenFromTo(starts[index] ?? 0, ends[index] ?? timeline.duration(), { ease: 'none' })
      return current
    },
    finish() {
      if (!current?.isActive()) return false
      current.progress(1)
      current = null
      return true
    },
    kill() {
      stop()
      timeline.kill()
    },
  }
}
