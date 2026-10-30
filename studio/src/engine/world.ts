import type { Deck, Slide, World } from '../schema/deck'

/** Abstand zwischen Folien ohne eigene Raum-Position (in Folienbreiten). */
export const WORLD_SPACING = 1.25

/** Position einer Folie im Raum – ohne Angabe liegen die Folien nebeneinander auf einer Linie. */
export function worldOf(slide: Slide, index: number, deck: Deck): Required<World> {
  const w = slide.world
  return {
    x: w?.x ?? index * deck.format.width * WORLD_SPACING,
    y: w?.y ?? 0,
    z: w?.z ?? 0,
    rotate: w?.rotate ?? 0,
    scale: w?.scale ?? 1,
  }
}
