import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import type { Animation, Element, Motion, Slide } from '../schema/deck'
import { BUILD_IN_EVENT } from './buildEvents'
import { buildMotion, motionSpan, partCount } from './motion'
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
  grow: 1400,
  charByChar: 1000,
  typewriter: 1200,
  scramble: 1300,
  assemble: 1600,
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
export type MotionItem = {
  element: Element
  motion: Motion
  /** Index in `element.motion` (für den Editor). */
  index: number
  /** Start relativ zum Beginn des Schritts, in Sekunden. */
  start: number
  /** Dauer einer Runde inkl. endlicher Wiederholungen. */
  duration: number
  /** Endlos – zählt nicht zur Schrittdauer. */
  loop: boolean
}

export type Step = { items: BuildItem[]; motions: MotionItem[]; duration: number }

export function computeSteps(slide: Slide, skipIn: ReadonlySet<string> = new Set()): Step[] {
  type Entry = { element: Element; kind: 'in' | 'out'; anim: Animation; trigger: string; order: number }
  // Szene: alles läuft nach Zeit in einem Durchgang – Klick-Auslöser werden zu „danach“.
  const scene = Boolean(slide.scene)
  const entries: Entry[] = []
  slide.elements.forEach((element, index) => {
    const b = element.build
    if (!b || element.hidden) return
    const order = b.order ?? index
    const trigger = scene && (b.trigger ?? 'click') === 'click' ? 'afterPrevious' : (b.trigger ?? 'click')
    if (b.in && !skipIn.has(element.id)) entries.push({ element, kind: 'in', anim: b.in, trigger, order })
    // Ausblendungen sind eigene Klicks nach allen Einblendungen der Folie.
    if (b.out) entries.push({ element, kind: 'out', anim: b.out, trigger: scene ? 'afterPrevious' : 'click', order: 1e6 + order })
  })
  entries.sort((a, b) => a.order - b.order)

  const steps: Step[] = [{ items: [], motions: [], duration: 0 }]
  let prev: BuildItem | null = null
  for (const e of entries) {
    const duration = (e.anim.duration ?? PRESET_DURATION[e.anim.preset]) / 1000
    const delay = (e.anim.delay ?? 0) / 1000
    let step = steps[steps.length - 1]!
    let start: number
    if (e.trigger === 'click') {
      step = { items: [], motions: [], duration: 0 }
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

  // Freie Bewegungen: an ihrem Schritt (fehlende Klick-Schritte entstehen dabei), Start = `at`.
  for (const element of slide.elements) {
    if (element.hidden) continue
    element.motion?.forEach((motion, index) => {
      const n = scene ? 0 : (motion.step ?? 0)
      while (steps.length <= n) steps.push({ items: [], motions: [], duration: 0 })
      const step = steps[n]!
      const start = (motion.at ?? 0) / 1000
      const loop = motion.repeat === -1
      const parts = partCount(element, motion.split)
      const duration = loop ? motionSpan({ ...motion, repeat: 0 }, parts) : motionSpan(motion, parts)
      step.motions.push({ element, motion, index, start, duration, loop })
      if (!loop) step.duration = Math.max(step.duration, start + duration)
    })
  }
  if (scene && slide.scene?.duration) steps[0]!.duration = Math.max(steps[0]!.duration, slide.scene.duration / 1000)
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
    case 'grow':
      return { opacity: 0, scale: 0.92 }
    case 'maskReveal':
      return { clipPath: maskFrom(anim.direction) }
    default:
      return { opacity: 0 }
  }
}

const shownVars: Vars = { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', clipPath: MASK_OPEN }

function shownFor(hidden: Vars): Vars {
  const shown: Vars = Object.fromEntries(Object.keys(hidden).map((k) => [k, shownVars[k]]))
  // Filter und Masken nach dem Einblenden entfernen: sie würden sonst Glas-Effekte (backdrop-filter) darunter abschneiden.
  const clear = ['filter', 'clipPath'].filter((k) => k in hidden)
  if (clear.length) shown.clearProps = clear.join(',')
  return shown
}

/** Fügt eine Einblendung ein. `at` = absolute Startzeit in der Timeline. */
function addIn(tl: gsap.core.Timeline, target: HTMLElement, item: BuildItem, at: number) {
  const { anim, duration } = item
  const e = ease(anim.easing)
  tl.call(() => void target.dispatchEvent(new CustomEvent(BUILD_IN_EVENT)), undefined, at)
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
        { opacity: 1, x: 0, y: 0, filter: 'blur(0px)', clearProps: 'filter', duration: each, ease: e, stagger },
        at,
      )
      return
    }
    case 'drawLine': {
      const shapes = target.querySelectorAll<SVGGeometryElement>('path, line, circle, rect, polyline, polygon, ellipse')
      const strokes = [...shapes].filter((s) => getComputedStyle(s).stroke !== 'none')
      if (!strokes.length) break
      // Ausgeblendet starten: runde Linienenden wären sonst schon als Punkte sichtbar.
      tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none' }, at)
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
    case 'grow': {
      if (!addChartGrow(tl, target, duration, at)) break
      return
    }
    case 'charByChar':
    case 'typewriter':
    case 'scramble':
    case 'assemble': {
      if (!addCharsIn(tl, target, item, at)) break
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

/** Chart-Aufbau: Balken wachsen, Linien und Ringe zeichnen sich, Werte blenden nach. */
function addChartGrow(tl: gsap.core.Timeline, target: HTMLElement, duration: number, at: number): boolean {
  const bars = target.querySelectorAll('.chart-bar')
  const lines = target.querySelectorAll<SVGPathElement>('.chart-line')
  const segs = target.querySelectorAll<SVGCircleElement>('.chart-seg')
  if (!bars.length && !lines.length && !segs.length) return false
  const texts = target.querySelectorAll('.chart-value, .chart-label')
  const main = duration * 0.75
  // Achsen und Ring-Spur kommen mit einem kurzen Einblenden des ganzen Charts.
  tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'none' }, at)
  if (bars.length) {
    tl.fromTo(
      bars,
      { scaleY: 0, transformOrigin: '50% 100%' },
      { scaleY: 1, duration: main * 0.7, ease: 'expo.out', stagger: (main * 0.3) / Math.max(1, bars.length - 1) },
      at,
    )
  }
  lines.forEach((line) => {
    const len = line.getTotalLength()
    tl.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: main, ease: 'power2.inOut' }, at)
  })
  const dots = target.querySelectorAll('.chart-dot')
  if (dots.length) {
    tl.fromTo(dots, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(2)', stagger: main / Math.max(1, dots.length) }, at + 0.1)
  }
  const area = target.querySelectorAll('.chart-area')
  if (area.length) tl.fromTo(area, { opacity: 0 }, { opacity: 1, duration: main * 0.6, ease: 'none' }, at + main * 0.4)
  let offset = 0
  segs.forEach((seg) => {
    const len = Number(seg.dataset.len ?? 0)
    const circ = Number(seg.dataset.circ ?? 0)
    const part = segs.length ? main / segs.length : main
    tl.fromTo(seg, { strokeDasharray: `0 ${circ}` }, { strokeDasharray: `${len} ${circ}`, duration: part, ease: 'power2.inOut' }, at + offset)
    offset += part
  })
  if (texts.length) tl.fromTo(texts, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none', stagger: 0.04 }, at + main * 0.6)
  return true
}

/* ---------- Kinetische Typo ---------- */

/** Wiederholbarer Zufall (gleiche Folie = gleiches Bild, auch in Screenshots). */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?/<>'

/** Buchstaben-Builds: Teile sind die .c-Spans (siehe text.tsx, split "char"). */
function addCharsIn(tl: gsap.core.Timeline, target: HTMLElement, item: BuildItem, at: number): boolean {
  const chars = [...target.querySelectorAll<HTMLElement>('.c')]
  if (!chars.length) return false
  const { anim, duration } = item
  const n = chars.length
  const e = ease(anim.easing)
  switch (anim.preset) {
    case 'charByChar': {
      const each = Math.min(0.55, duration * 0.55)
      const stagger = n > 1 ? (duration - each) / (n - 1) : 0
      tl.fromTo(
        chars,
        { opacity: 0, ...offset(anim.direction, 28), filter: 'blur(6px)' },
        { opacity: 1, x: 0, y: 0, filter: 'blur(0px)', clearProps: 'filter', duration: each, ease: e, stagger },
        at,
      )
      return true
    }
    case 'typewriter': {
      // Jedes Zeichen erscheint schlagartig, gleichmäßiger Takt.
      tl.fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.001, ease: 'none', stagger: duration / n }, at)
      return true
    }
    case 'scramble': {
      const proxy = { p: 0 }
      const finals = chars.map((c) => c.dataset.ch ?? c.textContent ?? '')
      let widths: number[] = []
      const render = () => {
        const done = proxy.p * (n + 4) - 4
        chars.forEach((c, i) => {
          if (proxy.p >= 1 || i < done) {
            c.textContent = finals[i] ?? ''
            c.style.width = ''
            c.style.textAlign = ''
          } else {
            const g = Math.floor(seeded(i, Math.floor(proxy.p * 40)) * GLYPHS.length)
            if (widths[i]) {
              c.style.width = `${widths[i]}px`
              c.style.textAlign = 'center'
            }
            c.textContent = i < done + 6 ? (GLYPHS[g] ?? '#') : ''
          }
        })
      }
      tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none' }, at)
      tl.fromTo(
        proxy,
        { p: 0 },
        {
          p: 1,
          duration,
          ease: 'none',
          onStart: () => {
            widths = chars.map((c) => c.getBoundingClientRect().width / Math.max(0.0001, scaleOf(c)))
          },
          onUpdate: render,
          onComplete: render,
          onReverseComplete: render,
        },
        at,
      )
      return true
    }
    case 'assemble': {
      const each = Math.min(1, duration * 0.6)
      chars.forEach((c, i) => {
        const r = (k: number) => seeded(i, k) * 2 - 1
        tl.fromTo(
          c,
          { x: r(1) * 420, y: r(2) * 280, rotation: r(3) * 120, scale: 0.4 + seeded(i, 4) * 1.4, opacity: 0, filter: 'blur(8px)' },
          { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, filter: 'blur(0px)', clearProps: 'filter', duration: each, ease: 'expo.out' },
          at + seeded(i, 5) * (duration - each),
        )
      })
      return true
    }
  }
  return false
}

