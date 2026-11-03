import { useEffect, useRef } from 'react'
import { assetUrl } from '../api/client'
import type { ParticlesElement } from '../schema/deck'
import { usePalette, useTextStyles } from './context'
import { resolveRgba } from './gl/color'
import { createParticles, sampleShape } from './gl/particles'
import type { RenderMode } from './SlideView'

/** Touch-Gerät ohne Maus (iPad, Handy): Pixeldichte 1 und ~30 Bilder/s. */
const LIGHT = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Standardwerte je Art – auf 1920×1080 abgestimmt. */
const DEFAULTS: Record<ParticlesElement['preset'], { count: number; size: number; colors: string[] }> = {
  dust: { count: 600, size: 3, colors: ['brand.text'] },
  snow: { count: 450, size: 6, colors: ['brand.text'] },
  sparks: { count: 320, size: 6, colors: ['brand.accent'] },
  bokeh: { count: 36, size: 110, colors: ['brand.accent', 'brand.textMuted'] },
  confetti: { count: 220, size: 18, colors: ['brand.accent', 'brand.text', 'brand.textMuted', 'brand.accent2'] },
  stars: { count: 420, size: 3.5, colors: ['brand.text'] },
  shape: { count: 3600, size: 3.5, colors: ['brand.text'] },
}

export function particleDefaults(el: ParticlesElement) {
  const d = DEFAULTS[el.preset]
  return { count: el.count ?? d.count, size: el.size ?? d.size, colors: el.colors ?? d.colors }
}

/**
 * Partikel-Element. Zeit läuft im Editor und in der Präsentation, sonst Standbild.
 * Form (`--form` 0–1) setzen Builds/Bewegungen als CSS-Variable – hier wird sie pro Bild gelesen.
 */
export function ParticlesView({ el, mode, deckName }: { el: ParticlesElement; mode: RenderMode; deckName: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const palette = usePalette()
  const styles = useTextStyles()
  const { count, size, colors } = particleDefaults(el)
  const live = mode === 'view' || mode === 'present'
  const key = JSON.stringify([el.preset, count, colors, el.shape, el.frame.w, el.frame.h, palette])

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const r = createParticles(cv, el.preset, count)
    if (!r) return
    const rgb = colors.map((c) => resolveRgba(c, palette, [1, 1, 1, 1], cv).slice(0, 3) as [number, number, number])
    let cancelled = false

    // Form: Text oder Bild abtasten.
    if (el.preset === 'shape' && el.shape) {
      const aspect = el.frame.w / el.frame.h
      const shape = el.shape
      const draw = async () => {
        if (shape.src) {
          const img = new Image()
          img.src = assetUrl(deckName, shape.src)
          await img.decode().catch(() => {})
          return sampleShape(
            (ctx, w, h) => {
              const s = Math.min(w / img.naturalWidth, h / img.naturalHeight) || 1
              ctx.drawImage(img, (w - img.naturalWidth * s) / 2, (h - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
            },
            aspect,
            count,
          )
        }
        await document.fonts.ready
        const ts = styles[shape.style ?? 'display']
        const family = getComputedStyle(cv).getPropertyValue(`--font-${ts.font}`) || 'sans-serif'
        return sampleShape(
          (ctx, w, h) => {
            const lines = (shape.text ?? '').split('\n')
            let px = h / (lines.length * 1.05)
            ctx.font = `${ts.weight} ${px}px ${family}`
            const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1)
            if (widest > w * 0.98) px *= (w * 0.98) / widest
            ctx.font = `${ts.weight} ${px}px ${family}`
            ctx.fillStyle = '#000'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * px * 1.05))
          },
          aspect,
          count,
        )
      }
      void draw().then((targets) => {
        if (!cancelled) r.setTargets(targets)
      })
    }

    let frame = 0
    let last = 0
    const start = performance.now()
    const render = () => {
      if (live && LIGHT && performance.now() - last < 32) {
        frame = requestAnimationFrame(render)
        return
      }
      last = performance.now()
      const rect = cv.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, LIGHT ? 1 : 2)
      const w = Math.max(2, Math.min(2560, Math.round(rect.width * dpr)))
      const h = Math.max(2, Math.min(1600, Math.round(rect.height * dpr)))
      const formVar = parseFloat(getComputedStyle(cv).getPropertyValue('--form'))
      r.render(
        {
          time: live ? 6 + (performance.now() - start) / 1000 : 6,
          speed: el.speed ?? 1,
          size,
          form: Number.isFinite(formVar) ? formVar : (el.form ?? 1),
          opacity: el.opacity ?? 1,
          colors: rgb,
          // Partikelgröße in Bildpunkten: logische Pixel × Bühnenmaßstab × Pixeldichte.
          dpr: w / el.frame.w,
        },
        w,
        h,
      )
      if (live) frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    // Standbild: ein zweites Bild, sobald die Form abgetastet ist.
    const late = live ? 0 : window.setTimeout(() => requestAnimationFrame(render), 400)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      clearTimeout(late)
      r.destroy()
    }
    // key fasst alle Abhängigkeiten zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, live, el.speed, size, el.opacity, el.form, deckName])

  if (mode === 'thumb') return <div className="el-particles el-particles--thumb" />
  return <canvas ref={canvas} className="el-particles" />
}
