/**
 * Show-Kanal: verbindet Publikumsfenster (Present), Referentenansicht und Handy-Fernbedienung.
 * Läuft über die Live-Verbindung des Dev-Servers (server/showPlugin.ts verteilt an alle Geräte im WLAN).
 * Ohne Dev-Server (z. B. später im Web-Player) fällt er auf BroadcastChannel zurück – dann nur im selben Browser.
 */

export const SHOW_EVENT = 'studio:show'

/** Stand der laufenden Präsentation – gesendet vom Publikumsfenster. */
export type ShowState = {
  /** Index der Folie im Deck. */
  slideIndex: number
  slideId: string
  /** Position in der Abspielfolge (ohne übersprungene Folien) und deren Länge. */
  position: number
  total: number
  /** Gespielte Klick-Schritte auf der Folie (0 = nur Automatik) und deren Anzahl. */
  build: number
  builds: number
  ended: boolean
  black: boolean
}

export type ShowCommand = { type: 'next' } | { type: 'prev' } | { type: 'black' } | { type: 'goto'; slideId: string }

export type ShowMessage =
  | { deck: string; kind: 'state'; state: ShowState }
  | { deck: string; kind: 'command'; command: ShowCommand }
  /** Neue Referentenansicht/Fernbedienung fragt nach dem aktuellen Stand. */
  | { deck: string; kind: 'hello' }

const channel = typeof BroadcastChannel !== 'undefined' && !import.meta.hot ? new BroadcastChannel('studio-show') : null

export function sendShow(message: ShowMessage) {
  if (import.meta.hot) import.meta.hot.send(SHOW_EVENT, message)
  else channel?.postMessage(message)
}

/** Nachrichten für ein Deck abonnieren. Gibt die Abmeldefunktion zurück. */
export function onShow(deck: string, handler: (message: ShowMessage) => void): () => void {
  const listener = (message: ShowMessage) => {
    if (message && message.deck === deck) handler(message)
  }
  const hot = import.meta.hot
  if (hot) {
    hot.on(SHOW_EVENT, listener)
    return () => hot.off(SHOW_EVENT, listener)
  }
  const onMessage = (e: MessageEvent<ShowMessage>) => listener(e.data)
  channel?.addEventListener('message', onMessage)
  return () => channel?.removeEventListener('message', onMessage)
}
