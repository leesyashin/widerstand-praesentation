import { useMemo, type ReactNode } from 'react'
import type { Brand } from '../schema/brand'
import { brandFontFaces, brandVariables } from './brand'
import { PaletteContext } from './context'

/**
 * Stellt Brand-Farben und -Schriften als CSS-Variablen auf :root bereit –
 * so gelten sie überall, auch in Menüs, die per Portal außerhalb der App hängen.
 */
export function BrandScope({ brand, children }: { brand: Brand; children: ReactNode }) {
  const css = useMemo(() => {
    const vars = Object.entries(brandVariables(brand))
      .map(([k, v]) => `${k}:${String(v)};`)
      .join('')
    return `:root{${vars}}\n${brandFontFaces(brand)}`
  }, [brand])
  return (
    <PaletteContext.Provider value={brand.colors}>
      <style>{css}</style>
      {children}
    </PaletteContext.Provider>
  )
}
