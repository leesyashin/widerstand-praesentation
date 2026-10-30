import { createContext, useContext } from 'react'
import { TEXT_STYLES, type TextStyles } from './brand'

/** Typografie des aktuellen Themes für alle Folien darin. */
export const TextStylesContext = createContext<TextStyles>(TEXT_STYLES)

export function useTextStyles(): TextStyles {
  return useContext(TextStylesContext)
}

/** Deck-Intensität (0 = ruhig, 1 = filmisch). */
export const IntensityContext = createContext(0.3)

/**
 * Faktor für Effektstärken: 0.3 (Standard) = 1×, 0 = ~0.55×, 1 = ~2×.
 * So bleiben die in STYLE.md empfohlenen Werte bei Standard-Intensität gültig.
 */
export function intensityScale(intensity: number): number {
  return 0.55 + 1.5 * intensity
}

export function useEffectScale(): number {
  return intensityScale(useContext(IntensityContext))
}
