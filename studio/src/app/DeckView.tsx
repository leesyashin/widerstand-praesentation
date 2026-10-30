import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useDeck } from '../api/live'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import type { Deck, Element, Slide } from '../schema/deck'
import type { Issue } from '../schema/issues'
import { Icon } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import { Toast } from '../ui/Toast'
import { href, navigate } from './route'
import './DeckView.css'

export function DeckView({ name, slideId, brandIssues }: { name: string; slideId?: string; brandIssues: Issue[] }) {
  const live = useDeck(name)
  const deck = live.value
  // Eigene Speicherungen sollen keinen „von außen geändert“-Hinweis auslösen.
  const ownSave = useRef<string | null>(null)
  const [toast, setToast] = useState(0)
  const [saveIssues, setSaveIssues] = useState<Issue[]>([])

  const index = deck ? Math.max(0, deck.slides.findIndex((s) => s.id === slideId)) : 0
  const slide = deck?.slides[index]

  useEffect(() => {
    if (!live.externalUpdates || !deck) return
    const text = JSON.stringify(deck)
    if (ownSave.current === text) return
    setToast((t) => t + 1)
  }, [live.externalUpdates, deck])

  // Pfeiltasten wechseln die Folie (außer beim Tippen).
  useEffect(() => {
    if (!deck) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      const last = deck.slides.length - 1
      const next =
        e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown'
          ? Math.min(last, index + 1)
          : e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp'
            ? Math.max(0, index - 1)
            : e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? last
                : null
      if (next === null || next === index) return
      e.preventDefault()
      navigate({ page: 'deck', name, slideId: deck.slides[next]?.id }, true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck, index, name])

  const save = async (next: Deck) => {
    ownSave.current = JSON.stringify(next)
    const result = await api.saveDeck(name, next)
    setSaveIssues(result.ok ? [] : result.issues)
  }

  if (live.status === 'missing') {
    return (
      <div className="deck-empty">
        <IssueList title={`Deck „${name}“ nicht gefunden`} issues={live.issues} />
        <a className="btn" href={href({ page: 'decks' })}>
          Zu den Decks
        </a>
      </div>
    )
  }

  return (
    <div className="deck">
      <header className="deck__toolbar material">
        <a className="btn btn--plain" href={href({ page: 'decks' })}>
          <Icon name="chevronLeft" /> Decks
        </a>
        <div className="deck__title">
          <strong>{deck?.title ?? name}</strong>
          {deck && (
            <span className="muted">
              Folie {index + 1} von {deck.slides.length}
            </span>
          )}
        </div>
        <button className="btn btn--primary" disabled title="Präsentationsmodus kommt in Phase 1">
          <Icon name="play" size={12} /> Abspielen
        </button>
      </header>

      <nav className="deck__navigator material" aria-label="Folien">
        {deck?.slides.map((s, i) => (
          <a
            key={s.id}
            className={`nav-slide ${i === index ? 'is-active' : ''} ${s.skip ? 'is-skipped' : ''}`}
            href={href({ page: 'deck', name, slideId: s.id })}
            onClick={(e) => {
              e.preventDefault()
              navigate({ page: 'deck', name, slideId: s.id }, true)
            }}
            aria-current={i === index}
          >
            <span className="nav-slide__number">{i + 1}</span>
            <div className="nav-slide__thumb" style={{ aspectRatio: `${deck.format.width} / ${deck.format.height}` }}>
              <Stage format={deck.format}>
                <SlideView
                  slide={s}
                  deckName={name}
                  mode="thumb"
                  width={deck.format.width}
                  height={deck.format.height}
                />
              </Stage>
            </div>
          </a>
        ))}
      </nav>

      <main className="deck__canvas">
        {(live.status === 'invalid' || live.status === 'offline') && (
          <div className="deck__banner">
            <IssueList
              title={
                live.status === 'offline'
                  ? 'Keine Verbindung zum Dev-Server'
                  : deck
                    ? 'deck.json ist gerade ungültig – du siehst den letzten gültigen Stand'
                    : 'deck.json ist ungültig'
              }
              issues={live.issues}
            />
          </div>
        )}
        {brandIssues.length > 0 && (
          <div className="deck__banner">
            <IssueList title="brand/brand.json ist ungültig – Standardfarben aktiv" issues={brandIssues} />
          </div>
        )}
        {deck && slide && (
          <div className="deck__stage">
            <Stage format={deck.format}>
              <SlideView
                key={slide.id}
                slide={slide}
                deckName={name}
                mode="view"
                width={deck.format.width}
                height={deck.format.height}
              />
            </Stage>
          </div>
        )}
      </main>

      <aside className="deck__inspector material" aria-label="Inspector">
        {deck && slide && (
          <SlideInspector key={slide.id} deck={deck} slide={slide} onSave={save} saveIssues={saveIssues} />
        )}
      </aside>

      <Toast message="Aktualisiert" token={toast} />
    </div>
  )
}

const ELEMENT_LABEL: Record<Element['type'], string> = {
  text: 'Text',
  image: 'Bild',
  video: 'Video',
  shape: 'Form',
  icon: 'Icon',
  custom: 'Komponente',
}

const TRANSITION_LABEL: Record<string, string> = {
  none: 'Keiner',
  dissolve: 'Überblenden',
  blurDissolve: 'Blur-Überblenden',
  push: 'Schieben',
  zoom: 'Zoom',
  magicMove: 'Magic Move',
  camera: 'Kamerafahrt',
  maskReveal: 'Mask-Reveal',
  lightLeak: 'Light Leak',
  whipPan: 'Whip-Pan',
}

function SlideInspector({
  deck,
  slide,
  onSave,
  saveIssues,
}: {
  deck: Deck
  slide: Slide
  onSave: (deck: Deck) => Promise<void>
  saveIssues: Issue[]
}) {
  return (
    <div className="inspector">
      <section>
        <h3 className="section-title">Folie</h3>
        <dl className="props">
          <dt>ID</dt>
          <dd className="mono">{slide.id}</dd>
          <dt>Layout</dt>
          <dd>{slide.layout ?? '—'}</dd>
          <dt>Hintergrund</dt>
          <dd>{slide.background?.type ?? 'color'}</dd>
          <dt>Übergang</dt>
          <dd>{slide.transition ? TRANSITION_LABEL[slide.transition.type] : '—'}</dd>
          <dt>Effekte</dt>
          <dd>{slide.effects?.map((e) => e.type).join(', ') || '—'}</dd>
        </dl>
      </section>

      <section>
        <h3 className="section-title">
          <Icon name="stack" size={12} /> Elemente
        </h3>
        <ul className="layers">
          {[...slide.elements].reverse().map((el) => (
            <li key={el.id} className={el.hidden ? 'is-hidden' : ''}>
              <span className="layers__type">{ELEMENT_LABEL[el.type]}</span>
              <span className="layers__name">{el.name ?? el.id}</span>
              {el.match && <span className="layers__tag" title="Magic-Move-Partner">↔</span>}
              {el.build && <span className="layers__tag" title="Hat einen Build">◆</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="section-title">Notizen</h3>
        <NotesField deck={deck} slide={slide} onSave={onSave} />
        {saveIssues.length > 0 && <IssueList title="Speichern fehlgeschlagen" issues={saveIssues} />}
      </section>
    </div>
  )
}

/** Notizen werden direkt in die deck.json gespeichert – der erste Weg vom Editor in die Datei. */
function NotesField({ deck, slide, onSave }: { deck: Deck; slide: Slide; onSave: (deck: Deck) => Promise<void> }) {
  // Während des Tippens gilt der lokale Entwurf, sonst der Stand aus der Datei.
  const [draft, setDraft] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const commit = (text: string) => {
    clearTimeout(timer.current)
    if (text === (slide.notes ?? '')) return
    const slides = deck.slides.map((s) => (s.id === slide.id ? { ...s, notes: text || undefined } : s))
    void onSave({ ...deck, slides })
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <textarea
      className="field"
      rows={6}
      placeholder="Notizen für die Referentenansicht …"
      value={draft ?? slide.notes ?? ''}
      onFocus={() => setDraft(slide.notes ?? '')}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => commit(text), 600)
      }}
      onBlur={() => {
        if (draft !== null) commit(draft)
        setDraft(null)
      }}
    />
  )
}
