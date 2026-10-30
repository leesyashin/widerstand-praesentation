import { z } from 'zod'
import { Background, Effect, Element, Transition } from './deck'
import { Surface } from './theme'

/**
 * Animierter Baustein – eine fertige Bewegung zum Einfügen.
 * `kind: "slide"` legt eine neue Folie an (z. B. Intro, Kapitel-Trenner, Abspann),
 * `kind: "elements"` setzt die Elemente auf die aktuelle Folie (z. B. Counter, Logo-Reveal).
 */
export const Block = z.strictObject({
  $schema: z.string().optional(),
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(['slide', 'elements']),
  /** Fläche für Hintergrund und Effekte aus dem Theme, falls der Baustein keine eigenen mitbringt. */
  surface: Surface.optional(),
  /** Format, für das die Koordinaten gelten. Für andere Formate wird skaliert. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  background: Background.optional(),
  effects: z.array(Effect).optional(),
  transition: Transition.optional(),
  elements: z.array(Element).min(1),
})

export type Block = z.infer<typeof Block>
