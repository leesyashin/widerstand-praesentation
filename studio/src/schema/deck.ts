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
  /** Charts: Balken wachsen, Linien zeichnen sich, Ringe füllen sich. */
  'grow',
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

/* ---------- Bewegung (Phase 8a): freie Spuren auf der Zeitleiste ---------- */

/**
 * Timing-Kurve: Name (`smooth`, `spring`, `linear`, `in`, `out`, `inOut`, `bounce`, `elastic`, `back`),
 * `cubic-bezier(x1,y1,x2,y2)`, Feder `spring(0.4)` (Nachschwingen 0–0.95), `wiggle(6)` (zittert n-mal und kehrt zurück),
 * `steps(8)` (ruckweise).
 */
export const MotionEase = z
  .string()
  .regex(
    /^(smooth|spring|linear|in|out|inOut|bounce|elastic|back|cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)|spring\(\s*(0(\.\d+)?|\.\d+)\s*\)|wiggle\(\s*\d{1,2}\s*\)|steps\(\s*\d{1,2}\s*\))$/,
    'Kurve: smooth, spring, spring(0.4), bounce, elastic, back, linear, in, out, inOut, cubic-bezier(.2,.8,.2,1), wiggle(6) oder steps(8)',
  )

/**
 * Was sich bewegen kann – Abweichung von der Ruhe-Position (`frame`). x/y/z in logischen Pixeln, Winkel in Grad,
 * blur in Pixeln. `color` färbt Text/Icons/Charts, `fill` die Fläche einer Form.
 */
export const MotionProps = z.strictObject({
  x: z.number().optional(),
  y: z.number().optional(),
  z: z.number().optional(),
  scale: z.number().optional(),
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  rotate: z.number().optional(),
  rotateX: z.number().optional(),
  rotateY: z.number().optional(),
  skewX: z.number().optional(),
  skewY: z.number().optional(),
  opacity: unit.optional(),
  blur: z.number().min(0).max(200).optional(),
  color: Color.optional(),
  fill: Color.optional(),
})

export const MotionKey = MotionProps.extend({
  /** Position im Ablauf 0–1. Ohne Angabe: gleichmäßig verteilt. */
  t: unit.optional(),
  /** Kurve zum nächsten Schlüssel. */
  ease: MotionEase.optional(),
})

export const Motion = z
  .strictObject({
    /** Klick-Schritt: 0 = automatisch beim Betreten, 1 = erster Klick … (auf Szenen-Folien ohne Bedeutung). */
    step: z.number().int().min(0).max(99).optional(),
    /** Start in ms ab Beginn des Schritts (auf Szenen-Folien: ab Beginn der Folie). */
    at: z.number().int().min(0).max(120000).optional(),
    duration: z.number().int().min(1).max(120000).optional(),
    ease: MotionEase.optional(),
    /** Startzustand (sonst der aktuelle). */
    from: MotionProps.optional(),
    /** Endzustand (sonst die Ruhe-Position). */
    to: MotionProps.optional(),
    /** Statt from/to: mehrere Zustände nacheinander. */
    keys: z.array(MotionKey).min(2).optional(),
    /**
     * SVG-Pfad in Folien-Koordinaten (z. B. "M 0 900 C 400 200, 1200 1200, 960 540") – die Mitte des Elements folgt ihm.
     * Mit `orient` dreht sich das Element in Laufrichtung.
     */
    path: z.string().min(3).optional(),
    orient: z.boolean().optional(),
    /** Wiederholungen: 1 = noch einmal, -1 = endlos (läuft dann neben den Klicks weiter). */
    repeat: z.number().int().min(-1).max(999).optional(),
    /** Beim Wiederholen hin und zurück. */
    yoyo: z.boolean().optional(),
    /** Pause zwischen Wiederholungen in ms. */
    repeatDelay: z.number().int().min(0).max(60000).optional(),
  })
  .superRefine((m, ctx) => {
    if (m.keys && (m.from || m.to)) ctx.addIssue({ code: 'custom', path: ['keys'], message: 'Entweder keys oder from/to' })
    if (!m.keys && !m.from && !m.to && !m.path) ctx.addIssue({ code: 'custom', path: [], message: 'Bewegung braucht from, to, keys oder path' })
  })