/** Ausblenden in Buchstaben: „assemble“ zerfällt in alle Richtungen, sonst verschwinden die Zeichen von hinten. */
function addCharsOut(tl: gsap.core.Timeline, target: HTMLElement, item: BuildItem, at: number): boolean {
  const chars = [...target.querySelectorAll<HTMLElement>('.c')]
  if (!chars.length) return false
  const { anim, duration } = item
  if (anim.preset === 'assemble') {
    const each = Math.min(1, duration * 0.6)
    chars.forEach((c, i) => {
      const r = (k: number) => seeded(i, k + 10) * 2 - 1
      tl.fromTo(
        c,
        { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 },
        { x: r(1) * 520, y: r(2) * 340, rotation: r(3) * 160, scale: 0.3 + seeded(i, 14), opacity: 0, duration: each, ease: 'power2.in', immediateRender: false },
        at + seeded(i, 15) * (duration - each),
      )
    })
    return true
  }
  const each = anim.preset === 'typewriter' ? 0.001 : Math.min(0.4, duration * 0.5)
  tl.fromTo(chars, { opacity: 1 }, { opacity: 0, duration: each, ease: 'none', stagger: { each: (duration - each) / chars.length, from: 'end' }, immediateRender: false }, at)
  return true
}

/** Bildschirm-Maßstab eines Elements (Bühne ist skaliert) – für Breiten in logischen Pixeln. */
function scaleOf(el: HTMLElement): number {
  const stage = el.closest<HTMLElement>('.stage__surface')
  const m = stage ? /scale\(([\d.]+)\)/.exec(stage.style.transform) : null
  return m ? Number(m[1]) : 1
}

