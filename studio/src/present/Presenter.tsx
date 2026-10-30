import qrcode from 'qrcode-generator'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDeck } from '../api/live'
import { href } from '../app/route'
import { ThemeScope } from '../engine/ThemeScope'
import type { Deck, Slide } from '../schema/deck'
import type { Rehearsal, RehearsalRun } from '../schema/rehearsal'
import { formatDuration, loadNetworkUrls, loadRehearsal, saveRehearsal, withRun } from './api'
import { SlidePreview } from './SlidePreview'
import { onShow, sendShow, type ShowCommand, type ShowState } from './sync'
import './Presenter.css'

/**
 * Referentenansicht: aktuelle und nächste Folie, Notizen, Uhr, Timer, Probe-Modus und Handy-Fernbedienung.
 * Steuert das Publikumsfenster (#/present/…) über den Show-Kanal – auch über zwei Bildschirme.
 */
export function Presenter({ name, slideId }: { name: string; slideId?: string }) {
  const live = useDeck(name)
  if (!live.value) return <div className="presenter presenter--loading">Lade Präsentation …</div>
  return (
    <ThemeScope theme={live.value.theme} intensity={live.value.intensity}>
      <PresenterView deck={live.value} name={name} startId={slideId} />
    </ThemeScope>
  )
}

type Probe = { startedAt: number; times: Record<string, number> }

/** Titel einer Folie für Listen: die größte Überschrift, sonst der erste Text. */
function slideTitle(slide: Slide | undefined): string {
  const texts = slide?.elements.filter((e) => e.type === 'text') ?? []
  const rank = ['display', 'title', 'heading']
  const text =
    texts.find((e) => e.type === 'text' && rank.includes(e.style ?? '') && e.style === 'display') ??
    texts.find((e) => e.type === 'text' && rank.includes(e.style ?? '')) ??
    texts[0]
  const line = text?.type === 'text' ? text.content.split('\n')[0]?.replace(/\*/g, '') : ''
  return line || slide?.id || ''
}

/** Publikumsfenster öffnen – wenn möglich direkt auf dem zweiten Bildschirm. */
function openAudience(name: string, slideId: string | undefined) {
  const win = window.open(href({ page: 'present', name, slideId }), `studio-audience-${name}`, 'popup,width=1280,height=720')
  if (!win) return
  // Window Management API (Chrome): Fenster auf den anderen Bildschirm schieben, falls erlaubt.
  const w = window as Window & { getScreenDetails?: () => Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }> }
  void w
    .getScreenDetails?.()
    .then(({ screens, currentScreen }) => {
      const other = screens.find((s) => s !== currentScreen)
      if (!other) return
      win.moveTo(other.availLeft, other.availTop)
      win.resizeTo(other.availWidth, other.availHeight)
    })
    .catch(() => {})
}

type ScreenDetailed = { availLeft: number; availTop: number; availWidth: number; availHeight: number }

