import { z } from 'zod'
import { PaletteColors } from './deck'

/**
 * Paletten-Bibliothek (templates/palettes.json): fertige Farbsätze, die ein Deck im Editor übernehmen kann.
 * Neue Paletten erst nach Vincents Auswahl aufnehmen – siehe EXTENDING.md.
 */
export const Palette = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  /** hell oder dunkel – für die Sortierung im Editor. */
  tone: z.enum(['dark', 'light']),
  colors: PaletteColors,
})

export const PaletteLibrary = z.strictObject({
  $schema: z.string().optional(),
  palettes: z.array(Palette).superRefine((list, ctx) => {
    const seen = new Set<string>()
    list.forEach((p, i) => {
      if (seen.has(p.name)) ctx.addIssue({ code: 'custom', path: [i, 'name'], message: `Palette "${p.name}" ist doppelt` })
      seen.add(p.name)
    })
  }),
})

export type Palette = z.infer<typeof Palette>
export type PaletteLibrary = z.infer<typeof PaletteLibrary>
