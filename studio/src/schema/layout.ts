import { z } from 'zod'
import { Element } from './deck'
import { Surface } from './theme'

/** Folien-Layout – Startpunkt für neue Folien. Beim Anlegen werden die Elemente in die Folie kopiert. */
export const Layout = z.strictObject({
  $schema: z.string().optional(),
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  surface: Surface,
  /** Format, für das die Koordinaten gelten. Für andere Formate wird skaliert. */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  elements: z.array(Element),
})

export type Layout = z.infer<typeof Layout>