const CHAR_PRESETS = new Set(['charByChar', 'typewriter', 'scramble', 'assemble'])

function addOut(tl: gsap.core.Timeline, target: HTMLElement, item: BuildItem, at: number) {
  if (CHAR_PRESETS.has(item.anim.preset) && addCharsOut(tl, target, item, at)) return
  const hidden = hiddenVars(item.anim)
  // Nicht sofort anwenden: sonst überschreibt das Ausblenden den versteckten Startzustand der Einblendung.
  tl.fromTo(target, shownFor(hidden), { ...hidden, duration: item.duration, ease: ease(item.anim.easing ?? 'inOut'), immediateRender: false }, at)
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
  /** Endlose Bewegungen laufen neben der Folien-Timeline: ab ihrem Schritt, bis die Folie geht. */
  const loops: { step: number; at: number; tl: gsap.core.Timeline }[] = []
  const seen = new Set<string>()
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
    // Nach Startzeit, damit die erste Bewegung eines Elements dessen Startzustand bestimmt.
    for (const item of [...step.motions].sort((a, b) => a.start - b.start)) {
      const wrap = root.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(item.element.id)}"] .el-motion`)
      if (!wrap) continue
      const first = !seen.has(item.element.id)
      seen.add(item.element.id)
      const sub = buildMotion(wrap, item.element, item.motion, first)
      if (item.loop) {
        sub.pause(0)
        loops.push({ step: i, at: t + item.start, tl: sub })
        timeline.call(() => void sub.restart(), undefined, t + item.start)
      } else timeline.add(sub, t + item.start)
    }
    // Kleine Lücke, damit Schrittgrenzen eindeutig sind.
    t += step.duration + 0.001
    ends.push(t)
  })
  timeline.seek(0, false)

  /** Endlose Bewegungen passend zum Stand nach Schritt `index` (−1 = vor allem). */
  const syncLoops = (index: number, startingNow = -2) => {
    for (const l of loops) {
      if (l.step < index || (l.step === index && l.step !== startingNow)) {
        if (!l.tl.isActive()) l.tl.play()
      } else if (l.step !== startingNow) l.tl.pause(0)
    }
  }

  const scene = slide.scene
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
      syncLoops(index)
    },
    play(index) {
      stop()
      timeline.seek(starts[index] ?? 0, false)
      syncLoops(index - 1, index)
      const from = starts[index] ?? 0
      const to = ends[index] ?? timeline.duration()
      // Szene mit Schleife: läuft immer wieder von vorn, bis weitergeklickt wird.
      current = timeline.tweenFromTo(from, to, { ease: 'none', ...(scene?.loop ? { repeat: -1 } : {}) })
      return current
    },
    finish() {
      // Szenen laufen weiter – ein Klick geht direkt zur nächsten Folie.
      if (scene) return false
      if (!current?.isActive()) return false
      current.progress(1)
      current = null
      syncLoops(steps.length)
      return true
    },
    kill() {
      stop()
      // Scramble schreibt Zeichen direkt – Originale zurück.
      for (const c of root.querySelectorAll<HTMLElement>('.c[data-ch]')) {
        if (c.textContent !== c.dataset.ch) c.textContent = c.dataset.ch ?? ''
        c.style.width = ''
        c.style.textAlign = ''
      }
      // Zurück auf die gerenderten Werte: eine neue Timeline auf demselben DOM startet sonst vom alten Endzustand.
      for (const l of loops) l.tl.revert()
      timeline.revert()
      timeline.kill()
    },
  }
}
