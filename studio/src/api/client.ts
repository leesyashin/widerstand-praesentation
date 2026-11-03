import type { Block } from '../schema/block'
import type { Brand } from '../schema/brand'
import type { Deck } from '../schema/deck'
import type { Issue } from '../schema/issues'
import type { Layout } from '../schema/layout'
import type { Theme } from '../schema/theme'
import { assetVersion, cloudApi } from './cloud/backend'
import { CLOUD } from './cloud/config'

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

/** Web-Player (npm run publish): Deck, Brand-Kit und Theme stecken fest im Build – ohne Datei-Dienst. */
export type Bundle = { name: string; deck: Deck; brand: Brand; theme: Theme | null }

let bundle: Bundle | null = null

export function setBundle(value: Bundle) {
  bundle = value
}

const fixed = <T>(value: T): Promise<Result<T>> => Promise.resolve({ ok: true, value })

/** Datei-Dienst des Dev-Servers (server/vitePlugin.ts). */
const localApi = {
  listDecks: () => request('/api/decks', (b) => b.decks as DeckSummary[]),
  getDeck: (name: string) => request(`/api/decks/${encodeURIComponent(name)}`, (b) => b.deck as Deck),
  saveDeck: (name: string, deck: Deck) =>
    request(`/api/decks/${encodeURIComponent(name)}`, (b) => b.deck as Deck, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deck),
    }),
  getBrand: () => request('/api/brand', (b) => b.brand as Brand),
  getTheme: (name: string) => request(`/api/themes/${encodeURIComponent(name)}`, (b) => b.theme as Theme),
  listLayouts: () => request('/api/layouts', (b) => b.layouts as Layout[]),
  listThemes: () => request('/api/themes', (b) => b.themes as Theme[]),
  listBlocks: () => request('/api/blocks', (b) => b.blocks as Block[]),
  listTemplates: () => request('/api/templates', (b) => b.templates as { name: string; deck: Deck }[]),
  createDeck: (name: string, deck: Deck) =>
    request('/api/decks', (b) => b.name as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, deck }),
    }),
  listAssets: (name: string) => request(`/api/decks/${encodeURIComponent(name)}/assets`, (b) => b.assets as AssetInfo[]),
  listBrandAssets: () => request('/api/brand/assets', (b) => b.assets as AssetInfo[]),
  uploadAsset: (name: string, file: Blob, fileName: string) =>
    request(`/api/decks/${encodeURIComponent(name)}/assets?file=${encodeURIComponent(fileName)}`, (b) => b.path as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
  deleteAsset: (name: string, path: string) =>
    request(`/api/decks/${encodeURIComponent(name)}/assets?path=${encodeURIComponent(path)}`, () => true, { method: 'DELETE' }),
  uploadFont: (file: Blob, fileName: string) =>
    request(`/api/brand/fonts?file=${encodeURIComponent(fileName)}`, (b) => b.path as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
  saveBrand: (brand: Brand) =>
    request('/api/brand', (b) => b.brand as Brand, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brand),
    }),
}

/** Gehostete App (Phase 7) speichert im GitHub-Repo, sonst der Dev-Server. Der Web-Player hat alles eingebaut. */
const backend: typeof localApi = CLOUD ? cloudApi : localApi

export const api: typeof localApi = {
  ...backend,
  getDeck: (name) => (bundle ? fixed(bundle.deck) : backend.getDeck(name)),
  getBrand: () => (bundle ? fixed(bundle.brand) : backend.getBrand()),
  getTheme: (name) => (bundle?.theme ? fixed(bundle.theme) : backend.getTheme(name)),
}

export type AssetInfo = { path: string; size: number; kind: 'image' | 'video' | 'lottie' | 'other' }

/**
 * URL einer Datei: "assets/foto.jpg" → "/decks/<name>/assets/foto.jpg",
 * "brand/logo.svg" → "/brand/logo.svg". Im Web-Player relativ ("./decks/…"), damit er in jedem Unterordner läuft.
 */
export function assetUrl(deckName: string, src: string): string {
  const path = src.split('/').map(encodeURIComponent).join('/')
  const base = import.meta.env.BASE_URL
  const url = src.startsWith('brand/') ? `${base}${path}` : `${base}decks/${encodeURIComponent(deckName)}/${path}`
  if (!CLOUD || bundle) return url
  // Unterwegs lädt der Service Worker (public/sw.js) die Datei aus dem Repo – über die Blob-SHA dauerhaft im Cache.
  const version = assetVersion(src.startsWith('brand/') ? src : `decks/${deckName}/${src}`)
  return version ? `${url}?v=${version}` : url
}
