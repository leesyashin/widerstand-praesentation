import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import { useDeckTemplates, useLayouts, useThemes } from '../api/live'
import { slideFromLayout, uniqueId } from '../editor/model'
import { resolveSlide } from '../engine/masters'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { ThemeScope } from '../engine/ThemeScope'
import type { Deck } from '../schema/deck'
import type { Issue } from '../schema/issues'
import { Icon } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import { navigate } from './route'

/** "Präsentation für Müller & Söhne" → "praesentation-fuer-mueller-soehne" */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'deck'
  )
}

type Choice = { kind: 'leer'; theme: string } | { kind: 'vorlage'; name: string }

/** Neues Deck: leer (mit Theme) oder aus einer kompletten Vorlage. */
export function NewDeckDialog({ existing, onClose }: { existing: string[]; onClose: () => void }) {
  const templates = useDeckTemplates()
  const themes = useThemes()
  const layouts = useLayouts()
  const [title, setTitle] = useState('')
  const [choice, setChoice] = useState<Choice>({ kind: 'leer', theme: 'silber' })
  const [issues, setIssues] = useState<Issue[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Leeres Deck: eine Titelfolie aus dem Layout „titel“ im gewählten Theme. */
  const blank = useMemo((): Deck | null => {
    const theme = themes.value?.find((t) => t.name === (choice.kind === 'leer' ? choice.theme : 'silber')) ?? null
    const layout = layouts.value?.find((l) => l.name === 'titel')
    if (!layout) return null
    const base: Deck = {
      $schema: '../../src/schema/deck.schema.json',
      version: 1,
      title: 'Neues Deck',
      format: { preset: '16:9', width: 1920, height: 1080 },
      theme: theme?.name ?? 'silber',
      intensity: 0.3,
      slides: [],
    }
    const slide = slideFromLayout(layout, base, theme)
    return { ...base, slides: [{ ...slide, id: 'titel' }] }
  }, [themes.value, layouts.value, choice])

  const source = choice.kind === 'leer' ? blank : (templates.value?.find((t) => t.name === choice.name)?.deck ?? null)
  const name = uniqueId(slugify(title || (choice.kind === 'vorlage' ? choice.name : 'neues-deck')), existing)

  const create = async () => {
    if (!source) return
    setBusy(true)
    const deck: Deck = structuredClone(source)
    deck.title = title.trim() || (choice.kind === 'vorlage' ? source.title : 'Neues Deck')
    if (choice.kind === 'leer') delete deck.description
    const r = await api.createDeck(name, deck)
    setBusy(false)
    if (!r.ok) return setIssues(r.issues)
    onClose()
    navigate({ page: 'deck', name: r.value })
  }

  return createPortal(
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog--wide material" role="dialog" aria-label="Neues Deck">
        <div className="dialog__head">
          <h2>Neues Deck</h2>
          <button type="button" className="btn btn--plain btn--icon" title="Schließen" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <label className="new-deck__title">
          <span className="muted">Titel</span>
          <input
            className="field"
            autoFocus
            value={title}
            placeholder={choice.kind === 'vorlage' ? source?.title : 'Neues Deck'}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <span className="muted mono new-deck__path">decks/{name}/</span>
        </label>

        <h3 className="section-title">Leer, mit Theme</h3>
        <div className="new-deck__grid">
          {(themes.value ?? []).map((t) => {
            const on = choice.kind === 'leer' && choice.theme === t.name
            return (
              <button key={t.name} type="button" className={`new-deck__option ${on ? 'is-on' : ''}`} onClick={() => setChoice({ kind: 'leer', theme: t.name })}>
                <span className="new-deck__thumb">
                  {blank && layouts.value && (
                    <ThemeScope theme={t.name}>
                      <Stage format={blank.format}>
                        <SlideView
                          slide={slideFromLayout(layouts.value.find((l) => l.name === 'titel')!, blank, t)}
                          deckName="_neu"
                          mode="thumb"
                          width={blank.format.width}
                          height={blank.format.height}
                        />
                      </Stage>
                    </ThemeScope>
                  )}
                </span>
                <strong>{t.label}</strong>
                <span className="muted">{t.description}</span>
              </button>
            )
          })}
        </div>

        <h3 className="section-title">Aus einer Vorlage</h3>
        <div className="new-deck__grid">
          {(templates.value ?? []).map((t) => {
            const on = choice.kind === 'vorlage' && choice.name === t.name
            const first = t.deck.slides[0]
            return (
              <button key={t.name} type="button" className={`new-deck__option ${on ? 'is-on' : ''}`} onClick={() => setChoice({ kind: 'vorlage', name: t.name })}>
                <span className="new-deck__thumb">
                  {first && (
                    <ThemeScope theme={t.deck.theme} intensity={t.deck.intensity} textStyles={t.deck.textStyles}>
                      <Stage format={t.deck.format}>
                        <SlideView slide={resolveSlide(t.deck, first)} deckName="_neu" mode="thumb" width={t.deck.format.width} height={t.deck.format.height} />
                      </Stage>
                    </ThemeScope>
                  )}
                </span>
                <strong>
                  {t.deck.title} <span className="muted">· {t.deck.slides.length} Folien</span>
                </strong>
                <span className="muted">{t.deck.description}</span>
              </button>
            )
          })}
        </div>

        {issues.length > 0 && <IssueList title="Deck konnte nicht angelegt werden" issues={issues} />}
        <div className="dialog__actions">
          <button type="button" className="btn btn--plain" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn--primary" disabled={!source || busy} onClick={() => void create()}>
            {busy ? 'Legt an …' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
