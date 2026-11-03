import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { CustomWiggle } from 'gsap/CustomWiggle'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import type { Element, Motion, MotionProps } from '../schema/deck'
import { plainText } from './markup'

gsap.registerPlugin(CustomEase, CustomWiggle, MotionPathPlugin, MorphSVGPlugin)

/**
 * Freie Bewegungen (Phase 8a): Spuren mit from/to, Schlüsseln oder Pfad auf der Folien-Zeitleiste.
 * Ziel ist die Hülle `.el-motion` jedes Elements (innerhalb von `.el-anim`, das die Builds bewegen) –
 * Builds und Bewegungen stören sich so nicht.
 */

export const MOTION_DURATION = 800

/* ---------- Timing-Kurven ---------- */

const NAMED: Record<string, string> = {
  linear: 'none',
  in: 'power2.in',
  out: 'power3.out',
  inOut: 'power2.inOut',
  bounce: 'bounce.out',
  elastic: 'elastic.out(1, 0.4)',
  back: 'back.out(1.7)',
}

const cache = new Map<string, gsap.EaseFunction | string>()

/**
 * Gedämpfte Feder als Kurve: `bounce` 0 = gleitet ohne Überschwingen ein, 0.9 = schwingt kräftig nach.
 * Endet sicher bei 1.
 */
export function springEase(bounce: number): gsap.EaseFunction {
  const zeta = Math.max(0.08, Math.min(1, 1 - bounce))
  const omega = 7 / zeta
  if (zeta >= 1) return (t) => (t >= 1 ? 1 : 1 - Math.exp(-omega * t) * (1 + omega * t))
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  return (t) => {
    if (t >= 1) return 1
    const env = Math.exp(-zeta * omega * t)
    return 1 - env * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  }
}

/** Kurve aus dem Deck (siehe MotionEase im Schema) → GSAP. */
export function motionEase(value: string | undefined): gsap.EaseFunction | string {
  const key = (value ?? 'smooth').replace(/\s+/g, '')
  const hit = cache.get(key)
  if (hit) return hit
  let ease: gsap.EaseFunction | string
  if (key === 'smooth') ease = CustomEase.create('studio-smooth-motion', '0.32,0.72,0,1')
  else if (key === 'spring') ease = springEase(0.3)
  else if (NAMED[key]) ease = NAMED[key]!
  else if (key.startsWith('cubic-bezier(')) ease = CustomEase.create(`studio-${cache.size}`, key.slice(13, -1))
  else if (key.startsWith('spring(')) ease = springEase(Number(key.slice(7, -1)))
  else if (key.startsWith('wiggle(')) ease = CustomWiggle.create(`studio-wiggle-${cache.size}`, { wiggles: Number(key.slice(7, -1)), type: 'easeOut' })
  else if (key.startsWith('steps(')) ease = `steps(${Number(key.slice(6, -1))})`
  else ease = 'power2.out'
  cache.set(key, ease)
  return ease
}

/* ---------- Eigenschaften ---------- */

type Vars = gsap.TweenVars

/** Farbe (auch Brand-Token) als berechneter Wert – GSAP kann keine CSS-Variablen überblenden. */
function computedColor(root: HTMLElement, value: string): string {
  if (!value.startsWith('brand.')) return value
  const probe = document.createElement('span')
  probe.style.color = `var(--brand-${value.slice(6)})`
  root.append(probe)
  const out = getComputedStyle(probe).color
  probe.remove()
  return out
}

