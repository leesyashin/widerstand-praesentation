import { useEffect, useState } from 'react'

/** Hash-Routing: #/ → Decks, #/deck/<name>/<folie> → Deck-Ansicht. */
export type Route = { page: 'decks' } | { page: 'deck'; name: string; slideId?: string }

function parse(hash: string): Route {
  const [page, name, slideId] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  if (page === 'deck' && name) return { page: 'deck', name, slideId: slideId || undefined }
  return { page: 'decks' }
}

export function href(route: Route): string {
  if (route.page === 'decks') return '#/'
  return `#/deck/${encodeURIComponent(route.name)}${route.slideId ? '/' + encodeURIComponent(route.slideId) : ''}`
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
