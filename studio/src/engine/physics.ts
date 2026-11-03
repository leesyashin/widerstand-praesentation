import type { Element, Motion } from '../schema/deck'

/**
 * Kleine, vorab berechnete 2D-Physik für Bewegungen mit `physics`: Schwerkraft, Abprallen an Boden und Rändern,
 * Reibung, Drehung und Zusammenstöße (als Kreise) zwischen allen Physik-Elementen eines Schritts.
 * Vorab berechnet = spulbar und bei jedem Abspielen gleich – die Timeline liest nur noch Bilder ab.
 */

export const PHYSICS_FPS = 60

export type PhysicsBody = { key: string; el: Element; motion: Motion; at: number; duration: number }
/** Pro Bild: x, y (Versatz zur Ruhe-Position) und Drehung. */
export type PhysicsTrack = Float32Array

export function simulate(bodies: PhysicsBody[], slideW: number, slideH: number): Map<string, PhysicsTrack> {
  const dt = 1 / 240
  const sub = 240 / PHYSICS_FPS
  const state = bodies.map((b) => {
    const p = b.motion.physics ?? {}
    const f = b.el.frame
    const hw = f.w / 2
    const hh = f.h / 2
    return {
      b,
      p,
      restX: f.x + hw,
      restY: f.y + hh,
      cx: f.x + hw + (b.motion.from?.x ?? 0),
      cy: f.y + hh + (b.motion.from?.y ?? 0),
      rot: b.motion.from?.rotate ?? 0,
      vx: p.velocity?.x ?? 0,
      vy: p.velocity?.y ?? 0,
      spin: p.spin ?? 0,
      hw,
      hh,
      r: Math.min(hw, hh) * 0.95,
      mass: Math.max(1, f.w * f.h),
      frames: [] as number[],
    }
  })
  const end = Math.max(0, ...bodies.map((b) => b.at + b.duration))
  const steps = Math.ceil(end / dt)
  for (let n = 0; n <= steps; n++) {
    const t = n * dt
    const active = state.filter((s) => t >= s.b.at)
    for (const s of active) {
      const g = s.p.gravity ?? 2400
      const bounce = s.p.bounce ?? 0.5
      const friction = s.p.friction ?? 0.15
      s.vy += g * dt
      s.cx += s.vx * dt
      s.cy += s.vy * dt
      s.rot += s.spin * dt
      const floor = s.p.floor ?? slideH
      if (s.cy + s.hh > floor) {
        s.cy = floor - s.hh
        if (s.vy > 0) s.vy = Math.abs(s.vy) < 60 ? 0 : -s.vy * bounce
        s.vx *= 1 - friction * 0.25
        // Auf dem Boden rollt es: Drehung folgt der Geschwindigkeit.
        const rolling = (s.vx / Math.max(1, s.r)) * (180 / Math.PI)
        s.spin = s.spin * 0.9 + rolling * 0.1
      }
      if (s.p.walls ?? true) {
        if (s.cx - s.hw < 0 && s.vx < 0) {
          s.cx = s.hw
          s.vx = -s.vx * bounce
        }
        if (s.cx + s.hw > slideW && s.vx > 0) {
          s.cx = slideW - s.hw
          s.vx = -s.vx * bounce
        }
      }
    }
    // Zusammenstöße (Kreise), Impuls nach Masse verteilt.
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]!
        const c = active[j]!
        if (a.p.collide === false || c.p.collide === false) continue
        const dx = c.cx - a.cx
        const dy = c.cy - a.cy
        const d = Math.hypot(dx, dy)
        const min = a.r + c.r
        if (d <= 0 || d >= min) continue
        const nx = dx / d
        const ny = dy / d
        const overlap = min - d
        const ia = 1 / a.mass
        const ic = 1 / c.mass
        a.cx -= nx * overlap * (ia / (ia + ic))
        a.cy -= ny * overlap * (ia / (ia + ic))
        c.cx += nx * overlap * (ic / (ia + ic))
        c.cy += ny * overlap * (ic / (ia + ic))
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny
        if (vn < 0) {
          const e = Math.min(a.p.bounce ?? 0.5, c.p.bounce ?? 0.5)
          const jImp = (-(1 + e) * vn) / (ia + ic)
          a.vx -= jImp * ia * nx
          a.vy -= jImp * ia * ny
          c.vx += jImp * ic * nx
          c.vy += jImp * ic * ny
          a.spin -= (jImp * ia * 40) / Math.max(1, a.r)
          c.spin += (jImp * ic * 40) / Math.max(1, c.r)
        }
      }
    }
    if (n % sub === 0) {
      for (const s of state) {
        if (t < s.b.at || t > s.b.at + s.b.duration + 1e-6) continue
        s.frames.push(s.cx - s.restX, s.cy - s.restY, s.rot)
      }
    }
  }
  return new Map(state.map((s) => [s.b.key, Float32Array.from(s.frames.length ? s.frames : [s.cx - s.restX, s.cy - s.restY, s.rot])]))
}