/** Bewegungs-Eigenschaften → GSAP-Werte für die Hülle; Farben gehen an eigene Ziele (siehe colorTargets). */
function transformVars(p: MotionProps | undefined): Vars {
  if (!p) return {}
  const v: Vars = {}
  if (p.x !== undefined) v.x = p.x
  if (p.y !== undefined) v.y = p.y
  if (p.z !== undefined) v.z = p.z
  if (p.scale !== undefined) v.scale = p.scale
  if (p.scaleX !== undefined) v.scaleX = p.scaleX
  if (p.scaleY !== undefined) v.scaleY = p.scaleY
  if (p.rotate !== undefined) v.rotation = p.rotate
  if (p.rotateX !== undefined) v.rotationX = p.rotateX
  if (p.rotateY !== undefined) v.rotationY = p.rotateY
  if (p.skewX !== undefined) v.skewX = p.skewX
  if (p.skewY !== undefined) v.skewY = p.skewY
  if (p.opacity !== undefined) v.opacity = p.opacity
  if (p.blur !== undefined) v.filter = `blur(${p.blur}px)`
  return v
}

/** Ruhe-Position einer Eigenschaft (= kein Versatz). */
const REST: Record<string, number | string> = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  rotationX: 0,
  rotationY: 0,
  skewX: 0,
  skewY: 0,
  opacity: 1,
  filter: 'blur(0px)',
}

function restFor(vars: Vars): Vars {
  return Object.fromEntries(Object.keys(vars).filter((k) => k in REST).map((k) => [k, REST[k]]))
}

/** Wohin Farben gehen: Text/Icon/Chart → `color` des Inhalts, Form → Hintergrund der Fläche. */
function colorTargets(wrap: HTMLElement): { color: HTMLElement | null; fill: HTMLElement | null } {
  return {
    color: wrap.querySelector<HTMLElement>(':scope > .el-text, :scope > .el-icon, :scope > .el-chart, :scope > *'),
    fill: wrap.querySelector<HTMLElement>('.el-shape'),
  }
}

/** Erster Punkt eines SVG-Pfads („M x y …“). */
function pathStart(d: string): { x: number; y: number } | null {
  const m = /^\s*[Mm]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null
}

/** Versatz, damit die Mitte des Elements auf dem Pfad liegt (Pfad in Folien-Koordinaten). */
function pathOffset(el: Element) {
  return { x: -(el.frame.x + el.frame.w / 2), y: -(el.frame.y + el.frame.h / 2) }
}

/** Anzahl der Teile, in die ein Text für `split` zerfällt (Buchstaben ohne Leerzeichen, Wörter, Zeilen). */
export function partCount(el: Element, split: Motion['split']): number {
  if (!split || el.type !== 'text') return 0
  const text = plainText(el.content)
  if (split === 'char') return text.replace(/\s+/g, '').length
  if (split === 'word') return text.split(/\s+/).filter(Boolean).length
  return text.split('\n').length
}

/** Gesamtdauer einer Bewegung in Sekunden (ohne endlose Wiederholung), inkl. Versatz der Teile. */
export function motionSpan(m: Motion, parts = 0): number {
  const d = (m.duration ?? MOTION_DURATION) / 1000 + (parts > 1 ? ((m.stagger ?? 40) / 1000) * (parts - 1) : 0)
  const repeat = m.repeat && m.repeat > 0 ? m.repeat : 0
  return d * (repeat + 1) + ((m.repeatDelay ?? 0) / 1000) * repeat
}

/** Braucht die Hülle 3D-Perspektive? */
function needs3d(m: Motion): boolean {
  const all = [m.from, m.to, ...(m.keys ?? [])]
  return all.some((p) => p && (p.z !== undefined || p.rotateX !== undefined || p.rotateY !== undefined))
}

const SPLIT_SELECTOR = { char: '.c', word: '.w', line: '.ln' } as const

/** Reihenfolge der Teile für den Versatz. */
function staggerOrder(n: number, from: Motion['staggerFrom']): number[] {
  const idx = Array.from({ length: n }, (_, i) => i)
  if (from === 'end') return idx.map((i) => n - 1 - i)
  if (from === 'center') return idx.map((i) => Math.abs(i - (n - 1) / 2))
  if (from === 'random') {
    // Wiederholbar gemischt, damit Screenshots gleich bleiben.
    const keys = idx.map((i) => {
      const x = Math.sin(i * 91.17 + 7.3) * 10000
      return x - Math.floor(x)
    })
    const sorted = [...idx].sort((a, b) => keys[a]! - keys[b]!)
    return idx.map((i) => sorted.indexOf(i))
  }
  return idx
}

