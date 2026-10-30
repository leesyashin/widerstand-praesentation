import { gsap } from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBrand, useLayouts, useTheme } from '../api/live'
import { Canvas } from '../editor/Canvas'
import { Inspector, type InspectorTab } from '../editor/Inspector'
import { LayoutPicker } from '../editor/LayoutPicker'
import { duplicateElement, duplicateSlide, newElement, slideFromLayout, type NewElementKind } from '../editor/model'
import { useEditor, type Editor } from '../editor/useEditor'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { ThemeScope } from '../engine/ThemeScope'
import { createSlideTimeline } from '../engine/timeline'
import type { Deck, Element } from '../schema/deck'
import type { Issue } from '../schema/issues'
import type { Layout } from '../schema/layout'
import { Icon, type IconName } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import { Toast } from '../ui/Toast'
import { href, navigate } from './route'
import './DeckView.css'
import '../editor/Editor.css'

export function DeckView({ name, slideId, brandIssues }: { name: string; slideId?: string; brandIssues: Issue[] }) {
  const editor = useEditor(name)
  const { live, doc } = editor

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
    <ThemeScope theme={doc?.theme}>
      <EditorShell name={name} slideId={slideId} editor={editor} brandIssues={brandIssues} />
    </ThemeScope>
  )
}

const INSERT: { kind: NewElementKind; icon: IconName; label: string }[] = [
  { kind: 'text', icon: 'text', label: 'Text' },
  { kind: 'rect', icon: 'shape', label: 'Form' },
  { kind: 'line', icon: 'line', label: 'Linie' },
  { kind: 'icon', icon: 'icon', label: 'Icon' },
  { kind: 'image', icon: 'image', label: 'Bild' },
]

