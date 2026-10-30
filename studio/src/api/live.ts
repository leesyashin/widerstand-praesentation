import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brand } from '../schema/brand'
import type { Deck } from '../schema/deck'
import type { Issue } from '../schema/issues'
import type { Layout } from '../schema/layout'
import type { Theme } from '../schema/theme'
import { api, type DeckSummary, type Result } from './client'
import { BRAND_CHANGED, DECK_CHANGED, TEMPLATES_CHANGED, type DeckChangedData } from './events'

export type Live<T> = {
  /** Letzter gültiger Stand – bleibt erhalten, wenn die Datei kurzzeitig ungültig ist. */
  value: T | null
  issues: Issue[]
  status: 'loading' | 'ok' | 'invalid' | 'missing' | 'offline'
  /** Zählt hoch, wenn eine Änderung von außen (Datei, Claude) angekommen ist. */
  externalUpdates: number
  reload: () => void
}

function onServerEvent<T>(event: string, cb: (data: T) => void): () => void {
  const hot = import.meta.hot
  if (!hot) return () => {}
  hot.on(event, cb)
  return () => hot.off(event, cb)
}

function useLive<T>(load: () => Promise<Result<T>>, subscribe: (refresh: () => void) => () => void): Live<T> {
  const [state, setState] = useState<Omit<Live<T>, 'reload'>>({
    value: null,
    issues: [],
    status: 'loading',
    externalUpdates: 0,
  })
  const seq = useRef(0)

  const refresh = useCallback((external: boolean) => {
    const n = ++seq.current
    void load().then((r) => {
      if (n !== seq.current) return // eine neuere Anfrage läuft schon
      setState((prev) => {
        const externalUpdates = prev.externalUpdates + (external ? 1 : 0)
        if (r.ok) return { value: r.value, issues: [], status: 'ok', externalUpdates }
        const status = r.status === 404 ? 'missing' : r.status === 0 ? 'offline' : 'invalid'
        return { value: status === 'missing' ? null : prev.value, issues: r.issues, status, externalUpdates }
      })
    })
  }, [load])

  useEffect(() => {
    refresh(false)
    return subscribe(() => refresh(true))
  }, [refresh, subscribe])

  const reload = useCallback(() => refresh(false), [refresh])
  return { ...state, reload }
}

const subscribeAllDecks = (refresh: () => void) => onServerEvent(DECK_CHANGED, refresh)
const subscribeBrand = (refresh: () => void) => onServerEvent(BRAND_CHANGED, refresh)

export function useDeckList(): Live<DeckSummary[]> {
  return useLive(api.listDecks, subscribeAllDecks)
}

export function useDeck(name: string): Live<Deck> {
  const load = useCallback(() => api.getDeck(name), [name])
  const subscribe = useCallback(
    (refresh: () => void) =>
      onServerEvent<DeckChangedData>(DECK_CHANGED, (data) => {
        if (data.name === name) refresh()
      }),
    [name],
  )
  return useLive(load, subscribe)
}

export function useBrand(): Live<Brand> {
  return useLive(api.getBrand, subscribeBrand)
}

const subscribeTemplates = (refresh: () => void) => onServerEvent(TEMPLATES_CHANGED, refresh)

const noTheme = () => Promise.resolve({ ok: true as const, value: null })

/** Theme eines Decks (null, wenn das Deck keins angibt). */
export function useTheme(name: string | undefined): Live<Theme | null> {
  const load = useCallback(() => (name ? api.getTheme(name) : noTheme()), [name])
  return useLive<Theme | null>(load, subscribeTemplates)
}

export function useLayouts(): Live<Layout[]> {
  return useLive(api.listLayouts, subscribeTemplates)
}
