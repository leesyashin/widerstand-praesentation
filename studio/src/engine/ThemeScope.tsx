import { useMemo, type ReactNode } from 'react'
import { useTheme } from '../api/live'
import { mergeTextStyles } from './brand'
import { TextStylesContext } from './context'

/** Lädt das Theme eines Decks und stellt seine Typografie für alle Folien darin bereit. */
export function ThemeScope({ theme, children }: { theme: string | undefined; children: ReactNode }) {
  const live = useTheme(theme)
  const styles = useMemo(() => mergeTextStyles(live.value), [live.value])
  return <TextStylesContext.Provider value={styles}>{children}</TextStylesContext.Provider>
}
