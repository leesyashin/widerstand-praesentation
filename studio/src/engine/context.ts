import { createContext, useContext } from 'react'
import { TEXT_STYLES, type TextStyles } from './brand'

/** Typografie des aktuellen Themes für alle Folien darin. */
export const TextStylesContext = createContext<TextStyles>(TEXT_STYLES)

export function useTextStyles(): TextStyles {
  return useContext(TextStylesContext)
}
