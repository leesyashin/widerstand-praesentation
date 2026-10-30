import type { Brand } from '../schema/brand'
import type { Deck } from '../schema/deck'
import type { Issue } from '../schema/issues'

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; issues: Issue[] }

export type DeckSummary = {
  name: string
  title: string
  slideCount: number
  format: Deck['format'] | null
  issues: Issue[]
}

type Body = { ok?: boolean; issues?: Issue[] } & Record<string, unknown>

async function request<T>(url: string, pick: (body: Body) => T, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    const body = (await res.json()) as Body
    if (res.ok) return { ok: true, value: pick(body) }
    return { ok: false, status: res.status, issues: body.issues ?? [] }
  } catch (err) {
    return { ok: false, status: 0, issues: [{ path: '', message: `Server nicht erreichbar: ${(err as Error).message}` }] }
  }
}

export const api = {
  listDecks: () => request('/api/decks', (b) => b.decks as DeckSummary[]),
  getDeck: (name: string) => request(`/api/decks/${encodeURIComponent(name)}`, (b) => b.deck as Deck),
  saveDeck: (name: string, deck: Deck) =>
    request(`/api/decks/${encodeURIComponent(name)}`, (b) => b.deck as Deck, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deck),
    }),
  getBrand: () => request('/api/brand', (b) => b.brand as Brand),
}

/** URL eines Assets im Deck-Ordner, z. B. "assets/foto.jpg" → "/decks/<name>/assets/foto.jpg". */
export function assetUrl(deckName: string, src: string): string {
  return `/decks/${encodeURIComponent(deckName)}/${src.split('/').map(encodeURIComponent).join('/')}`
}