function PresenterView({ deck, name, startId }: { deck: Deck; name: string; startId?: string }) {
  const [show, setShow] = useState<ShowState | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [slideSince, setSlideSince] = useState<{ id: string; at: number } | null>(null)
  const sinceRef = useRef<{ id: string; at: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [notesSize, setNotesSize] = useState(26)
  const [panel, setPanel] = useState<'none' | 'remote' | 'summary'>('none')
  const [rehearsal, setRehearsal] = useState<Rehearsal>({ runs: [] })
  const [probe, setProbe] = useState<Probe | null>(null)
  const probeRef = useRef<Probe | null>(null)
  const [summary, setSummary] = useState<{ run: RehearsalRun; previous?: RehearsalRun } | null>(null)
  const [urls, setUrls] = useState<string[] | null>(null)

  const order = useMemo(() => deck.slides.flatMap((s, i) => (s.skip ? [] : [i])), [deck])

  /** Stand vom Publikumsfenster: Folienwechsel messen (für Timer und Probe). */
  useEffect(
    () =>
      onShow(name, (message) => {
        if (message.kind !== 'state') return
        const state = message.state
        const at = Date.now()
        setShow(state)
        setStartedAt((s) => s ?? at)
        const prev = sinceRef.current
        if (prev?.id === state.slideId) return
        if (prev && probeRef.current) {
          const times = probeRef.current.times
          times[prev.id] = (times[prev.id] ?? 0) + (at - prev.at)
        }
        sinceRef.current = { id: state.slideId, at }
        setSlideSince(sinceRef.current)
      }),
    [name],
  )

  useEffect(() => {
    sendShow({ deck: name, kind: 'hello' })
    void loadRehearsal(name).then(setRehearsal)
    const tick = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(tick)
  }, [name])

  useEffect(() => {
    if (panel === 'remote') void loadNetworkUrls().then(setUrls)
  }, [panel])

  const command = (c: ShowCommand) => sendShow({ deck: name, kind: 'command', command: c })

  // Tastatur und Clicker steuern das Publikumsfenster.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) command({ type: 'next' })
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) command({ type: 'prev' })
      else if (e.key === 'b' || e.key === '.') command({ type: 'black' })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const startProbe = () => {
    const at = Date.now()
    probeRef.current = { startedAt: at, times: {} }
    setProbe(probeRef.current)
    setStartedAt(at)
    if (show) {
      sinceRef.current = { id: show.slideId, at }
      setSlideSince(sinceRef.current)
    }
    if (show && show.position !== 0) command({ type: 'goto', slideId: deck.slides[order[0] ?? 0]?.id ?? '' })
  }

  const stopProbe = () => {
    const p = probeRef.current
    if (!p) return
    const at = Date.now()
    const times = { ...p.times }
    const cur = sinceRef.current
    if (cur) times[cur.id] = (times[cur.id] ?? 0) + (at - cur.at)
    const run: RehearsalRun = { date: new Date(at).toISOString(), totalMs: at - p.startedAt, slides: times }
    const next = withRun(rehearsal, run)
    setSummary({ run, previous: rehearsal.runs[rehearsal.runs.length - 1] })
    setRehearsal(next)
    void saveRehearsal(name, next)
    probeRef.current = null
    setProbe(null)
    setPanel('summary')
  }

  const setTarget = (minutes: number | undefined) => {
    const next = { ...rehearsal, targetMinutes: minutes }
    setRehearsal(next)
    void saveRehearsal(name, next)
  }

  // Was ist jetzt zu sehen, was kommt als Nächstes?
  const currentIndex = show?.slideIndex ?? Math.max(0, deck.slides.findIndex((s) => s.id === startId))
  const current = deck.slides[currentIndex]
  const nextUp: { slide: Slide; step: number; label: string } | null = (() => {
    if (!show || !current) return current ? { slide: current, step: 0, label: 'Start' } : null
    if (show.build < show.builds) return { slide: current, step: show.build + 1, label: `Klick ${show.build + 1} von ${show.builds}` }
    const nextIndex = order[show.position + 1]
    const slide = nextIndex === undefined ? undefined : deck.slides[nextIndex]
    return slide ? { slide, step: 0, label: `Folie ${show.position + 2}` } : null
  })()

  const elapsed = startedAt ? now - startedAt : 0
  const onSlide = slideSince ? now - slideSince.at : 0
  const lastRun = rehearsal.runs[rehearsal.runs.length - 1]
  const guide = current ? lastRun?.slides[current.id] : undefined
  const targetMs = rehearsal.targetMinutes ? rehearsal.targetMinutes * 60000 : undefined
  const clock = new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="presenter">
      <header className="presenter__bar">
        <div className="presenter__status">
          <span className={`presenter__dot ${show ? 'is-live' : ''}`} />
          {show ? (show.black ? 'Schwarzbild' : show.ended ? 'Ende erreicht' : 'Live') : 'Kein Publikumsfenster'}
        </div>
        <div className="presenter__clock">{clock}</div>
        <div className="presenter__timer" title="Seit Beginn">
          {formatDuration(elapsed)}
          {targetMs && <span className="muted"> / {formatDuration(targetMs)}</span>}
          <button className="pbtn pbtn--ghost" onClick={() => setStartedAt(Date.now())} title="Timer zurücksetzen">
            ⟲
          </button>
        </div>
        <div className="presenter__actions">
          {probe ? (
            <button className="pbtn pbtn--rec" onClick={stopProbe}>
              ● Probe beenden
            </button>
          ) : (
            <button className="pbtn" onClick={startProbe} title="Misst die Zeit pro Folie und speichert sie">
              Probe starten
            </button>
          )}
          <button className="pbtn" onClick={() => setPanel(panel === 'remote' ? 'none' : 'remote')}>
            Handy
          </button>
          <button className="pbtn pbtn--primary" onClick={() => openAudience(name, current?.id)}>
            Publikum öffnen
          </button>
        </div>
      </header>

      {targetMs && (
        <div className="presenter__progress" aria-hidden>
          <span style={{ width: `${Math.min(100, (elapsed / targetMs) * 100)}%` }} className={elapsed > targetMs ? 'is-over' : ''} />
        </div>
      )}

      <main className="presenter__main">
        <section className="presenter__now">
          <div className="presenter__label">
            Jetzt · Folie {show ? show.position + 1 : order.indexOf(currentIndex) + 1} von {order.length}
            {show && show.builds > 0 && ` · Klick ${show.build} von ${show.builds}`}
          </div>
          {current && <SlidePreview deck={deck} name={name} slide={current} step={show?.build ?? 0} />}
          <div className="presenter__slide-time">
            <span>Auf dieser Folie: {formatDuration(onSlide)}</span>
            {guide !== undefined && (
              <span className={onSlide > guide * 1.15 ? 'is-over' : 'muted'}>Letzte Probe: {formatDuration(guide)}</span>
            )}
          </div>
        </section>

        <aside className="presenter__side">
          <div className="presenter__label">Als Nächstes{nextUp ? ` · ${nextUp.label}` : ''}</div>
          {nextUp ? (
            <SlidePreview deck={deck} name={name} slide={nextUp.slide} step={nextUp.step} />
          ) : (
            <div className="presenter__end">Ende der Präsentation</div>
          )}
          <div className="presenter__notes-head">
            <span className="presenter__label">Notizen</span>
            <span>
              <button className="pbtn pbtn--ghost" onClick={() => setNotesSize((s) => Math.max(16, s - 2))} title="Kleiner">
                A−
              </button>
              <button className="pbtn pbtn--ghost" onClick={() => setNotesSize((s) => Math.min(48, s + 2))} title="Größer">
                A+
              </button>
            </span>
          </div>
          <div className="presenter__notes" style={{ fontSize: notesSize }}>
            {current?.notes ? current.notes : <span className="muted">Keine Notizen für diese Folie.</span>}
          </div>
        </aside>
      </main>

      <footer className="presenter__controls">
        <button className="pbtn pbtn--big" onClick={() => command({ type: 'prev' })} disabled={!show}>
          ← Zurück
        </button>
        <button className="pbtn pbtn--ghost" onClick={() => command({ type: 'black' })} disabled={!show}>
          Schwarzbild (B)
        </button>
        <button className="pbtn pbtn--big pbtn--primary" onClick={() => command({ type: 'next' })} disabled={!show}>
          Weiter →
        </button>
      </footer>

      {!show && (
        <div className="presenter__waiting">
          <p>
            Öffne das Publikumsfenster und zieh es auf den Beamer – oder starte im Editor „Abspielen“ und drücke dort <kbd>R</kbd>.
          </p>
          <button className="pbtn pbtn--primary" onClick={() => openAudience(name, current?.id)}>
            Publikum öffnen
          </button>
        </div>
      )}

      {panel === 'remote' && <RemotePanel name={name} urls={urls} onClose={() => setPanel('none')} />}
      {panel === 'summary' && summary && (
        <ProbeSummary
          deck={deck}
          run={summary.run}
          previous={summary.previous}
          targetMinutes={rehearsal.targetMinutes}
          onTarget={setTarget}
          onClose={() => setPanel('none')}
        />
      )}
    </div>
  )
}

