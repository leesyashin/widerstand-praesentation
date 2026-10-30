import type { Deck, Element, Master, Slide } from '../schema/deck'

/** Präfix der Element-IDs, die von einer Master-Folie stammen. */
export const MASTER_PREFIX = 'master--'

export function isMasterElement(id: string): boolean {
  return id.startsWith(MASTER_PREFIX)
}

export function findMaster(deck: Deck, id: string | undefined): Master | undefined {
  return id ? deck.masters?.find((m) => m.id === id) : undefined
}

/**
 * Folie mit ihrem Master zusammengeführt: Master-Elemente liegen ganz hinten (gesperrt, ohne Builds),
 * Hintergrund und Effekte des Masters gelten, solange die Folie keine eigenen hat.
 * Gleicher `match` auf allen Folien → Master-Elemente bleiben bei Magic Move ruhig stehen.
 */
export function resolveSlide(deck: Deck, slide: Slide): Slide {
  const master = findMaster(deck, slide.master)
  if (!master) return slide
  const inherited = master.elements.map(
    (el): Element => ({
      ...el,
      id: MASTER_PREFIX + el.id,
      match: el.match ?? MASTER_PREFIX + el.id,
      locked: true,
      build: undefined,
    }),
  )
  return {
    ...slide,
    background: slide.background ?? master.background,
    effects: slide.effects ?? master.effects,
    elements: [...inherited, ...slide.elements],
  }
}

/** Deck mit aufgelösten Master-Folien – für Präsentation, Screenshots und Vorschaubilder. */
export function resolveDeck(deck: Deck): Deck {
  if (!deck.masters?.length) return deck
  return { ...deck, slides: deck.slides.map((s) => resolveSlide(deck, s)) }
}

/** Ein Master als Folie dargestellt (zum Bearbeiten und für Vorschaubilder). */
export function masterAsSlide(master: Master): Slide {
  return { id: master.id, background: master.background, effects: master.effects, elements: master.elements }
}
