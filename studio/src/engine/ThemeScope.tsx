import { useMemo, type ReactNode } from 'react'
import { useTheme } from '../api/live'
import { mergeTextStyles } from './brand'
import { IntensityContext, TextStylesContext } from './context'

/** Lädt das Theme eines Decks und stellt Typografie und Intensität für alle Folien darin bereit. */
export function ThemeScope({
  theme,
  intensity,
  children,
}: {
  theme: string | undefined
  intensity?: number
  children: ReactNode
}) {
  const live = useTheme(theme)
  const styles = useMemo(() => mergeTextStyles(live.value), [live.value])
  return (
    <TextStylesContext.Provider value={styles}>
      <IntensityContext.Provider value={intensity ?? 0.3}>{children}</IntensityContext.Provider>
    </TextStylesContext.Provider>
  )
}