/** QR-Code für die Handy-Fernbedienung (gleiches WLAN). */
function RemotePanel({ name, urls, onClose }: { name: string; urls: string[] | null; onClose: () => void }) {
  const base = urls?.[0]
  const url = base ? `${base.replace(/\/$/, '')}/${href({ page: 'remote', name })}` : null
  const svg = useMemo(() => {
    if (!url) return null
    const qr = qrcode(0, 'M')
    qr.addData(url)
    qr.make()
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })
  }, [url])
  return (
    <div className="presenter__panel" role="dialog" aria-label="Handy-Fernbedienung">
      <h2>Handy als Fernbedienung</h2>
      {urls === null && <p className="muted">Suche Adresse …</p>}
      {urls !== null && !url && (
        <p>
          Dein Handy erreicht den Mac noch nicht. Starte Studio mit <code>npm run dev:remote</code> statt <code>npm run dev</code>
          – dann ist es im WLAN sichtbar.
        </p>
      )}
      {svg && url && (
        <>
          <div className="presenter__qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="muted">Mit der Kamera scannen. Handy und Mac müssen im selben WLAN sein.</p>
          <code className="presenter__url">{url}</code>
        </>
      )}
      <button className="pbtn" onClick={onClose}>
        Schließen
      </button>
    </div>
  )
}

