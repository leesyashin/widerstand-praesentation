import { useRef } from 'react'
import { resolveColor } from './brand'
import { useEffectScale } from './context'
import { resolveRgba, type RGBA } from './gl/color'
import { ShaderCanvas } from './gl/ShaderCanvas'
import { GRAIN, MESH, SWEEP } from './gl/shaders'
import type { RenderMode } from './SlideView'

/** WebGL nur auf großen Folien – Vorschaubilder bleiben bei der leichten CSS-Variante. */
const useGl = (mode: RenderMode) => mode !== 'thumb'
const isLive = (mode: RenderMode) => mode === 'view' || mode === 'present'

/** Liest Farben (auch Brand-Tokens) erst beim Zeichnen und hält sie kurz vor. */
function useColorResolver(colors: string[]): () => RGBA[] {
  const cache = useRef<{ key: string; at: number; values: RGBA[] }>({ key: '', at: 0, values: [] })
  const key = colors.join('|')
  return () => {
    const now = performance.now()
    if (cache.current.key !== key || now - cache.current.at > 1000) {
      cache.current = { key, at: now, values: colors.map((c) => resolveRgba(c)) }
    }
    return cache.current.values
  }
}

const MESH_POSITIONS = ['18% 22%', '82% 18%', '70% 85%', '22% 80%', '50% 50%']

/** CSS-Variante des Licht-Verlaufs (Vorschaubilder, Fallback ohne WebGL). */
export function CssMesh({ colors, animate }: { colors: string[]; animate: boolean }) {
  const [base = 'brand.background', ...spots] = colors
  const layers = spots.map(
    (c, i) => `radial-gradient(circle at ${MESH_POSITIONS[i % MESH_POSITIONS.length]}, ${resolveColor(c)} 0%, transparent 55%)`,
  )
  return (
    <div className="slide__bg" style={{ background: resolveColor(base), overflow: 'hidden' }}>
      <div className={`mesh ${animate ? 'mesh--animate' : ''}`} style={{ backgroundImage: layers.join(', ') }} />
    </div>
  )
}

/** Licht-Verlauf: fließende Lichtquellen in Brand-Farben (Signature-Effekt). */
export function MeshBackground({ colors, animate, mode }: { colors: string[]; animate: boolean; mode: RenderMode }) {
  const fx = useEffectScale()
  const resolve = useColorResolver(colors)
  const fallback = <CssMesh colors={colors} animate={animate && isLive(mode)} />
  if (!useGl(mode)) return fallback
  return (
    <div className="slide__bg">
      <ShaderCanvas
        fragment={MESH}
        animate={animate && isLive(mode)}
        quality={0.5}
        deps={colors.join('|')}
        fallback={fallback}
        uniforms={() => {
          const [base = [0, 0, 0, 1], ...spots] = resolve()
          const flat = Array.from({ length: 5 }, (_, i) => spots[i] ?? base).flatMap(([r, g, b]) => [r, g, b])
          return { u_base: base.slice(0, 3), u_colors: flat, u_count: Math.min(5, spots.length), u_speed: fx }
        }}
      />
    </div>
  )
}

/** Filmkorn: im Editor und in der Präsentation lebendig, sonst ein Standbild. */
export function Grain({ amount, mode }: { amount: number; mode: RenderMode }) {
  const fx = useEffectScale()
  const strength = Math.min(1, amount * fx)
  const css = <div className={`fx-grain ${isLive(mode) ? 'fx-grain--animate' : ''}`} style={{ opacity: strength * 0.6 }} />
  if (!useGl(mode)) return css
  return (
    <ShaderCanvas
      className="fx-gl"
      style={{ mixBlendMode: 'overlay' }}
      fragment={GRAIN}
      animate={isLive(mode)}
      fallback={css}
      deps={String(strength)}
      uniforms={() => ({ u_amount: Math.min(0.9, strength * 0.75) })}
    />
  )
}

/** Licht-Sweep: weicher Lichtstreifen in der Akzentfarbe. */
export function LightSweep({ amount, mode }: { amount: number; mode: RenderMode }) {
  const fx = useEffectScale()
  const resolve = useColorResolver(['brand.accent'])
  if (!useGl(mode)) return null
  const strength = Math.min(1, amount * fx)
  return (
    <ShaderCanvas
      className="fx-gl"
      style={{ mixBlendMode: 'screen' }}
      fragment={SWEEP}
      animate={isLive(mode)}
      quality={0.5}
      deps={String(strength)}
      uniforms={() => ({ u_amount: strength * 0.8, u_tint: (resolve()[0] ?? [1, 1, 1, 1]).slice(0, 3) })}
    />
  )
}
