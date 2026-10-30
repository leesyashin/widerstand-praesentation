import type { CSSProperties, ReactNode } from 'react'
import { assetUrl } from '../api/client'
import type { Background, Effect, Element, Slide } from '../schema/deck'
import { resolveColor, TEXT_STYLES } from './brand'
import { renderInline } from './text'
import './engine.css'

/**
 * Statische Darstellung einer Folie im Endzustand (alle Builds sichtbar).
 * Builds, Übergänge und Magic Move kommen in Phase 1 über die Timeline-Engine dazu.
 */
export type RenderMode = 'view' | 'thumb'

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
  const look = slide.effects?.find((e) => e.type === 'colorLook')
  return (
    <div className={`slide slide--${mode}`} data-slide-id={slide.id}>
      <div className="slide__content" style={{ filter: look ? colorLookFilter(look.look, look.amount ?? 1) : undefined }}>
        <BackgroundView background={slide.background} ctx={ctx} />
        {slide.elements.map((el) => (el.hidden ? null : <ElementView key={el.id} element={el} ctx={ctx} />))}
      </div>
      {slide.effects?.map((effect, i) => <EffectView key={i} effect={effect} ctx={ctx} />)}
    </div>
  )
}

/* ---------- Hintergründe ---------- */

const MESH_POSITIONS = ['18% 22%', '82% 18%', '70% 85%', '22% 80%', '50% 50%']

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
    case 'meshGradient': {
      const [base = 'brand.background', ...spots] = bg.colors ?? ['brand.background', 'brand.accent', 'brand.surface']
      const layers = spots.map(
        (c, i) =>
          `radial-gradient(circle at ${MESH_POSITIONS[i % MESH_POSITIONS.length]}, ${resolveColor(c)} 0%, transparent 55%)`,
      )
      return (
        <div className="slide__bg" style={{ background: resolveColor(base), overflow: 'hidden' }}>
          <div
            className={`mesh ${bg.animate && ctx.mode === 'view' ? 'mesh--animate' : ''}`}
            style={{ backgroundImage: layers.join(', ') }}
          />
        </div>
      )
    }
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
          autoPlay={ctx.mode === 'view'}
          preload={ctx.mode === 'view' ? 'auto' : 'metadata'}
          style={{ objectFit: 'cover' }}
        />
      )
  }
}

/* ---------- Elemente ---------- */

function ElementView({ element, ctx }: { element: Element; ctx: Ctx }) {
  const { frame } = element
  const style: CSSProperties = {
    left: frame.x,
    top: frame.y,
    width: frame.w,
    height: frame.h,
    transform: frame.rotation ? `rotate(${frame.rotation}deg)` : undefined,
    opacity: element.opacity,
  }
  return (
    <div className={`el el--${element.type}`} style={style} data-element-id={element.id}>
      <ElementBody element={element} ctx={ctx} />
    </div>
  )
}

function ElementBody({ element: el, ctx }: { element: Element; ctx: Ctx }): ReactNode {
  switch (el.type) {
    case 'text': {
      const s = TEXT_STYLES[el.style ?? 'body']
      const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.verticalAlign ?? 'top']
      return (
        <div
          className="el-text"
          style={{
            justifyContent: justify,
            textAlign: el.align ?? 'left',
            fontFamily: `var(--font-${el.font ?? s.font})`,
            fontSize: el.fontSize ?? s.size,
            fontWeight: el.fontWeight ?? s.weight,
            lineHeight: el.lineHeight ?? s.lineHeight,
            letterSpacing: `${el.letterSpacing ?? s.letterSpacing}em`,
            color: resolveColor(el.color ?? s.color),
            textTransform: s.uppercase ? 'uppercase' : undefined,
          }}
        >
          <div>{renderInline(el.content)}</div>
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
    case 'video': {
      const p = el.playback ?? {}
      return (
        <video
          className="el-media"
          src={assetUrl(ctx.deckName, el.src)}
          poster={el.poster && assetUrl(ctx.deckName, el.poster)}
          muted={p.muted ?? true}
          loop={p.loop ?? false}
          autoPlay={ctx.mode === 'view' && (p.autoplay ?? false)}
          playsInline
          preload={ctx.mode === 'view' ? 'auto' : 'metadata'}
          style={{ objectFit: el.fit ?? 'cover', borderRadius: el.radius }}
        />
      )
    }
    case 'shape':
      return <ShapeBody el={el} />
    case 'icon':
      if (el.icon.startsWith('assets/') || el.icon.startsWith('brand/')) {
        const url = `url("${assetUrl(ctx.deckName, el.icon)}")`
        return (
          <div
            className="el-icon"
            style={{ backgroundColor: resolveColor(el.color ?? 'brand.text'), maskImage: url, WebkitMaskImage: url }}
          />
        )
      }
      return <Placeholder label={`Icon „${el.icon}“`} note="Icon-Bibliothek ab Phase 1" />
    case 'custom':
      return <Placeholder label={`Komponente ${el.component}`} note="Eigene Komponenten ab Phase 1" />
  }
}

function ShapeBody({ el }: { el: Extract<Element, { type: 'shape' }> }) {
  const stroke = el.stroke && { color: resolveColor(el.stroke.color), width: el.stroke.width }
  if (el.shape === 'rect' || el.shape === 'ellipse') {
    return (
      <div
        className="el-shape"
        style={{
          background: resolveColor(el.fill),
          border: stroke ? `${stroke.width}px solid ${stroke.color}` : undefined,
          borderRadius: el.shape === 'ellipse' ? '50%' : el.radius,
        }}
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
  switch (effect.type) {
    case 'grain':
      return (
        <div
          className={`fx-grain ${ctx.mode === 'view' ? 'fx-grain--animate' : ''}`}
          style={{ opacity: effect.amount * 0.6 }}
        />
      )
    case 'vignette':
      return (
        <div
          className="fx-layer"
          style={{
            background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${effect.amount * 0.85}) 100%)`,
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
