import library from '../../templates/palettes.json'
import { PaletteLibrary, type Palette } from '../schema/palette'

/** Fertige Paletten aus templates/palettes.json (fest im Build, live im Dev-Server). */
const parsed = PaletteLibrary.safeParse(library)
export const PALETTES: Palette[] = parsed.success ? parsed.data.palettes : []

/** Welche Bibliotheks-Palette ein Farbsatz ist (gleiche Werte), sonst undefined. */
export function findPalette(colors: Record<string, string> | undefined): Palette | undefined {
  if (!colors) return undefined
  const norm = (c: Record<string, string>) =>
    Object.keys(c)
      .sort()
      .map((k) => `${k}=${c[k]!.toLowerCase()}`)
      .join(';')
  const key = norm(colors)
  return PALETTES.find((p) => norm(p.colors) === key)
}
