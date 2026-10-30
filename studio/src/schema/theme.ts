import { z } from 'zod'
import { Background, Color, Effect, TextStyle } from './deck'

/**
 * Theme – Typografie-Skala, Standard-Hintergründe und Effekte.
 * Farben kommen aus dem Brand-Kit (Tokens), das Theme legt fest, wie sie eingesetzt werden.
 */

export const TextStyleDef = z.strictObject({
  font: z.enum(['display', 'text', 'mono']),
  /** Schriftgröße in logischen Pixeln (bei 1080 px Folienhöhe). */
  size: z.number().positive(),
  weight: z.number().int().min(100).max(900),
  lineHeight: z.number().positive(),
  /** In em, z. B. -0.03. */
  letterSpacing: z.number(),
  color: Color,
  uppercase: z.boolean().optional(),
})

/** Wie eine Folie wirkt – bestimmt Hintergrund und Effekte beim Anlegen aus einem Layout. */
export const Surface = z.enum(['title', 'content', 'light'])

export const Theme = z.strictObject({
  $schema: z.string().optional(),
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  /**
   * Palette des Themes: überschreibt Brand-Farben (gleiche Token-Namen) für alle Decks mit diesem Theme,
   * z. B. eine helle Variante. Ohne Angabe gelten die Farben aus brand/brand.json.
   */
  colors: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'Hex-Farbe, z. B. #f4f2ed')).optional(),
  textStyles: z.partialRecord(TextStyle, TextStyleDef.partial()),
  backgrounds: z.partialRecord(Surface, Background),
  effects: z.partialRecord(Surface, z.array(Effect)).optional(),
})

export type TextStyleDef = z.infer<typeof TextStyleDef>
export type Surface = z.infer<typeof Surface>
export type Theme = z.infer<typeof Theme>