/** Konturen in einem Element (für `draw`). */
function strokesIn(node: HTMLElement): SVGGeometryElement[] {
  const shapes = [...node.querySelectorAll<SVGGeometryElement>('path, line, circle, rect, polyline, polygon, ellipse')]
  return shapes.filter((s) => {
    const st = getComputedStyle(s)
    return st.stroke !== 'none' && parseFloat(st.strokeWidth) > 0
  })
}

/**
 * Baut eine Bewegung als eigene kleine Timeline (Zeit 0 = Start der Bewegung, Wiederholungen eingebaut).
 * `first` = erste Bewegung dieses Elements: ihr Startzustand gilt sofort (Zustand vor dem Abspielen).
 * Mit `split` bewegt sich jeder Buchstabe/jedes Wort/jede Zeile einzeln, versetzt um `stagger`.
 * Endlose Bewegungen (repeat −1) hängt der Aufrufer nicht in die Folien-Timeline, sondern startet sie selbst.
 */
export function buildMotion(wrap: HTMLElement, el: Element, m: Motion, first: boolean): gsap.core.Timeline {
  const sub = gsap.timeline({ paused: true, repeat: m.repeat ?? 0, yoyo: Boolean(m.yoyo), repeatDelay: (m.repeatDelay ?? 0) / 1000 })
  const duration = (m.duration ?? MOTION_DURATION) / 1000
  const ease = motionEase(m.ease)
  const root = (wrap.closest('.slide') as HTMLElement | null) ?? wrap
  if (needs3d(m)) gsap.set(wrap, { transformPerspective: 1800, transformStyle: 'preserve-3d' })

  /** Alle Tweens einer Bewegung für ein Ziel, ab `t0` in `sub`. */
  const track = (target: HTMLElement, t0: number, parts: boolean) => {
    const colorEl = parts ? target : colorTargets(wrap).color
    const fillEl = parts ? null : colorTargets(wrap).fill
    const pathEl = parts ? null : wrap.querySelector<SVGPathElement>('path.el-path')
    const textPathEl = parts ? null : wrap.querySelector<SVGTextPathElement>('textPath')
    const strokes = parts ? [] : strokesIn(wrap)

    /** Ein Abschnitt von `a` nach `b` (Form, Farbe, Kontur eingeschlossen). */
    const segment = (a: MotionProps | undefined, b: MotionProps | undefined, start: number, dur: number, segEase: gsap.EaseFunction | string, render: boolean) => {
      const at = t0 + start
      const base = { duration: dur, ease: segEase }
      const fromV = transformVars(a)
      const toV = { ...(b ? transformVars(b) : restFor(fromV)) }
      // Was nur im Start steht, läuft zurück zur Ruhe-Position.
      for (const k of Object.keys(fromV)) if (!(k in toV) && k in REST) toV[k] = REST[k]
      if (Object.keys(fromV).length) sub.fromTo(target, { ...fromV }, { ...toV, ...base, immediateRender: render }, at)
      else if (Object.keys(toV).length) sub.to(target, { ...toV, ...base }, at)

      const colorFrom = a?.color && colorEl ? computedColor(root, a.color) : undefined
      const colorTo = b?.color && colorEl ? computedColor(root, b.color) : undefined
      if (colorEl && (colorFrom || colorTo)) {
        const goal = colorTo ?? getComputedStyle(colorEl).color
        if (colorFrom) sub.fromTo(colorEl, { color: colorFrom }, { color: goal, ...base, immediateRender: render }, at)
        else sub.to(colorEl, { color: goal, ...base }, at)
      }
      const fillFrom = a?.fill && fillEl ? computedColor(root, a.fill) : undefined
      const fillTo = b?.fill && fillEl ? computedColor(root, b.fill) : undefined
      if (fillEl && (fillFrom || fillTo)) {
        const goal = fillTo ?? getComputedStyle(fillEl).backgroundColor
        if (fillFrom) sub.fromTo(fillEl, { backgroundColor: fillFrom }, { backgroundColor: goal, ...base, immediateRender: render }, at)
        else sub.to(fillEl, { backgroundColor: goal, ...base }, at)
      }
      // Formwandel (Pfad-Elemente).
      if (pathEl && (a?.d || b?.d)) {
        const goal = b?.d ?? pathEl.getAttribute('d') ?? ''
        if (a?.d) sub.fromTo(pathEl, { morphSVG: a.d }, { morphSVG: goal, ...base, immediateRender: render }, at)
        else sub.to(pathEl, { morphSVG: goal, ...base }, at)
      }
      // Kontur zeichnen/wegnehmen.
      if (strokes.length && (a?.draw !== undefined || b?.draw !== undefined)) {
        for (const s of strokes) {
          const len = s.getTotalLength()
          const fromDraw = a?.draw ?? 1
          const toDraw = b?.draw ?? 1
          sub.fromTo(
            s,
            { strokeDasharray: len, strokeDashoffset: len * (1 - fromDraw) },
            { strokeDashoffset: len * (1 - toDraw), ...base, immediateRender: render && a?.draw !== undefined },
            at,
          )
        }
      }
      // Text auf dem Pfad wandern lassen.
      if (textPathEl && (a?.textOffset !== undefined || b?.textOffset !== undefined)) {
        const current = parseFloat(textPathEl.getAttribute('startOffset') ?? '0')
        const goal = `${b?.textOffset ?? current}%`
        if (a?.textOffset !== undefined) sub.fromTo(textPathEl, { attr: { startOffset: `${a.textOffset}%` } }, { attr: { startOffset: goal }, ...base, immediateRender: render }, at)
        else sub.to(textPathEl, { attr: { startOffset: goal }, ...base }, at)
      }
    }

    if (m.path) {
      const off = pathOffset(el)
      const startPt = pathStart(m.path)
      const fromV = transformVars(m.from)
      const toV = m.to ? transformVars(m.to) : restFor(fromV)
      const motionPath = { path: m.path, autoRotate: Boolean(m.orient), offsetX: off.x, offsetY: off.y }
      const initial = { ...fromV, ...(startPt ? { x: startPt.x + off.x, y: startPt.y + off.y } : {}) }
      sub.fromTo(target, initial, { ...toV, motionPath, duration, ease, immediateRender: first }, t0)
    } else if (m.keys) {
      const keys = m.keys
      const n = keys.length
      const pos = keys.map((k, i) => k.t ?? i / (n - 1))
      for (let i = 1; i < n; i++) {
        const segDur = Math.max(0.001, (pos[i]! - pos[i - 1]!) * duration)
        const segEase = keys[i - 1]!.ease ? motionEase(keys[i - 1]!.ease) : ease
        segment(keys[i - 1], keys[i], pos[i - 1]! * duration, segDur, segEase, first && i === 1)
      }
    } else {
      segment(m.from, m.to, 0, duration, ease, first)
    }
  }

  const parts = m.split ? [...wrap.querySelectorAll<HTMLElement>(SPLIT_SELECTOR[m.split])] : []
  if (parts.length) {
    const order = staggerOrder(parts.length, m.staggerFrom)
    const each = (m.stagger ?? 40) / 1000
    parts.forEach((part, i) => track(part, (order[i] ?? i) * each, true))
  } else track(wrap, 0, false)

  // In der Folien-Timeline steuert die Folie; allein (endlos) startet der Aufrufer.
  sub.paused(false)
  return sub
}

/** Elemente mit Bewegung bekommen die Hülle `.el-motion` – SlideView fragt das hier ab. */
export function hasMotion(el: Element): boolean {
  return Boolean(el.motion?.length)
}
