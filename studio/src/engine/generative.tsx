import { resolveColor } from './brand'
import { usePalette } from './context'
import { resolveRgba } from './gl/color'
import { GENERATIVE } from './gl/generative'
import { ShaderCanvas } from './gl/ShaderCanvas'
import type { RenderMode } from './SlideView'

export type GenerativeProps = {
  pattern: keyof typeof GENERATIVE
  colors?: string[]
  speed?: number
  scale?: number
  intensity?: number
  animate?: boolean
}

const DEFAULT_COLORS = ['brand.background', 'brand.accent', 'brand.textMuted']

/** Generatives Muster als Fläche (Hintergrund oder Element). Vorschaubilder zeigen einen ruhigen CSS-Verlauf. */
export function GenerativeView({ props, mode, className, radius }: { props: GenerativeProps; mode: RenderMode; className?: string; radius?: number }) {
  const palette = usePalette()
  const colors = props.colors?.length ? props.colors : DEFAULT_COLORS
  const [base = 'brand.background', ...lights] = colors
  const live = mode === 'view' || mode === 'present'
  const fallback = (
    <div
      className={className}
      style={{
        background: `radial-gradient(120% 90% at 30% 30%, ${resolveColor(lights[0] ?? base)} 0%, transparent 60%), ${resolveColor(base)}`,
        borderRadius: radius,
      }}
    />
  )
  if (mode === 'thumb') return fallback
  const key = colors.join('|') + JSON.stringify(palette)
  return (
    <div className={className} style={{ borderRadius: radius, overflow: radius ? 'hidden' : undefined }}>
      <ShaderCanvas
        fragment={GENERATIVE[props.pattern]}
        animate={live && props.animate !== false}
        quality={props.pattern === 'noise' || props.pattern === 'plasma' ? 0.5 : 0.75}
        fallback={fallback}
        deps={key + JSON.stringify([props.speed, props.scale, props.intensity])}
        uniforms={() => {
          const b = resolveRgba(base, palette)
          const ls = (lights.length ? lights : [base]).map((c) => resolveRgba(c, palette))
          const flat = Array.from({ length: 4 }, (_, i) => ls[i] ?? ls[0]!).flatMap(([r, g, bl]) => [r, g, bl])
          return {
            u_base: b.slice(0, 3),
            u_colors: flat,
            u_count: Math.min(4, ls.length),
            u_speed: 0.15 + (props.speed ?? 0.3) * 3,
            u_scale: props.scale ?? 0.5,
            u_intensity: props.intensity ?? 0.6,
          }
        }}
      />
    </div>
  )
}
