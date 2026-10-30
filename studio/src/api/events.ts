/** Live-Events vom Dev-Server an die App (gesendet in server/vitePlugin.ts). */
export const DECK_CHANGED = 'studio:deck-changed'
export const BRAND_CHANGED = 'studio:brand-changed'
export const TEMPLATES_CHANGED = 'studio:templates-changed'

export type DeckChangedData = { name: string }
