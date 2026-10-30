import { useContext, useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTheme } from '../api/live'
import type { Deck } from '../schema/deck'
import { mergeTextStyles } from './brand'
import { IntensityContext, PaletteContext, TextStylesContext, usePalette } from './context'

/**
 * Lädt das Theme eines Decks und stellt Typografie, Palette und Intensität für alle Folien darin bereit.
 * Die Palette des Themes überschreibt Brand-Farben nur innerhalb dieses Bereichs – mehrere Decks mit
 * unterschiedlichen Themes (z. B. in der Deck-Übersicht) stören sich nicht.
 */
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
  const brand = useContext(PaletteContext)
  const styles = useMemo(() => mergeTextStyles(live.value, textStyles), [live.value, textStyles])
  const palette = useMemo(() => (live.value?.colors ? { ...brand, ...live.value.colors } : brand), [brand, live.value])
  return (
    <TextStylesContext.Provider value={styles}>
      <IntensityContext.Provider value={intensity ?? 0.3}>
        <PaletteContext.Provider value={palette}>
          <ThemeVars>{children}</ThemeVars>
        </PaletteContext.Provider>
      </IntensityContext.Provider>
    </TextStylesContext.Provider>
  )
}

/**
 * Setzt die Palette als CSS-Variablen (--brand-*) für alles darin. Auch für Inhalte in Portalen
 * (z. B. Layout-Auswahl), die außerhalb des ThemeScope-Elements im DOM hängen.
 */
export function ThemeVars({ children }: { children: ReactNode }) {
  const palette = usePalette()
  const style = useMemo(
    () => Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--brand-${k}`, v])) as CSSProperties,
    [palette],
  )
  return (
    <div className="theme-vars" style={style}>
      {children}
    </div>
  )
}
