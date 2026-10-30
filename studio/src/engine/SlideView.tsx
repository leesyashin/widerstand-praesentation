import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { assetUrl } from '../api/client'
import type { Background, Effect, Element, Slide, VideoElement } from '../schema/deck'
import { resolveColor, type TextStyles } from './brand'
import { ChartBody } from './chart'
import { useEffectScale, useTextStyles } from './context'
import { CUSTOM_COMPONENTS } from './custom'
import { Grain, LightSweep, MeshBackground } from './effects'
import { findIcon, LucideIcon } from './icons'
import { BUILD_IN_EVENT } from './buildEvents'
import { LottieView } from './lottie'
import { renderInline } from './text'
import './engine.css'

/**
 * Darstellung einer Folie im Endzustand (alle Builds sichtbar).
 * Animationen setzen später auf diesem DOM auf (siehe timeline.ts, transitions.ts):
 *   .el      Position/Drehung aus `frame` – Ziel von Magic Move
 *   .el-anim volle Größe darin – Ziel der Builds
 */
export type RenderMode = 'view' | 'thumb' | 'present' | 'render'

type Ctx = { deckName: string; mode: RenderMode; width: number; height: number }

export function SlideView({
  slide,
  deckName,
  mode,
  width,
  height,
}: {
  slide: Slide
  deckName: string
  mode: RenderMode
  width: number
  height: number
}) {
  const ctx: Ctx = { deckName, mode, width, height }
  const fx = useEffectScale()
  const look = slide.effects?.find((e) => e.type === 'colorLook')
  const float = slide.effects?.find((e) => e.type === 'float')
  const classes = ['slide', `slide--${mode}`, isLive(mode) && 'slide--live', float && 'slide--float'].filter(Boolean)
  return (
    <div
      className={classes.join(' ')}
      data-slide-id={slide.id}
      style={float ? ({ '--float': float.amount * fx } as CSSProperties) : undefined}
    >
      <div className="slide__content" style={{ filter: look ? colorLookFilter(look.look, look.amount ?? 1) : undefined }}>
        <BackgroundView background={slide.background} ctx={ctx} />
        {slide.elements.map((el) => (el.hidden ? null : <ElementView key={el.id} element={el} ctx={ctx} />))}
      </div>
      {slide.effects && (
        <div className="slide__fx">
          {slide.effects.map((effect, i) => (
            <EffectView key={i} effect={effect} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  )
}

const isLive = (mode: RenderMode) => mode === 'view' || mode === 'present'

/* ---------- Hintergründe ---------- */

function BackgroundView({ background, ctx }: { background: Background | undefined; ctx: Ctx }) {
  const bg = background ?? { type: 'color', color: 'brand.background' }
  switch (bg.type) {
    case 'color':
      return <div className="slide__bg" style={{ background: resolveColor(bg.color) }} />
    case 'gradient':
      return (
        <div
          className="slide__bg"
          style={{
            background: `linear-gradient(${bg.angle ?? 180}deg, ${resolveColor(bg.from)}, ${resolveColor(bg.to)})`,
          }}
        />
      )
    case 'meshGradient':
      return (
        <MeshBackground
          colors={bg.colors ?? ['brand.background', 'brand.accent', 'brand.surface']}
          animate={Boolean(bg.animate)}
          mode={ctx.mode}
        />
      )
    case 'image':
      return (
        <img
          className="slide__bg"
          src={assetUrl(ctx.deckName, bg.src)}
          alt=""
          draggable={false}
          style={{ objectFit: bg.fit ?? 'cover' }}
        />
      )
    case 'video':
      return (
        <video
          className="slide__bg"
          src={assetUrl(ctx.deckName, bg.src)}
          poster={bg.poster && assetUrl(ctx.deckName, bg.poster)}
          muted
          loop
          playsInline
          autoPlay={isLive(ctx.mode)}
          preload={ctx.mode === 'thumb' ? 'metadata' : 'auto'}
          style={{ objectFit: 'cover' }}
        />
      )
  }
}

/* ---------- Elemente ---------- */

function ElementView({ element, ctx }: { element: Element; ctx: Ctx }) {
  const { frame } = element
  const style: CSSProperties & Record<`--${string}`, number> = {
    left: frame.x,
    top: frame.y,
    width: frame.w,
    height: frame.h,
    transform: frame.rotation ? `rotate(${frame.rotation}deg)` : undefined,
    opacity: element.opacity,
  }
  if (element.depth) {
    style['--depth'] = element.depth
    style['--depth-abs'] = Math.abs(element.depth)
  }
  const tilt = element.tilt
  const body = <ElementBody element={element} ctx={ctx} />
  return (
    <div
      className={`el el--${element.type} ${element.depth ? 'el--depth' : ''}`}
      style={style}
      data-element-id={element.id}
      data-depth={element.depth}
    >
      <div className="el-anim">
        {tilt && (tilt.x || tilt.y) ? (
          <div className="el-3d" style={{ transform: `perspective(1800px) rotateX(${tilt.x ?? 0}deg) rotateY(${tilt.y ?? 0}deg)` }}>
            {body}
          </div>
        ) : (
          body
        )}
      </div>
    </div>
  )
}

function ElementBody({ element: el, ctx }: { element: Element; ctx: Ctx }): ReactNode {
  const styles = useTextStyles()
  switch (el.type) {
    case 'text': {
      const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.verticalAlign ?? 'top']
      const preset = el.build?.in?.preset
      const split = preset === 'wordByWord' ? 'word' : preset === 'lineByLine' ? 'line' : 'none'
      return (
        <div className="el-text" style={{ justifyContent: justify, ...textCss(el, styles) }}>
          <div>{renderInline(el.content, split, preset === 'countUp')}</div>
        </div>
      )
    }
    case 'image':
      return (
        <img
          className="el-media"
          src={assetUrl(ctx.deckName, el.src)}
          alt={el.alt ?? ''}
          draggable={false}
          style={{
            objectFit: el.fit ?? 'cover',
            objectPosition: el.focus ? `${el.focus.x * 100}% ${el.focus.y * 100}%` : undefined,
            borderRadius: el.radius,
          }}
        />
      )
    case 'video':
      return <VideoBody el={el} ctx={ctx} />
    case 'chart':
      return <ChartBody el={el} />
    case 'lottie':
      return <LottieView el={el} url={assetUrl(ctx.deckName, el.src)} mode={ctx.mode} />
    case 'shape':
      return <ShapeBody el={el} />
    case 'icon': {
      const color = resolveColor(el.color ?? 'brand.text') ?? 'currentColor'
      if (el.icon.startsWith('assets/') || el.icon.startsWith('brand/')) {
        const url = `url("${assetUrl(ctx.deckName, el.icon)}")`
        return <div className="el-icon" style={{ backgroundColor: color, maskImage: url, WebkitMaskImage: url }} />
      }
      const node = findIcon(el.icon)
      if (!node) return <Placeholder label={`Icon „${el.icon}“`} note="Unbekannt – Namen siehe lucide.dev/icons" />
      return <LucideIcon node={node} color={color} strokeWidth={el.strokeWidth ?? 1.5} />
    }
    case 'custom': {
      const mod = CUSTOM_COMPONENTS[el.component]
      if (!mod) return <Placeholder label={`Komponente ${el.component}`} note={`custom/${el.component}.tsx fehlt`} />
      const parsed = mod.schema ? mod.schema.safeParse(el.props ?? {}) : { success: true as const, data: el.props ?? {} }
      if (!parsed.success) {
        return <Placeholder label={`Komponente ${el.component}`} note={parsed.error.issues[0]?.message ?? 'Ungültige props'} />
      }
      const Component = mod.default
      return (
        <Component
          props={parsed.data as Record<string, unknown>}
          mode={ctx.mode}
          width={el.frame.w}
          height={el.frame.h}
          assetUrl={(src) => assetUrl(ctx.deckName, src)}
        />
      )
    }
  }
}

/** Typografie eines Text-Elements als CSS – auch für das Bearbeitungsfeld im Editor. */
export function textCss(el: Extract<Element, { type: 'text' }>, styles: TextStyles): CSSProperties {
  const s = styles[el.style ?? 'body']
  return {
    textAlign: el.align ?? 'left',
    fontFamily: `var(--font-${el.font ?? s.font})`,
    fontSize: el.fontSize ?? s.size,
    fontWeight: el.fontWeight ?? s.weight,
    lineHeight: el.lineHeight ?? s.lineHeight,
    letterSpacing: `${el.letterSpacing ?? s.letterSpacing}em`,
    color: resolveColor(el.color ?? s.color),
    textTransform: s.uppercase ? 'uppercase' : undefined,
  }
}

/** Video: spielt automatisch – mit Einblend-Build in der Präsentation erst, wenn der Build startet. */
function VideoBody({ el, ctx }: { el: VideoElement; ctx: Ctx }) {
  const ref = useRef<HTMLVideoElement>(null)
  const p = el.playback ?? {}
  const waitForBuild = Boolean(el.build?.in) && ctx.mode === 'present'
  const autoplay = isLive(ctx.mode) && (p.autoplay ?? false)
  useEffect(() => {
    const video = ref.current
    const trigger = video?.closest('.el-anim')
    if (!video || !trigger || !autoplay || !waitForBuild) return
    const play = () => {
      video.currentTime = 0
      void video.play().catch(() => {})
    }
    trigger.addEventListener(BUILD_IN_EVENT, play)
    return () => trigger.removeEventListener(BUILD_IN_EVENT, play)
  }, [autoplay, waitForBuild])
  return (
    <video
      ref={ref}
      className="el-media"
      src={assetUrl(ctx.deckName, el.src)}
      poster={el.poster && assetUrl(ctx.deckName, el.poster)}
      muted={p.muted ?? true}
      loop={p.loop ?? false}
      autoPlay={autoplay && !waitForBuild}
      playsInline
      preload={ctx.mode === 'thumb' ? 'metadata' : 'auto'}
      style={{ objectFit: el.fit ?? 'cover', borderRadius: el.radius }}
    />
  )
}

function ShapeBody({ el }: { el: Extract<Element, { type: 'shape' }> }) {
  const stroke = el.stroke && { color: resolveColor(el.stroke.color), width: el.stroke.width }
  if (el.shape === 'rect' || el.shape === 'ellipse') {
    const glass = el.glass ?? 0
    const fill = resolveColor(el.fill)
    return (
      <div
        className={`el-shape ${glass > 0 ? 'el-shape--glass' : ''}`}
        style={
          {
            background: glass > 0 ? `color-mix(in srgb, ${fill ?? 'white'} ${Math.round(12 + glass * 18)}%, transparent)` : fill,
            border: stroke ? `${stroke.width}px solid ${stroke.color}` : undefined,
            borderRadius: el.shape === 'ellipse' ? '50%' : el.radius,
            '--glass-blur': `${Math.round(8 + glass * 40)}px`,
          } as CSSProperties
        }
      />
    )
  }
  // Linie/Pfeil: horizontal durch die Mitte des Rahmens, Richtung über frame.rotation.
  const { w, h } = el.frame
  const sw = stroke?.width ?? 2
  const color = stroke?.color ?? resolveColor(el.fill) ?? 'currentColor'
  const head = el.shape === 'arrow' ? Math.max(sw * 4, 12) : 0
  return (
    <svg className="el-shape" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" overflow="visible">
      <line x1={0} y1={h / 2} x2={w - head * 0.6} y2={h / 2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {head > 0 && <path d={`M${w - head} ${h / 2 - head / 2} L${w} ${h / 2} L${w - head} ${h / 2 + head / 2} Z`} fill={color} />}
    </svg>
  )
}

function Placeholder({ label, note }: { label: string; note: string }) {
  return (
    <div className="el-placeholder">
      <strong>{label}</strong>
      <span>{note}</span>
    </div>
  )
}

/* ---------- Effekte (CSS-Vorschau; WebGL-Versionen folgen in Phase 3) ---------- */

function EffectView({ effect, ctx }: { effect: Effect; ctx: Ctx }) {
  const fx = useEffectScale()
  switch (effect.type) {
    case 'grain':
      return <Grain amount={effect.amount} mode={ctx.mode} />
    case 'lightSweep':
      return <LightSweep amount={effect.amount} mode={ctx.mode} />
    case 'float':
      return null // wirkt über die Klasse slide--float auf Elemente mit Tiefe
    case 'vignette':
      return (
        <div
          className="fx-layer"
          style={{
            background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${Math.min(0.95, effect.amount * 0.85 * fx)}) 100%)`,
          }}
        />
      )
    case 'letterbox': {
      const bar = Math.round(ctx.height * 0.12 * effect.amount)
      return (
        <>
          <div className="fx-bar" style={{ top: 0, height: bar }} />
          <div className="fx-bar" style={{ bottom: 0, height: bar }} />
        </>
      )
    }
    case 'colorLook':
      return null // wird als Filter auf den Inhalt angewendet
  }
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

function colorLookFilter(look: Extract<Effect, { type: 'colorLook' }>['look'], amount: number): string {
  const t = amount
  switch (look) {
    case 'warm':
      return `sepia(${lerp(0, 0.28, t)}) saturate(${lerp(1, 1.12, t)}) hue-rotate(${lerp(0, -8, t)}deg)`
    case 'cool':
      return `saturate(${lerp(1, 0.88, t)}) hue-rotate(${lerp(0, 12, t)}deg) brightness(${lerp(1, 1.03, t)})`
    case 'tealOrange':
      return `contrast(${lerp(1, 1.08, t)}) saturate(${lerp(1, 1.25, t)}) hue-rotate(${lerp(0, -6, t)}deg)`
    case 'muted':
      return `saturate(${lerp(1, 0.6, t)}) contrast(${lerp(1, 0.95, t)})`
    case 'mono':
      return `grayscale(${t}) contrast(${lerp(1, 1.1, t)})`
  }
}