/** Szenen-Folie: läuft von selbst durch wie ein Film (Builds und Bewegungen nach Zeit), ein Klick geht zur nächsten Folie. */
export const Scene = z.strictObject({
  /** Mindestdauer in ms (sonst so lang wie die längste Bewegung). */
  duration: z.number().int().min(0).max(600000).optional(),
  /** Endlos wiederholen, bis weitergeklickt wird. */
  loop: z.boolean().optional(),
})

const elementBase = {
  id,
  /** Gleicher `match` auf zwei aufeinanderfolgenden Folien → Magic Move. */
  match: id.optional(),
  /** Anzeigename in der Ebenen-Liste. */
  name: z.string().optional(),
  frame: Frame,
  opacity: unit.optional(),
  /** Tiefe für Parallax/3D: negativ = hinten, positiv = vorne. Wirkt bei Kamerafahrten und mit dem Effekt "float". */
  depth: z.number().min(-10).max(10).optional(),
  /** Räumliche Neigung in Grad (x = nach hinten kippen, y = seitlich drehen). */
  tilt: z.strictObject({ x: z.number().min(-60).max(60).optional(), y: z.number().min(-60).max(60).optional() }).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  /** Gruppe: Elemente mit gleichem `group` werden im Editor gemeinsam ausgewählt und bewegt. */
  group: id.optional(),
  build: Build.optional(),
  /** Freie Bewegungen auf der Zeitleiste (zusätzlich zu `build`). */
  motion: z.array(Motion).optional(),
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
  /** Milchglas: 0 = aus, 1 = stark. Die Füllung wird dann als Tönung genutzt. */
  glass: unit.optional(),
})

export const IconElement = z.strictObject({
  ...elementBase,
  type: z.literal('icon'),
  /** Name aus der Icon-Bibliothek (ab Phase 1) oder eigene SVG-Datei "assets/…svg" bzw. "brand/…svg". */
  icon: z.string().min(1),
  color: Color.optional(),
  strokeWidth: z.number().positive().optional(),
})

export const ChartPoint = z.strictObject({
  label: z.string(),
  value: z.number(),
  color: Color.optional(),
})

export const ChartElement = z.strictObject({
  ...elementBase,
  type: z.literal('chart'),
  chart: z.enum(['bar', 'line', 'donut']),
  data: z.array(ChartPoint).min(1).max(24),
  /** Obergrenze der Skala. Ohne Angabe: größter Wert. */
  max: z.number().positive().optional(),
  /** Hauptfarbe (Balken, Linie). Einzelne Punkte können eigene Farben haben. */
  color: Color.optional(),
  showValues: z.boolean().optional(),
  showLabels: z.boolean().optional(),
  /** Anhang an Werte, z. B. "%" oder " €". */
  unit: z.string().max(8).optional(),
})

