import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createProgram, type Uniforms } from './program'

/**
 * Canvas mit einem Fragment-Shader. `uniforms` wird pro Frame neu gelesen (Funktion → live).
 * `animate`: läuft mit requestAnimationFrame, sonst ein einzelnes Bild bei `time`.
 * `quality`: Auflösung relativ zur Bildschirmgröße (weiche Verläufe brauchen weniger).
 * `deps`: ändert sich dieser Schlüssel, wird neu gezeichnet (für Standbilder mit neuen Werten).
 * Ohne WebGL wird `fallback` gezeigt.
 */
export function ShaderCanvas({
  fragment,
  uniforms,
  animate,
  time = 2.5,
  quality = 1,
  className,
  style,
  fallback,
  deps = '',
}: {
  fragment: string
  uniforms: () => Uniforms
  animate: boolean
  time?: number
  quality?: number
  className?: string
  style?: CSSProperties
  fallback?: ReactNode
  deps?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef(uniforms)
  useEffect(() => {
    latest.current = uniforms
  })

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const program = createProgram(el, fragment)
    if (!program) {
      setFailed(true)
      return
    }
    let frame = 0
    const start = performance.now()
    const draw = () => {
      const rect = el.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(2, Math.min(2560, Math.round(rect.width * dpr * quality)))
      const h = Math.max(2, Math.min(1600, Math.round(rect.height * dpr * quality)))
      const t = animate ? time + (performance.now() - start) / 1000 : time
      program.render({ u_time: t, ...latest.current() }, w, h)
      if (animate) frame = requestAnimationFrame(draw)
    }
    // Ein Frame Verzögerung, damit Layout und Brand-Variablen stehen.
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      program.destroy()
    }
  }, [fragment, animate, time, quality, deps])

  if (failed) return <>{fallback}</>
  return <canvas ref={canvas} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />
}
