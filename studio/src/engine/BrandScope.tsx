import { useMemo, type ReactNode } from 'react'
import type { Brand } from '../schema/brand'
import { brandFontFaces, brandVariables } from './brand'

/** Stellt Brand-Farben und -Schriften als CSS-Variablen für alle Folien darin bereit. */
export function BrandScope({ brand, children }: { brand: Brand; children: ReactNode }) {
  const vars = useMemo(() => brandVariables(brand), [brand])
  const faces = useMemo(() => brandFontFaces(brand), [brand])
  return (
    <div className="brand-scope" style={{ ...vars, display: 'contents' }}>
      {faces && <style>{faces}</style>}
      {children}
    </div>
  )
}
