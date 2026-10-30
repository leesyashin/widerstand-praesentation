import { useMemo, type ReactNode } from 'react'
import { useTheme } from '../api/live'
import type { Deck } from '../schema/deck'
import { mergeTextStyles } from './brand'
import { IntensityContext, TextStylesContext } from './context'

/** Lädt das Theme eines Decks und stellt Typografie und Intensität für alle Folien darin bereit. */
export function ThemeScope({
  theme,
  intensity,
  textStyles,
  children,
}: {
  theme: string | undefined
  intensity?: number
  /** Textstile des Decks – überschreiben die des Themes. */
  textStyles?: Deck['textStyles']
  children: ReactNode
}) {
  const live = useTheme(theme)
  const styles = useMemo(() => mergeTextStyles(live.value, textStyles), [live.value, textStyles])
  return (
    <TextStylesContext.Provider value={styles}>
      <IntensityContext.Provider value={intensity ?? 0.3}>{children}</IntensityContext.Provider>
    </TextStylesContext.Provider>
  )
}