function EditorShell({
  name,
  slideId,
  editor,
  brandIssues,
}: {
  name: string
  slideId?: string
  editor: Editor
  brandIssues: Issue[]
}) {
  const { live, doc: deck, edit } = editor
  const brand = useBrand()
  const layouts = useLayouts()
  const theme = useTheme(deck?.theme)
  const [selection, setSelection] = useState<{ slide: string; id: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [tab, setTab] = useState<InspectorTab>('folie')
  const [picker, setPicker] = useState(false)
  const clipboard = useRef<Element | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const index = deck ? Math.max(0, deck.slides.findIndex((s) => s.id === slideId)) : 0
  const slide = deck?.slides[index]
  const selected = selection && slide && selection.slide === slide.id ? selection.id : null
  const element = slide?.elements.find((e) => e.id === selected)

  const select = useCallback(
    (id: string | null) => {
      setSelection(id && slide ? { slide: slide.id, id } : null)
      if (id) setTab((t) => (t === 'folie' ? 'stil' : t))
    },
    [slide],
  )
  const goToSlide = useCallback((id: string | undefined) => navigate({ page: 'deck', name, slideId: id }, true), [name])

  /** Änderung an der aktuellen Folie. */
  const editSlide = useCallback(
    (recipe: (s: Deck['slides'][number]) => void, merge?: string) =>
      edit((d) => {
        const s = d.slides[index]
        if (s) recipe(s)
      }, merge),
    [edit, index],
  )

  const insert = (kind: NewElementKind) => {
    if (!deck || !slide) return
    const el = newElement(kind, slide, deck)
    editSlide((s) => void s.elements.push(el))
    setSelection({ slide: slide.id, id: el.id })
    setTab('stil')
    if (kind === 'text') setEditing(el.id)
  }

  const addSlide = (layout: Layout) => {
    if (!deck) return
    const s = slideFromLayout(layout, deck, theme.value)
    edit((d) => void d.slides.splice(index + 1, 0, s))
    setPicker(false)
    goToSlide(s.id)
  }

  const removeSlide = (i: number) => {
    if (!deck || deck.slides.length <= 1) return
    const neighbor = deck.slides[i + 1] ?? deck.slides[i - 1]
    edit((d) => void d.slides.splice(i, 1))
    if (i === index) goToSlide(neighbor?.id)
  }

  const copySlide = (i: number) => {
    const original = deck?.slides[i]
    if (!deck || !original) return
    const s = duplicateSlide(original, deck)
    edit((d) => void d.slides.splice(i + 1, 0, s))
    goToSlide(s.id)
  }

  const play = () => {
    void document.documentElement.requestFullscreen?.().catch(() => {})
    navigate({ page: 'present', name, slideId: slide?.id })
  }

  /** Spielt alle Builds der Folie auf der Arbeitsfläche ab und stellt danach den Endzustand wieder her. */
  const preview = () => {
    const root = canvasRef.current?.querySelector<HTMLElement>('.editor-stage .slide')
    if (!root || !slide) return
    select(null)
    const tl = createSlideTimeline(root, slide)
    tl.timeline.eventCallback('onComplete', () => {
      window.setTimeout(() => {
        tl.kill()
        gsap.set(root.querySelectorAll('.el-anim, .el-anim .w, .el-anim .ln, .el-anim svg *'), { clearProps: 'all' })
      }, 600)
    })
    tl.timeline.play(0)
  }

  // Tastenkürzel im Editor
  useEffect(() => {
    if (!deck || !slide) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]') || editing) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z') {
        if (e.shiftKey) editor.redo()
        else editor.undo()
      } else if (mod && key === 'y') editor.redo()
      else if (mod && e.altKey && key === 'p') play()
      else if (mod && key === 'd' && element) {
        const copy = duplicateElement(element, slide)
        editSlide((s) => void s.elements.push(copy))
        select(copy.id)
      } else if (mod && key === 'c' && element) clipboard.current = structuredClone(element)
      else if (mod && key === 'v' && clipboard.current) {
        const copy = duplicateElement(clipboard.current, slide)
        editSlide((s) => void s.elements.push(copy))
        select(copy.id)
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && element) {
        editSlide((s) => void (s.elements = s.elements.filter((x) => x.id !== element.id)))
        select(null)
      } else if (e.key === 'Enter' && element?.type === 'text') setEditing(element.id)
      else if (e.key === 'Escape') select(null)
      else if (e.key.startsWith('Arrow') && element) {
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        editSlide((s) => {
          const el = s.elements.find((x) => x.id === element.id)
          if (el) el.frame = { ...el.frame, x: el.frame.x + dx, y: el.frame.y + dy }
        }, `nudge-${element.id}`)
      } else if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) {
        goToSlide(deck.slides[Math.min(deck.slides.length - 1, index + 1)]?.id)
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
        goToSlide(deck.slides[Math.max(0, index - 1)]?.id)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const status = { saved: 'Gespeichert', saving: 'Speichert …', error: 'Nicht gespeichert' }[editor.status]
  const brandColors = brand.value?.colors ?? {}

  return (
    <div className="deck">
      <header className="deck__toolbar material">
        <div className="toolbar__group">
          <a className="btn btn--plain" href={href({ page: 'decks' })}>
            <Icon name="chevronLeft" /> Decks
          </a>
          <button className="btn btn--plain btn--icon" title="Rückgängig (⌘Z)" disabled={!editor.canUndo} onClick={editor.undo}>
            <Icon name="undo" />
          </button>
          <button className="btn btn--plain btn--icon" title="Wiederholen (⇧⌘Z)" disabled={!editor.canRedo} onClick={editor.redo}>
            <Icon name="redo" />
          </button>
        </div>
        <div className="deck__title">
          <strong>{deck?.title ?? name}</strong>
          {deck && (
            <span className="muted">
              Folie {index + 1} von {deck.slides.length}
            </span>
          )}
        </div>
        <div className="toolbar__group toolbar__group--end">
          <div className="toolbar__insert">
            {INSERT.map((t) => (
              <button key={t.kind} className="tool" title={`${t.label} einfügen`} onClick={() => insert(t.kind)} disabled={!slide}>
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <span className={`save-status save-status--${editor.status}`} title={editor.saveIssues.map((i) => i.message).join('\n')}>
            {status}
          </span>
          <button className="btn btn--primary" onClick={play} disabled={!slide} title="Abspielen (⌥⌘P)">
            <Icon name="play" size={12} /> Abspielen
          </button>
        </div>
      </header>

      <nav className="deck__navigator material" aria-label="Folien">
        {deck?.slides.map((s, i) => (
          <div key={s.id} className={`nav-slide ${i === index ? 'is-active' : ''} ${s.skip ? 'is-skipped' : ''}`}>
            <span className="nav-slide__number">{i + 1}</span>
            <a
              className="nav-slide__thumb"
              style={{ aspectRatio: `${deck.format.width} / ${deck.format.height}` }}
              href={href({ page: 'deck', name, slideId: s.id })}
              onClick={(e) => {
                e.preventDefault()
                goToSlide(s.id)
              }}
              aria-current={i === index}
            >
              <Stage format={deck.format}>
                <SlideView slide={s} deckName={name} mode="thumb" width={deck.format.width} height={deck.format.height} />
              </Stage>
            </a>
            <span className="nav-slide__actions">
              <button className="btn btn--icon btn--mini" title="Folie duplizieren" onClick={() => copySlide(i)}>
                <Icon name="copy" size={12} />
              </button>
              <button
                className="btn btn--icon btn--mini"
                title="Folie löschen"
                disabled={deck.slides.length <= 1}
                onClick={() => removeSlide(i)}
              >
                <Icon name="trash" size={12} />
              </button>
            </span>
          </div>
        ))}
        {deck && (
          <div className="nav-add">
            <button className="btn nav-add__btn" onClick={() => setPicker((p) => !p)}>
              <Icon name="plus" /> Neue Folie
            </button>
            {picker && (
              <LayoutPicker
                deck={deck}
                deckName={name}
                layouts={layouts.value ?? []}
                theme={theme.value}
                onPick={addSlide}
                onClose={() => setPicker(false)}
              />
            )}
          </div>
        )}
      </nav>

      <main className="deck__canvas" ref={canvasRef}>
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
            <Canvas
              deck={deck}
              deckName={name}
              slide={slide}
              selected={selected}
              onSelect={select}
              editing={editing}
              onEditText={setEditing}
              edit={edit}
            />
          </div>
        )}
      </main>

      <aside className="deck__inspector material" aria-label="Inspector">
        {deck && slide && (
          <Inspector
            deck={deck}
            slide={slide}
            element={element}
            tab={tab}
            onTab={setTab}
            edit={edit}
            brand={brandColors}
            onPreview={preview}
            saveIssues={editor.saveIssues}
          />
        )}
      </aside>

      <Toast message="Von außen aktualisiert" token={editor.externalUpdates} />
    </div>
  )
}
