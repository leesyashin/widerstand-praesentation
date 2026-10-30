import { useBrand } from '../api/live'
import { FALLBACK_BRAND } from '../engine/brand'
import { BrandScope } from '../engine/BrandScope'
import { Present } from '../present/Present'
import { Presenter } from '../present/Presenter'
import { Remote } from '../present/Remote'
import { RenderView } from '../present/RenderView'
import { DeckList } from './DeckList'
import { DeckView } from './DeckView'
import { useRoute } from './route'

export function App() {
  const route = useRoute()
  const brand = useBrand()
  return (
    <BrandScope brand={brand.value ?? FALLBACK_BRAND}>
      {route.page === 'present' ? (
        <Present key={route.name} name={route.name} slideId={route.slideId} />
      ) : route.page === 'presenter' ? (
        <Presenter key={route.name} name={route.name} slideId={route.slideId} />
      ) : route.page === 'remote' ? (
        <Remote key={route.name} name={route.name} />
      ) : route.page === 'render' ? (
        <RenderView name={route.name} slideId={route.slideId} step={route.step} />
      ) : route.page === 'deck' ? (
        <DeckView key={route.name} name={route.name} slideId={route.slideId} brandIssues={brand.issues} />
      ) : (
        <DeckList brandIssues={brand.issues} />
      )}
    </BrandScope>
  )
}
