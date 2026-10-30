import { useState } from 'react'
import { clearConfig, CLOUD } from '../api/cloud/config'
import { syncWorkerConfig } from '../api/cloud/worker'
import type { DeckSummary } from '../api/client'
import { useDeck, useDeckList } from '../api/live'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { resolveSlide } from '../engine/masters'
import { ThemeScope } from '../engine/ThemeScope'
import type { Issue } from '../schema/issues'
import { Icon } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import { NewDeckDialog } from './NewDeck'
import { href } from './route'
import './DeckList.css'

async function signOut() {
  if (!confirm('Auf diesem Gerät abmelden? Deine Decks bleiben im Repo.')) return
  clearConfig()
  await syncWorkerConfig(null)
  location.reload()
}

export function DeckList({ brandIssues }: { brandIssues: Issue[] }) {
  const list = useDeckList()
  const decks = list.value ?? []
  const [creating, setCreating] = useState(false)

  return (
    <main className="decks">
      <header className="decks__header">
        <div>
          <h1>Studio</h1>
          <p className="muted">Deine Präsentationen</p>
        </div>
        <div className="decks__actions">
          {CLOUD && (
            <button type="button" className="btn btn--plain" onClick={() => void signOut()} title="Zugangsschlüssel von diesem Gerät entfernen">
              Abmelden
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={() => setCreating(true)} disabled={list.status === 'offline'}>
            <Icon name="plus" size={14} /> Neues Deck
          </button>
        </div>
      </header>
      {creating && <NewDeckDialog existing={decks.map((d) => d.name)} onClose={() => setCreating(false)} />}

      {brandIssues.length > 0 && <IssueList title="brand/brand.json ist ungültig" issues={brandIssues} />}
      {list.status === 'offline' && (
        <IssueList title={CLOUD ? 'Keine Verbindung zu GitHub' : 'Keine Verbindung zum Dev-Server'} issues={list.issues} />
      )}
      {CLOUD && list.status === 'invalid' && <IssueList title="GitHub" issues={list.issues} />}

      {list.status !== 'loading' && decks.length === 0 && list.status !== 'offline' && (
        <div className="decks__empty">
          <Icon name="sparkle" size={28} />
          <h2>Noch keine Präsentationen</h2>
          <p className="muted">
            Leg oben ein neues Deck an – leer oder aus einer Vorlage – oder bitte Claude zum Beispiel:{' '}
            <em>„Bau mir ein Deck über mein Portfolio.“</em>
            <br />
            Neue Decks entstehen in <code className="mono">studio/decks/&lt;name&gt;/deck.json</code>.
          </p>
        </div>
      )}

      <div className="decks__grid">
        {decks.map((d) => (
          <DeckCard key={d.name} summary={d} />
        ))}
      </div>
    </main>
  )
}

function DeckCard({ summary }: { summary: DeckSummary }) {
  const deck = useDeck(summary.name)
  const first = deck.value?.slides[0] && resolveSlide(deck.value, deck.value.slides[0])
  const invalid = summary.issues.length > 0

  return (
    <a className="deck-card" href={href({ page: 'deck', name: summary.name })}>
      <div className="deck-card__thumb">
        {deck.value && first ? (
          <ThemeScope theme={deck.value.theme} intensity={deck.value.intensity} textStyles={deck.value.textStyles}>
            <Stage format={deck.value.format}>
              <SlideView
                slide={first}
                deckName={summary.name}
                mode="thumb"
                width={deck.value.format.width}
                height={deck.value.format.height}
              />
            </Stage>
          </ThemeScope>
        ) : (
          <div className="deck-card__blank" />
        )}
        {invalid && (
          <span className="deck-card__badge" title={summary.issues.map((i) => `${i.path}: ${i.message}`).join('\n')}>
            <Icon name="warning" size={12} /> Prüfen
          </span>
        )}
      </div>
      <div className="deck-card__meta">
        <strong>{deck.value?.title ?? summary.title}</strong>
        <span className="muted">
          {invalid
            ? `${summary.issues.length} Problem${summary.issues.length === 1 ? '' : 'e'}`
            : `${summary.slideCount} Folien · ${summary.format?.preset}`}
        </span>
      </div>
    </a>
  )
}
