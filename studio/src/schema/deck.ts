import { z } from 'zod'

/**
 * Deck-Format v1 – die eine Wahrheit für Editor, Präsentation und Claude.
 * Alle Objekte sind strikt: unbekannte Felder (z. B. Tippfehler) sind ein Fehler.
 * Maße sind logische Pixel im Koordinatensystem von `format` (z. B. 1920×1080).
 * Zeiten sind Millisekunden.
 */

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Nur Kleinbuchstaben, Ziffern und Bindestriche, z. B. "intro" oder "bild-2"')

/** Farbwert: Hex (#rgb, #rrggbb, #rrggbbaa), rgb()/rgba() oder Brand-Token wie "brand.accent". */
export const Color = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|brand\.[a-zA-Z][a-zA-Z0-9]*|transparent)$/,
    'Hex (#ff8800), rgb()/rgba(), "transparent" oder Brand-Token wie "brand.accent"',
  )

/** Datei im Deck-Ordner ("assets/reel.mp4") oder aus dem Brand-Kit ("brand/logo.svg"). */
const assetPath = z
  .string()
  .regex(/^(assets|brand)\/[^\s]+$/, 'Muss mit "assets/" oder "brand/" beginnen, z. B. "assets/foto.jpg"')

const duration = z.number().int().min(0).max(20000)
const unit = z.number().min(0).max(1)

export const Frame = z.strictObject({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().min(-360).max(360).optional(),
})

export const Easing = z.enum(['smooth', 'spring', 'linear', 'in', 'out', 'inOut'])
export const Direction = z.enum(['up', 'down', 'left', 'right'])

export const BuildPreset = z.enum([
  'fade',
  'rise',
  'blurRise',
  'scaleIn',
  'maskReveal',
  'wordByWord',
  'lineByLine',
  'drawLine',
  'countUp',
  'kenBurns',
])

export const Animation = z.strictObject({
  preset: BuildPreset,
  duration: duration.optional(),
  delay: duration.optional(),
  easing: Easing.optional(),
  direction: Direction.optional(),
})

export const Build = z.strictObject({
  in: Animation.optional(),
  out: Animation.optional(),
  /** click: wartet auf Klick · withPrevious: gleichzeitig mit dem vorigen Build · afterPrevious: direkt danach */
  trigger: z.enum(['click', 'withPrevious', 'afterPrevious']).optional(),
  /** Reihenfolge der Builds auf der Folie. Ohne Angabe gilt die Reihenfolge der Elemente. */
  order: z.number().optional(),
})

const elementBase = {
  id,
  /** Gleicher `match` auf zwei aufeinanderfolgenden Folien → Magic Move. */
  match: id.optional(),
  /** Anzeigename in der Ebenen-Liste. */
  name: z.string().optional(),
  frame: Frame,
  opacity: unit.optional(),
  /** Tiefe für Parallax/3D: negativ = hinten, positiv = vorne. */
  depth: z.number().min(-10).max(10).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  build: Build.optional(),
}

export const TextStyle = z.enum(['display', 'title', 'heading', 'subtitle', 'body', 'caption', 'label'])

export const TextElement = z.strictObject({
  ...elementBase,
  type: z.literal('text'),
  /** Inhalt. Zeilenumbruch mit \n, **fett** und *kursiv* sind erlaubt. */
  content: z.string(),
  style: TextStyle.optional(),
  color: Color.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  /** Überschreibt Werte des Textstils. */
  fontSize: z.number().positive().optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  font: z.enum(['display', 'text', 'mono']).optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
})

export const ImageElement = z.strictObject({
  ...elementBase,
  type: z.literal('image'),
  src: assetPath,
  alt: z.string().optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  /** Bildausschnitt bei "cover": 0–1, Standard Mitte. */
  focus: z.strictObject({ x: unit, y: unit }).optional(),
  radius: z.number().min(0).optional(),
})

export const VideoElement = z.strictObject({
  ...elementBase,
  type: z.literal('video'),
  src: assetPath,
  poster: assetPath.optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  radius: z.number().min(0).optional(),
  playback: z
    .strictObject({
      autoplay: z.boolean().optional(),
      loop: z.boolean().optional(),
      muted: z.boolean().optional(),
    })
    .optional(),
})

export const Stroke = z.strictObject({ color: Color, width: z.number().positive() })

export const ShapeElement = z.strictObject({
  ...elementBase,
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'line', 'arrow']),
  fill: Color.optional(),
  stroke: Stroke.optional(),
  radius: z.number().min(0).optional(),
})

export const IconElement = z.strictObject({
  ...elementBase,
  type: z.literal('icon'),
  /** Name aus der Icon-Bibliothek (ab Phase 1) oder eigene SVG-Datei "assets/…svg" bzw. "brand/…svg". */
  icon: z.string().min(1),
  color: Color.optional(),
  strokeWidth: z.number().positive().optional(),
})

export const CustomElement = z.strictObject({
  ...elementBase,
  type: z.literal('custom'),
  /** Name einer Komponente in studio/custom/, z. B. "FilmStrip". */
  component: z.string().regex(/^[A-Z][A-Za-z0-9]*$/, 'PascalCase, z. B. "FilmStrip"'),
  props: z.record(z.string(), z.unknown()).optional(),
})