export const LottieElement = z.strictObject({
  ...elementBase,
  type: z.literal('lottie'),
  /** Lottie-JSON aus After Effects (Bodymovin), z. B. "assets/intro.json". */
  src: assetPath,
  loop: z.boolean().optional(),
  speed: z.number().positive().max(8).optional(),
  /** Bild für Vorschau und Screenshots (Frame-Nummer). Standard: letzter Frame. */
  posterFrame: z.number().int().min(0).optional(),
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
  ChartElement,
  LottieElement,
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
  /** Ein Lichtstreifen, der in Abständen über die Folie gleitet. */
  z.strictObject({ type: z.literal('lightSweep'), amount: unit }),
  /** Ruhiges Schweben: Elemente mit `depth` driften leicht gegeneinander – Tiefe ohne Kamerafahrt. */
  z.strictObject({ type: z.literal('float'), amount: unit }),
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
    /** ID einer Master-Folie aus `masters`: deren Elemente liegen hinter den eigenen, Hintergrund/Effekte gelten als Standard. */
    master: z.string().optional(),
    background: Background.optional(),
    effects: z.array(Effect).optional(),
    /** Übergang *zu* dieser Folie. */
    transition: Transition.optional(),
    world: World.optional(),
    /** Folie als durchlaufende Szene statt Klick für Klick. */
    scene: Scene.optional(),
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

/**
 * Master-Folie: gemeinsamer Hintergrund, Effekte und Elemente (Logo, Seitenleiste …) für viele Folien.
 * Eine Änderung am Master wirkt auf allen Folien, die ihn nutzen.
 */
export const Master = z
  .strictObject({
    id,
    name: z.string().optional(),
    background: Background.optional(),
    effects: z.array(Effect).optional(),
    elements: z.array(Element),
  })
  .superRefine((master, ctx) => {
    const ids = new Set<string>()
    master.elements.forEach((el, i) => {
      if (ids.has(el.id)) ctx.addIssue({ code: 'custom', path: ['elements', i, 'id'], message: `Element-ID "${el.id}" ist doppelt` })
      ids.add(el.id)
    })
  })

/** Textstil auf Deck-Ebene – überschreibt die Werte des Themes für alle Texte mit diesem `style`. */
export const DeckTextStyle = z.strictObject({
  font: z.enum(['display', 'text', 'mono']).optional(),
  size: z.number().positive().optional(),
  weight: z.number().int().min(100).max(900).optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  color: Color.optional(),
  uppercase: z.boolean().optional(),
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

/**
 * Palette: Hex-Werte für Brand-Tokens (gleiche Namen wie in brand/brand.json), z. B. eine helle Variante.
 * Gilt für Themes (`colors`) und Decks (`colors` – überschreibt Brand-Kit und Theme).
 */
export const PaletteColors = z.record(
  z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
  z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Hex-Farbe, z. B. #f4f2ed'),
)

export const Deck = z
  .strictObject({
    $schema: z.string().optional(),
    version: z.literal(1),
    title: z.string().min(1),
    /** Kurzbeschreibung – für Vorlagen und die Deck-Übersicht. */
    description: z.string().optional(),
    format: Format,
    theme: z.string().optional(),
    /** Eigene Palette des Decks (aus templates/palettes.json übernommen) – überschreibt Brand-Kit und Theme-Farben. */
    colors: PaletteColors.optional(),
    /** Globale Effekt-Intensität: 0 = ruhig, 1 = filmisch. */
    intensity: unit.optional(),
    /** Eigene Werte für die Textstile – eine Änderung wirkt auf alle Texte dieses Stils. */
    textStyles: z.partialRecord(TextStyle, DeckTextStyle).optional(),
    masters: z.array(Master).optional(),
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
    const masters = new Set<string>()
    deck.masters?.forEach((m, i) => {
      if (masters.has(m.id)) {
        ctx.addIssue({ code: 'custom', path: ['masters', i, 'id'], message: `Master-ID "${m.id}" ist doppelt` })
      }
      masters.add(m.id)
    })
    deck.slides.forEach((s, i) => {
      if (s.master && !masters.has(s.master)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slides', i, 'master'],
          message: `Master "${s.master}" fehlt in "masters"${masters.size ? ` (vorhanden: ${[...masters].join(', ')})` : ''}`,
        })
      }
    })
  })

export type Deck = z.infer<typeof Deck>
export type Slide = z.infer<typeof Slide>
export type Motion = z.infer<typeof Motion>
export type MotionProps = z.infer<typeof MotionProps>
export type Scene = z.infer<typeof Scene>
export type Master = z.infer<typeof Master>
export type DeckTextStyle = z.infer<typeof DeckTextStyle>
export type Element = z.infer<typeof Element>
export type TextElement = z.infer<typeof TextElement>
export type ImageElement = z.infer<typeof ImageElement>
export type VideoElement = z.infer<typeof VideoElement>
export type ShapeElement = z.infer<typeof ShapeElement>
export type IconElement = z.infer<typeof IconElement>
export type CustomElement = z.infer<typeof CustomElement>
export type ChartElement = z.infer<typeof ChartElement>
export type LottieElement = z.infer<typeof LottieElement>
export type World = z.infer<typeof World>
export type Background = z.infer<typeof Background>
export type Effect = z.infer<typeof Effect>
export type Transition = z.infer<typeof Transition>
export type Frame = z.infer<typeof Frame>
export type Animation = z.infer<typeof Animation>
export type Build = z.infer<typeof Build>
export type TextStyle = z.infer<typeof TextStyle>
