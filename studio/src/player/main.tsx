import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import bundle from 'virtual:studio-bundle'
import '../ui/tokens.css'
import '../ui/base.css'
import { setBundle } from '../api/client'
import { BrandScope } from '../engine/BrandScope'
import { Present } from '../present/Present'

/**
 * Eigenständiger Web-Player (npm run publish -- <deck>): nur Ansehen, mit allen Animationen.
 * Deck, Brand-Kit und Theme sind fest eingebaut, Medien liegen daneben unter decks/<name>/ und brand/.
 * Startfolie über die Adresse: …/index.html#<folien-id>
 */
setBundle(bundle)

const start = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandScope brand={bundle.brand}>
      <Present name={bundle.name} slideId={start} player />
    </BrandScope>
  </StrictMode>,
)