export const Element = z.discriminatedUnion('type', [
  TextElement,
  ImageElement,
  VideoElement,
  ShapeElement,
  IconElement,
  CustomElement,
])

export const Background = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('color'), color: Color }),
  z.strictObject({
    type: z.literal('gradient'),
    from: Color,
    to: Color,
    angle: z.number().optional(),
  }),
  z.strictObject({
    type: z.literal('meshGradient'),
    preset: z.string().optional(),
    colors: z.array(Color).min(2).max(6).optional(),
    animate: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('image'),
    src: assetPath,
    fit: z.enum(['cover', 'contain']).optional(),
  }),
  z.strictObject({ type: z.literal('video'), src: assetPath, poster: assetPath.optional() }),
])

export const Effect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('grain'), amount: unit }),
  z.strictObject({ type: z.literal('vignette'), amount: unit }),
  z.strictObject({ type: z.literal('letterbox'), amount: unit }),
  z.strictObject({
    type: z.literal('colorLook'),
    look: z.enum(['warm', 'cool', 'tealOrange', 'muted', 'mono']),
    amount: unit.optional(),
  }),
])

export const TransitionType = z.enum([
  'none',
  'dissolve',
  'blurDissolve',
  'push',
  'zoom',
  'magicMove',
  'camera',
  'maskReveal',
  'lightLeak',
  'whipPan',
])

export const Transition = z.strictObject({
  type: TransitionType,
  duration: duration.optional(),
  easing: Easing.optional(),
  direction: Direction.optional(),
})

/** Position der Folie im Raum – Grundlage für Kamerafahrten. */
export const World = z.strictObject({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
  rotate: z.number().optional(),
  scale: z.number().positive().optional(),
})

export const Slide = z
  .strictObject({
    id,
    layout: z.string().optional(),
    master: z.string().optional(),
    background: Background.optional(),
    effects: z.array(Effect).optional(),
    /** Übergang *zu* dieser Folie. */
    transition: Transition.optional(),
    world: World.optional(),
    elements: z.array(Element),
    notes: z.string().optional(),
    /** In der Präsentation überspringen. */
    skip: z.boolean().optional(),
  })
  .superRefine((slide, ctx) => {
    const ids = new Set<string>()
    const matches = new Set<string>()
    slide.elements.forEach((el, i) => {
      if (ids.has(el.id)) {
        ctx.addIssue({ code: 'custom', path: ['elements', i, 'id'], message: `Element-ID "${el.id}" ist doppelt` })
      }
      ids.add(el.id)
      if (el.match) {
        if (matches.has(el.match)) {
          ctx.addIssue({
            code: 'custom',
            path: ['elements', i, 'match'],
            message: `match "${el.match}" ist auf dieser Folie doppelt`,
          })
        }
        matches.add(el.match)
      }
    })
  })

export const FORMAT_PRESETS = {
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
} as const

export const Format = z
  .strictObject({
    preset: z.enum(['16:9', '4:3', 'custom']),
    width: z.number().int().min(320).max(7680),
    height: z.number().int().min(320).max(7680),
  })
  .superRefine((f, ctx) => {
    if (f.preset === 'custom') return
    const expected = FORMAT_PRESETS[f.preset]
    if (f.width !== expected.width || f.height !== expected.height) {
      ctx.addIssue({
        code: 'custom',
        message: `Format ${f.preset} erwartet ${expected.width}×${expected.height}`,
      })
    }
  })

export const Deck = z
  .strictObject({
    $schema: z.string().optional(),
    version: z.literal(1),
    title: z.string().min(1),
    format: Format,
    theme: z.string().optional(),
    /** Globale Effekt-Intensität: 0 = ruhig, 1 = filmisch. */
    intensity: unit.optional(),
    slides: z.array(Slide).min(1),
  })
  .superRefine((deck, ctx) => {
    const ids = new Set<string>()
    deck.slides.forEach((s, i) => {
      if (ids.has(s.id)) {
        ctx.addIssue({ code: 'custom', path: ['slides', i, 'id'], message: `Folien-ID "${s.id}" ist doppelt` })
      }
      ids.add(s.id)
    })
  })

export type Deck = z.infer<typeof Deck>
export type Slide = z.infer<typeof Slide>
export type Element = z.infer<typeof Element>
export type TextElement = z.infer<typeof TextElement>
export type ImageElement = z.infer<typeof ImageElement>
export type VideoElement = z.infer<typeof VideoElement>
export type ShapeElement = z.infer<typeof ShapeElement>
export type IconElement = z.infer<typeof IconElement>
export type CustomElement = z.infer<typeof CustomElement>
export type Background = z.infer<typeof Background>
export type Effect = z.infer<typeof Effect>
export type Transition = z.infer<typeof Transition>
export type Frame = z.infer<typeof Frame>
export type Animation = z.infer<typeof Animation>
export type Build = z.infer<typeof Build>
export type TextStyle = z.infer<typeof TextStyle>
