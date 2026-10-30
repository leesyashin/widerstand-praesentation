import { z } from 'zod'
import { Background, BuildPreset, TransitionType } from './deck'

/**
 * Brand-Kit – Farben, Schriften, Logo und Motion-Grundton.
 * Decks verweisen auf Farben per Token: "brand.<name>", z. B. "brand.accent".
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Hex-Farbe, z. B. #0a84ff')
const fontFile = z.strictObject({
  /** Pfad relativ zu studio/brand/, z. B. "fonts/MeineSchrift-Bold.woff2". */
  src: z.string().regex(/^fonts\/[^\s]+\.(woff2|woff|otf|ttf)$/),
  /** Einzelnes Gewicht (400) oder Bereich einer variablen Schrift ("200 800"). */
  weight: z.union([z.number().int().min(100).max(900), z.string().regex(/^[1-9]00 [1-9]00$/, 'z. B. "200 800"')]),
  style: z.enum(['normal', 'italic']).optional(),
})

const font = z.strictObject({
  family: z.string().min(1),
  /** Fallback-Stack, falls die Schrift nicht geladen ist. */
  fallback: z.string().optional(),
  /** Eigene Schriftdateien. Leer = Systemschrift bzw. kuratierte Schrift. */
  files: z.array(fontFile).optional(),
})

export const Brand = z.strictObject({
  $schema: z.string().optional(),
  name: z.string().min(1),
  colors: z
    .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), hex)
    .refine((c) => ['background', 'surface', 'text', 'textMuted', 'accent'].every((k) => k in c), {
      message: 'Pflichtfarben: background, surface, text, textMuted, accent',
    }),
  fonts: z.strictObject({ display: font, text: font, mono: font.optional() }),
  logo: z
    .strictObject({
      /** Pfade relativ zu studio/brand/, z. B. "logo.svg". */
      primary: z.string().optional(),
      mono: z.string().optional(),
    })
    .optional(),
  motion: z
    .strictObject({
      /** Standard-Intensität für neue Decks: 0 = ruhig, 1 = filmisch. */
      intensity: z.number().min(0).max(1),
      /** Signature-Build: Standard für Headlines und neue Elemente. */
      build: BuildPreset.optional(),
      /** Standard-Übergang zwischen Folien. */
      transition: TransitionType.optional(),
    })
    .optional(),
  signature: z
    .strictObject({
      /** Wiedererkennbarer Hintergrund für Titel- und Kapitel-Folien. */
      background: Background.optional(),
    })
    .optional(),
})

export type Brand = z.infer<typeof Brand>