function ProbeSummary({
  deck,
  run,
  previous,
  targetMinutes,
  onTarget,
  onClose,
}: {
  deck: Deck
  run: RehearsalRun
  previous?: RehearsalRun
  targetMinutes?: number
  onTarget: (minutes: number | undefined) => void
  onClose: () => void
}) {
  const target = targetMinutes ? targetMinutes * 60000 : undefined
  return (
    <div className="presenter__panel presenter__panel--wide" role="dialog" aria-label="Ergebnis der Probe">
      <h2>Probe: {formatDuration(run.totalMs)}</h2>
      <p className="muted">
        {target
          ? run.totalMs > target
            ? `${formatDuration(run.totalMs - target)} über dem Ziel.`
            : `${formatDuration(target - run.totalMs)} unter dem Ziel.`
          : 'Leg ein Ziel fest, um zu sehen, ob du im Rahmen bleibst.'}
        {previous && ` Vorige Probe: ${formatDuration(previous.totalMs)}.`}
      </p>
      <label className="presenter__target">
        Ziel in Minuten
        <input
          type="number"
          min={1}
          max={600}
          defaultValue={targetMinutes ?? ''}
          onChange={(e) => onTarget(e.target.value ? Number(e.target.value) : undefined)}
        />
      </label>
      <table className="presenter__table">
        <thead>
          <tr>
            <th>#</th>
            <th>Folie</th>
            <th>Zeit</th>
            <th>vs. vorher</th>
          </tr>
        </thead>
        <tbody>
          {deck.slides.map((s, i) => {
            const t = run.slides[s.id]
            if (t === undefined) return null
            const before = previous?.slides[s.id]
            const delta = before === undefined ? null : t - before
            return (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td>{slideTitle(s)}</td>
                <td>{formatDuration(t)}</td>
                <td className={delta !== null && delta > 0 ? 'is-over' : 'muted'}>
                  {delta === null ? '–' : `${delta > 0 ? '+' : '−'}${formatDuration(Math.abs(delta))}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button className="pbtn pbtn--primary" onClick={onClose}>
        Fertig
      </button>
    </div>
  )
}
