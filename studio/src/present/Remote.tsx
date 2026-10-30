import { useEffect, useState } from 'react'
import { useDeck } from '../api/live'
import { formatDuration } from './api'
import { onShow, sendShow, type ShowCommand, type ShowState } from './sync'
import './Remote.css'

/**
 * Handy-Fernbedienung (#/remote/<deck>): großer Weiter-Knopf, Notizen der aktuellen Folie, Timer.
 * Verbindet sich über den Dev-Server im WLAN mit dem Publikumsfenster.
 */
export function Remote({ name }: { name: string }) {
  const live = useDeck(name)
  const deck = live.value
  const [show, setShow] = useState<ShowState | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const off = onShow(name, (message) => {
      if (message.kind !== 'state') return
      setShow(message.state)
      setStartedAt((s) => s ?? Date.now())
    })
    sendShow({ deck: name, kind: 'hello' })
    const tick = setInterval(() => setNow(Date.now()), 1000)
    // Bildschirm wach halten, solange die Fernbedienung offen ist (wo unterstützt).
    let lock: { release: () => Promise<void> } | null = null
    const wake = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    void wake?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => {
      off()
      clearInterval(tick)
      void lock?.release().catch(() => {})
    }
  }, [name])

  const send = (command: ShowCommand) => {
    navigator.vibrate?.(12)
    sendShow({ deck: name, kind: 'command', command })
  }

  const slide = show && deck ? deck.slides[show.slideIndex] : undefined
  return (
    <div className="remote">
      <header className="remote__bar">
        <span className="remote__title">{deck?.title ?? name}</span>
        <span className="remote__meta">
          {show ? `${show.position + 1} / ${show.total}` : '– / –'}
          {show && show.builds > 0 ? ` · ${show.build}/${show.builds}` : ''}
          <span className="remote__timer">{formatDuration(startedAt ? now - startedAt : 0)}</span>
        </span>
      </header>

      <main className="remote__notes">
        {!show && <p className="remote__wait">Warte auf die Präsentation … Öffne sie am Mac und starte „Abspielen“.</p>}
        {show && (slide?.notes ? slide.notes : <span className="remote__muted">Keine Notizen.</span>)}
      </main>

      <footer className="remote__controls">
        <button className="remote__btn remote__btn--prev" onClick={() => send({ type: 'prev' })} disabled={!show}>
          Zurück
        </button>
        <button className={`remote__btn remote__btn--black ${show?.black ? 'is-on' : ''}`} onClick={() => send({ type: 'black' })} disabled={!show}>
          Schwarz
        </button>
        <button className="remote__btn remote__btn--next" onClick={() => send({ type: 'next' })} disabled={!show}>
          Weiter
        </button>
      </footer>
    </div>
  )
}
