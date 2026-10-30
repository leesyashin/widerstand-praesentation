import { useEffect, useState } from 'react'

/**
 * Hash-Routing:
 *   #/                                → Decks
 *   #/deck/<name>/<folie>             → Editor
 *   #/present/<name>/<folie>          → Präsentation (Publikum)
 *   #/presenter/<name>/<folie>        → Referentenansicht
 *   #/remote/<name>                   → Handy-Fernbedienung
 *   #/render/<name>/<folie>/<schritt> → nackte Folie für Screenshots (npm run shots)
 */
export type Route =
  | { page: 'decks' }
  | { page: 'deck' | 'present' | 'presenter' | 'remote'; name: string; slideId?: string }
  | { page: 'render'; name: string; slideId?: string; step?: number }

function parse(hash: string): Route {
  const [page, name, slideId, step] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if ((page === 'deck' || page === 'present' || page === 'presenter' || page === 'remote') && name) {
    return { page, name, slideId: slideId || undefined }
  }
  if (page === 'render' && name) {
    return { page, name, slideId: slideId || undefined, step: step === undefined ? undefined : Number(step) }
  }
  return { page: 'decks' }
}

export function href(route: Route): string {
  if (route.page === 'decks') return '#/'
  const base = `#/${route.page}/${encodeURIComponent(route.name)}`
  const slide = route.slideId ? '/' + encodeURIComponent(route.slideId) : ''
  const step = route.page === 'render' && route.step !== undefined ? `/${route.step}` : ''
  return base + slide + step
}

export function navigate(route: Route, replace = false) {
  const url = href(route)
  if (replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
