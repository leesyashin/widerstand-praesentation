import { gsap } from 'gsap'
import type { Draft } from 'immer'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { assetUrl } from '../api/client'
import { useBlocks, useLayouts, useTheme, useThemes } from '../api/live'
import { BlockPicker } from '../editor/BlockPicker'
import { ASSET_MIME, Canvas } from '../editor/Canvas'
import { FontsDialog } from '../editor/FontsDialog'
import { Inspector, type InspectorTab } from '../editor/Inspector'
import { Layers } from '../editor/Layers'
import { LayoutPicker } from '../editor/LayoutPicker'
import { MediaLibrary } from '../editor/MediaLibrary'
import { importFile, measureMedia, type Imported } from '../editor/media'
import { MiniToolbar } from '../editor/MiniToolbar'
import {
  alignElements,
  arrange,
  distributeElements,
  duplicateElement,
  duplicateSlide,
  elementsFromBlock,
  groupElements,
  mediaElement,
  moveSlide,
  newElement,
  newMaster,
  pageOf,
  slideFromBlock,
  slideFromLayout,
  uniqueId,
  ungroupElements,
  type AlignKind,
  type NewElementKind,
  type Page,
  type PageRef,
} from '../editor/model'
import { Overview, SLIDE_MIME, slideTitle } from '../editor/Overview'
import { SpaceView } from '../editor/SpaceView'
import { useEditor, type Editor } from '../editor/useEditor'
import { usePalette } from '../engine/context'
import { masterAsSlide, resolveDeck, resolveSlide } from '../engine/masters'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { ThemeScope } from '../engine/ThemeScope'
import { createSlideTimeline } from '../engine/timeline'
import { openPresenter } from '../present/Present'
import type { Block } from '../schema/block'
import type { Deck, Element } from '../schema/deck'
import type { Issue } from '../schema/issues'
import type { Layout } from '../schema/layout'
import { Icon, type IconName } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import { Toast } from '../ui/Toast'
import { ShareMenu } from './ShareMenu'
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
    <ThemeScope theme={doc?.theme} intensity={doc?.intensity} textStyles={doc?.textStyles}>
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
  { kind: 'chart', icon: 'chart', label: 'Chart' },
]

type Mode = 'edit' | 'overview' | 'space'

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
  const palette = usePalette()
  const layouts = useLayouts()
  const blocks = useBlocks()
  const themes = useThemes()
  const theme = useTheme(deck?.theme)
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] })
  const [editing, setEditing] = useState<string | null>(null)
  const [tab, setTab] = useState<InspectorTab>('folie')
  const [picker, setPicker] = useState(false)
  const [mode, setMode] = useState<Mode>('edit')
  const [masterId, setMasterId] = useState<string | null>(null)
  const [media, setMedia] = useState(false)
  const [blockPicker, setBlockPicker] = useState(false)
  const [fonts, setFonts] = useState(false)
  const [layersOpen, setLayersOpen] = useState(true)
  const [notice, setNotice] = useState({ text: '', token: 0 })
  const [navDrop, setNavDrop] = useState<{ index: number; before: boolean } | null>(null)
  const clipboard = useRef<Element[]>([])
  const canvasRef = useRef<HTMLDivElement>(null)

  const say = useCallback((text: string) => setNotice((n) => ({ text, token: n.token + 1 })), [])
  // Änderung von außen (Claude, Texteditor) → kurzer Hinweis; abgeleiteter Zustand während des Renderns.
  const [seenExternal, setSeenExternal] = useState(editor.externalUpdates)
  if (editor.externalUpdates !== seenExternal) {
    setSeenExternal(editor.externalUpdates)
    setNotice((n) => ({ text: 'Von außen aktualisiert', token: n.token + 1 }))
  }

  const index = deck ? Math.max(0, deck.slides.findIndex((s) => s.id === slideId)) : 0
  const slide = deck?.slides[index]
  const masterIndex = deck && masterId ? (deck.masters ?? []).findIndex((m) => m.id === masterId) : -1
  const master = masterIndex >= 0 ? deck?.masters?.[masterIndex] : undefined
  const ref: PageRef = master ? { kind: 'master', index: masterIndex } : { kind: 'slide', index }
  const page: Page | undefined = master ?? slide
  const pageKey = master ? `master:${master.id}` : `slide:${slide?.id ?? ''}`
  const view = useMemo(() => (master ? masterAsSlide(master) : deck && slide ? resolveSlide(deck, slide) : undefined), [master, deck, slide])
  const resolved = useMemo(() => deck && resolveDeck(deck), [deck])

  const selectedIds = selection.key === pageKey ? selection.ids.filter((id) => page?.elements.some((e) => e.id === id)) : []
  const selectedEls = page?.elements.filter((e) => selectedIds.includes(e.id)) ?? []

  const select = useCallback(
    (ids: string[]) => {
      setSelection({ key: pageKey, ids })
      if (ids.length) setTab((t) => (t === 'folie' ? 'stil' : t))
    },
    [pageKey],
  )
  const goToSlide = useCallback(
    (id: string | undefined) => {
      setMasterId(null)
      navigate({ page: 'deck', name, slideId: id }, true)
    },
    [name],
  )

  /** Änderung an der bearbeiteten Seite (Folie oder Master). */
  const editPage = useCallback(
    (recipe: (p: Draft<Page>) => void, merge?: string) =>
      edit((d) => {
        const p = pageOf(d, ref)
        if (p) recipe(p as Draft<Page>)
      }, merge),
    // ref ist ein neues Objekt pro Render – Inhalt ist entscheidend
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edit, ref.kind, ref.index],
  )

  const insert = (kind: NewElementKind) => {
    if (!deck || !page) return
    const el = newElement(kind, page as Deck['slides'][number], deck)
    editPage((p) => void p.elements.push(el))
    setSelection({ key: pageKey, ids: [el.id] })
    setTab('stil')
    if (kind === 'text') setEditing(el.id)
  }

  const insertMedia = async (m: Imported, point?: { x: number; y: number }) => {
    if (!deck || !page) return
    let sized = m
    if (!m.width && m.kind !== 'lottie') {
      const size = await measureMedia(assetUrl(name, m.path), m.kind)
      if (size) sized = { ...m, ...size }
    }
    const el = mediaElement(sized, page, deck, point)
    editPage((p) => void p.elements.push(el))
    setSelection({ key: pageKey, ids: [el.id] })
    setTab('stil')
  }

  const replaceMedia = (m: Imported) => {
    const target = selectedEls[0]
    if (!target) return
    editPage((p) => {
      const t = p.elements.find((e) => e.id === target.id)
      if (t && (t.type === 'image' || t.type === 'video' || t.type === 'lottie') && t.type === (m.kind === 'lottie' ? 'lottie' : m.kind)) {
        t.src = m.path
        if (t.type === 'video') {
          if (m.poster) t.poster = m.poster
          else delete t.poster
        }
      }
    })
  }

  /** Dateien oder Bibliotheks-Medien auf der Folie abgelegt. */
  const onDrop = async (data: DataTransfer, point: { x: number; y: number }) => {
    const asset = data.getData(ASSET_MIME)
    if (asset) return void insertMedia(JSON.parse(asset) as Imported, point)
    const files = [...data.files]
    for (const [i, file] of files.entries()) {
      try {
        say(`${file.name} wird importiert …`)
        const m = await importFile(name, file)
        await insertMedia(m, { x: point.x + i * 40, y: point.y + i * 40 })
        say(m.note ? `${m.path} · ${m.note}` : `${m.path} importiert`)
      } catch (err) {
        say((err as Error).message)
      }
    }
  }

  /** Baustein einfügen: als neue Folie hinter der aktuellen oder als Gruppe auf der aktuellen Seite. */
  const insertBlock = (block: Block) => {
    if (!deck || !page) return
    setBlockPicker(false)
    if (block.kind === 'slide' && !master) {
      const s = slideFromBlock(block, deck, theme.value)
      edit((d) => void d.slides.splice(index + 1, 0, s))
      goToSlide(s.id)
      say(`Baustein „${block.label}“ als neue Folie eingefügt`)
      return
    }
    const els = elementsFromBlock(block, page, deck)
    // Auf Master-Folien gibt es keine Builds.
    if (master) for (const el of els) delete el.build
    editPage((p) => void p.elements.push(...els))
    setSelection({ key: pageKey, ids: els.map((e) => e.id) })
    setTab(master ? 'stil' : 'animation')
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

  /* ---------- Master ---------- */

  const createMaster = (fromSlide: boolean) => {
    if (!deck) return
    const moving = fromSlide ? selectedEls : []
    const m = newMaster(deck, theme.value, fromSlide ? slide : undefined, moving)
    edit((d) => {
      d.masters ??= []
      d.masters.push(m)
      const s = d.slides[index]
      if (fromSlide && s) {
        s.master = m.id
        delete s.background
        delete s.effects
        s.elements = s.elements.filter((e) => !moving.some((x) => x.id === e.id))
      }
    })
    if (fromSlide) say(`„${m.name}“ angelegt${moving.length ? ` – ${moving.length} Element${moving.length === 1 ? '' : 'e'} verschoben` : ''}`)
    else setMasterId(m.id)
  }

  const removeMaster = (id: string) => {
    edit((d) => {
      d.masters = d.masters?.filter((m) => m.id !== id)
      if (!d.masters?.length) delete d.masters
      for (const s of d.slides) if (s.master === id) delete s.master
    })
    if (masterId === id) setMasterId(null)
  }

  const copyMaster = (id: string) => {
    const m = deck?.masters?.find((x) => x.id === id)
    if (!deck || !m) return
    const copy = { ...structuredClone(m), id: uniqueId(m.id, deck.masters?.map((x) => x.id) ?? []), name: `${m.name ?? m.id} Kopie` }
    edit((d) => void d.masters?.push(copy))
    setMasterId(copy.id)
  }

  /* ---------- Auswahl-Aktionen ---------- */

  const duplicateSelection = () => {
    if (!page || !selectedEls.length) return
    const working = { ...page, elements: [...page.elements] }
    const copies = selectedEls.map((el) => {
      const c = duplicateElement(el, working as Deck['slides'][number])
      working.elements.push(c)
      return c
    })
    const groups = new Map<string, string>()
    for (const c of copies) {
      if (!c.group) continue
      if (!groups.has(c.group)) groups.set(c.group, uniqueId(c.group, page.elements.flatMap((e) => (e.group ? [e.group] : []))))
      c.group = groups.get(c.group)
    }
    editPage((p) => void p.elements.push(...copies))
    select(copies.map((c) => c.id))
  }
  const deleteSelection = () => {
    if (!selectedIds.length) return
    editPage((p) => void (p.elements = p.elements.filter((x) => !selectedIds.includes(x.id) || x.locked)))
    select([])
  }
  const alignSelection = (kind: AlignKind | 'distributeX' | 'distributeY') => {
    if (!deck) return
    editPage((p) => {
      if (kind === 'distributeX') distributeElements(p, selectedIds, 'x')
      else if (kind === 'distributeY') distributeElements(p, selectedIds, 'y')
      else alignElements(p, selectedIds, kind, deck.format.width, deck.format.height)
    })
  }
  const groupSelection = () => {
    if (selectedIds.length < 2) return
    editPage((p) => void groupElements(p, selectedIds))
  }
  const ungroupSelection = () => editPage((p) => ungroupElements(p, selectedIds))

  const play = () => {
    void document.documentElement.requestFullscreen?.().catch(() => {})
    navigate({ page: 'present', name, slideId: slide?.id })
  }

  /** Spielt die Builds der Folie (optional ab einem Klick) auf der Arbeitsfläche ab und stellt danach den Endzustand her. */
  const preview = (fromStep = 0) => {
    const root = canvasRef.current?.querySelector<HTMLElement>('.editor-stage .slide')
    if (!root || !view || master) return
    select([])
    const tl = createSlideTimeline(root, view)
    const start = tl.starts[fromStep] ?? 0
    tl.timeline.seek(start, false)
    tl.timeline.eventCallback('onComplete', () => {
      window.setTimeout(() => {
        tl.kill()
        gsap.set(root.querySelectorAll('.el-anim, .el-anim .w, .el-anim .ln, .el-anim svg *'), { clearProps: 'all' })
      }, 600)
    })
    tl.timeline.play(start)
  }

  // Tastenkürzel im Editor
  useEffect(() => {
    if (!deck || !page) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]') || editing) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const has = selectedEls.length > 0

      if (mod && key === 'z') {
        if (e.shiftKey) editor.redo()
        else editor.undo()
      } else if (mod && key === 'y') editor.redo()
      else if (mod && e.altKey && key === 'p') play()
      else if (mod && e.altKey && e.code === 'KeyG') {
        if (e.shiftKey) ungroupSelection()
        else groupSelection()
      } else if (mod && key === 'a') select(page.elements.filter((x) => !x.locked && !x.hidden).map((x) => x.id))
      else if (mod && key === 'd' && has) duplicateSelection()
      else if (mod && (key === 'c' || key === 'x') && has) {
        clipboard.current = structuredClone(selectedEls)
        if (key === 'x') deleteSelection()
      } else if (mod && key === 'v' && clipboard.current.length) {
        const working = { ...page, elements: [...page.elements] }
        const copies = clipboard.current.map((el) => {
          const c = duplicateElement(el, working as Deck['slides'][number])
          working.elements.push(c)
          return c
        })
        editPage((p) => void p.elements.push(...structuredClone(copies)))
        select(copies.map((c) => c.id))
      } else if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft') && has) {
        const front = e.code === 'BracketRight'
        editPage((p) => arrange(p, selectedIds, e.shiftKey ? (front ? 'front' : 'back') : front ? 'forward' : 'backward'))
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && has) deleteSelection()
      else if (e.key === 'Enter' && selectedEls.length === 1 && selectedEls[0]?.type === 'text') setEditing(selectedEls[0].id)
      else if (e.key === 'Escape') {
        if (mode !== 'edit') setMode('edit')
        else if (has) select([])
        else if (master) setMasterId(null)
        else return
      } else if (e.key.startsWith('Arrow') && has) {
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        editPage((p) => {
          for (const el of p.elements) {
            if (selectedIds.includes(el.id) && !el.locked) el.frame = { ...el.frame, x: el.frame.x + dx, y: el.frame.y + dy }
          }
        }, `nudge-${selectedIds.join(',')}`)
      } else if (!master && ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) {
        goToSlide(deck.slides[Math.min(deck.slides.length - 1, index + 1)]?.id)
      } else if (!master && ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
        goToSlide(deck.slides[Math.max(0, index - 1)]?.id)
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------- Navigator: Folien per Drag & Drop umsortieren ---------- */

  const onNavDragOver = (e: ReactDragEvent, i: number) => {
    if (![...e.dataTransfer.types].includes(SLIDE_MIME)) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    setNavDrop({ index: i, before: e.clientY < r.top + r.height / 2 })
  }
  const onNavDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    const from = Number(e.dataTransfer.getData(SLIDE_MIME))
    const target = navDrop
    setNavDrop(null)
    if (!target || !Number.isInteger(from)) return
    let to = target.before ? target.index : target.index + 1
    if (from < to) to -= 1
    if (to !== from) edit((d) => moveSlide(d, from, to))
  }

  const status = { saved: 'Gespeichert', saving: 'Speichert …', error: 'Nicht gespeichert' }[editor.status]
  // Farbfelder zeigen die Palette des Themes (Brand-Kit, ggf. vom Theme umgestellt).
  const brandColors = palette
  const slideMaster = !master && slide?.master ? deck?.masters?.find((m) => m.id === slide.master) : undefined

  return (
    <div className={`deck ${master ? 'is-master-mode' : ''}`}>
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
              {master ? `Master „${master.name ?? master.id}“` : `Folie ${index + 1} von ${deck.slides.length}`}
            </span>
          )}
        </div>
        <div className="toolbar__group toolbar__group--end">
          <div className="toolbar__insert">
            {INSERT.map((t) => (
              <button key={t.kind} className="tool" title={`${t.label} einfügen`} onClick={() => insert(t.kind)} disabled={!page || mode !== 'edit'}>
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
            <button className={`tool block-toggle ${blockPicker ? 'is-on' : ''}`} title="Animierten Baustein einfügen" onClick={() => setBlockPicker((b) => !b)} disabled={!page || mode !== 'edit'}>
              <Icon name="sparkle" />
              <span>Baustein</span>
            </button>
            <button className={`tool media-toggle ${media ? 'is-on' : ''}`} title="Medien-Bibliothek" onClick={() => setMedia((m) => !m)} disabled={!page}>
              <Icon name="folder" />
              <span>Medien</span>
            </button>
          </div>
          <span className="toolbar__sep" />
          <div className="toolbar__insert">
            <button
              className={`tool ${mode === 'overview' ? 'is-on' : ''}`}
              title="Folienübersicht: umsortieren, duplizieren, überspringen"
              onClick={() => setMode((m) => (m === 'overview' ? 'edit' : 'overview'))}
              disabled={!deck}
            >
              <Icon name="grid" />
              <span>Übersicht</span>
            </button>
            <button
              className={`tool ${mode === 'space' ? 'is-on' : ''}`}
              title="Raum-Ansicht: Folien für Kamerafahrten anordnen"
              onClick={() => setMode((m) => (m === 'space' ? 'edit' : 'space'))}
              disabled={!deck}
            >
              <Icon name="space" />
              <span>Raum</span>
            </button>
            <button
              className={`tool ${master ? 'is-on' : ''}`}
              title="Master-Folien bearbeiten"
              onClick={() => {
                if (master) setMasterId(null)
                else if (deck?.masters?.length) setMasterId(slideMaster?.id ?? deck.masters[0]!.id)
                else createMaster(false)
                setMode('edit')
              }}
              disabled={!deck}
            >
              <Icon name="master" />
              <span>Master</span>
            </button>
          </div>
          <span className={`save-status save-status--${editor.status}`} title={editor.saveIssues.map((i) => i.message).join('\n')}>
            {status}
          </span>
          <ShareMenu name={name} disabled={!deck} />
          <button className="btn" onClick={() => openPresenter(name, slide?.id)} disabled={!slide} title="Referentenansicht in neuem Fenster: Notizen, Timer, Probe-Modus, Handy-Fernbedienung">
            Referentenansicht
          </button>
          <button className="btn btn--primary" onClick={play} disabled={!slide} title="Abspielen (⌥⌘P)">
            <Icon name="play" size={12} /> Abspielen
          </button>
        </div>
      </header>

      <nav className="deck__navigator material" aria-label={master ? 'Master-Folien' : 'Folien'}>
        <div className="nav-slides" onDrop={onNavDrop} onDragLeave={() => setNavDrop(null)}>
          {master && deck ? (
            <>
              <button className="btn nav-back" onClick={() => setMasterId(null)}>
                <Icon name="chevronLeft" size={14} /> Zurück zu den Folien
              </button>
              {(deck.masters ?? []).map((m) => {
                const users = deck.slides.filter((s) => s.master === m.id).length
                return (
                  <div key={m.id} className={`nav-slide nav-slide--master ${m.id === master.id ? 'is-active' : ''}`}>
                    <span className="nav-slide__number">
                      <Icon name="master" size={12} />
                    </span>
                    <button
                      className="nav-slide__thumb"
                      style={{ aspectRatio: `${deck.format.width} / ${deck.format.height}` }}
                      onClick={() => setMasterId(m.id)}
                      title={`${m.name ?? m.id} · ${users} Folie${users === 1 ? '' : 'n'}`}
                    >
                      <Stage format={deck.format}>
                        <SlideView slide={masterAsSlide(m)} deckName={name} mode="thumb" width={deck.format.width} height={deck.format.height} />
                      </Stage>
                    </button>
                    <span className="nav-slide__label">
                      {m.name ?? m.id} · {users}
                    </span>
                    <span className="nav-slide__actions">
                      <button className="btn btn--icon btn--mini" title="Master duplizieren" onClick={() => copyMaster(m.id)}>
                        <Icon name="copy" size={12} />
                      </button>
                      <button
                        className="btn btn--icon btn--mini"
                        title={users ? `Löschen – ${users} Folie${users === 1 ? '' : 'n'} verlieren den Master` : 'Master löschen'}
                        onClick={() => removeMaster(m.id)}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </span>
                  </div>
                )
              })}
              <div className="nav-add">
                <button className="btn nav-add__btn" onClick={() => createMaster(false)}>
                  <Icon name="plus" /> Neuer Master
                </button>
              </div>
            </>
          ) : (
            resolved?.slides.map((s, i) => (
              <div
                key={s.id}
                className={`nav-slide ${i === index ? 'is-active' : ''} ${s.skip ? 'is-skipped' : ''} ${
                  navDrop?.index === i ? (navDrop.before ? 'drop-above' : 'drop-below') : ''
                }`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(SLIDE_MIME, String(i))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => onNavDragOver(e, i)}
              >
                <span className="nav-slide__number">{i + 1}</span>
                <a
                  className="nav-slide__thumb"
                  style={{ aspectRatio: `${resolved.format.width} / ${resolved.format.height}` }}
                  href={href({ page: 'deck', name, slideId: s.id })}
                  title={slideTitle(s)}
                  draggable={false}
                  onClick={(e) => {
                    e.preventDefault()
                    goToSlide(s.id)
                  }}
                  aria-current={i === index}
                >
                  <Stage format={resolved.format}>
                    <SlideView slide={s} deckName={name} mode="thumb" width={resolved.format.width} height={resolved.format.height} />
                  </Stage>
                </a>
                <span className="nav-slide__actions">
                  <button className="btn btn--icon btn--mini" title="Folie duplizieren" onClick={() => copySlide(i)}>
                    <Icon name="copy" size={12} />
                  </button>
                  <button
                    className="btn btn--icon btn--mini"
                    title="Folie löschen"
                    disabled={resolved.slides.length <= 1}
                    onClick={() => removeSlide(i)}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </span>
              </div>
            ))
          )}
          {deck && !master && (
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
        </div>
        {page && (
          <section className={`nav-layers ${layersOpen ? 'is-open' : ''}`}>
            <button className="nav-layers__head" onClick={() => setLayersOpen((o) => !o)}>
              <Icon name={layersOpen ? 'chevronDown' : 'chevronRight'} size={12} />
              <span>Ebenen</span>
              <span className="muted">{page.elements.length}</span>
            </button>
            {layersOpen && (
              <Layers
                page={page}
                master={slideMaster ? { name: slideMaster.name ?? slideMaster.id, count: slideMaster.elements.length } : null}
                selected={selectedIds}
                onSelect={select}
                editPage={editPage}
              />
            )}
          </section>
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
        {master && (
          <div className="master-banner">
            <Icon name="master" size={14} />
            <span>
              Du bearbeitest den Master <strong>{master.name ?? master.id}</strong> – Änderungen wirken auf{' '}
              {deck?.slides.filter((s) => s.master === master.id).length ?? 0} Folien.
            </span>
            <button className="btn" onClick={() => setMasterId(null)}>
              Fertig
            </button>
          </div>
        )}
        {resolved && mode === 'space' && (
          <SpaceView deck={resolved} deckName={name} current={index} edit={edit} onSelect={(id) => goToSlide(id)} onClose={() => setMode('edit')} />
        )}
        {deck && mode === 'overview' && (
          <Overview
            deck={deck}
            deckName={name}
            current={index}
            edit={edit}
            onSelect={(id) => goToSlide(id)}
            onOpen={(id) => {
              goToSlide(id)
              setMode('edit')
            }}
            onClose={() => setMode('edit')}
          />
        )}
        {deck && page && view && (
          <div className="deck__stage">
            <Canvas
              deck={deck}
              deckName={name}
              view={view}
              page={page}
              selected={selectedIds}
              onSelect={select}
              editing={editing}
              onEditText={setEditing}
              editPage={editPage}
              onDrop={(data, point) => void onDrop(data, point)}
              toolbar={
                selectedEls.length > 0 && (
                  <MiniToolbar
                    elements={selectedEls}
                    brand={brandColors}
                    editEach={(recipe, merge) =>
                      editPage((p) => {
                        let i = 0
                        for (const el of p.elements) if (selectedIds.includes(el.id)) recipe(el, i++)
                      }, merge)
                    }
                    onAlign={alignSelection}
                    onGroup={groupSelection}
                    onUngroup={ungroupSelection}
                    onDuplicate={duplicateSelection}
                    onDelete={deleteSelection}
                  />
                )
              }
            />
          </div>
        )}
        {blockPicker && deck && (
          <BlockPicker deck={deck} deckName={name} blocks={blocks.value ?? []} theme={theme.value} onPick={insertBlock} onClose={() => setBlockPicker(false)} />
        )}
        {media && deck && (
          <MediaLibrary
            deck={deck}
            deckName={name}
            element={selectedEls.length === 1 ? selectedEls[0] : undefined}
            onInsert={(m) => void insertMedia(m)}
            onReplace={replaceMedia}
            onClose={() => setMedia(false)}
          />
        )}
      </main>

      <aside className="deck__inspector material" aria-label="Inspector">
        {deck && page && (
          <Inspector
            deck={deck}
            page={page}
            isMaster={Boolean(master)}
            elements={selectedEls}
            tab={tab}
            onTab={setTab}
            edit={edit}
            editPage={editPage}
            brand={brandColors}
            onPreview={preview}
            onSelect={select}
            onAlign={alignSelection}
            onGroup={groupSelection}
            onUngroup={ungroupSelection}
            onEditMaster={(id) => setMasterId(id)}
            onNewMaster={() => createMaster(true)}
            onOpenFonts={() => setFonts(true)}
            themes={themes.value ?? []}
            layouts={layouts.value ?? []}
            saveIssues={editor.saveIssues}
          />
        )}
      </aside>

      {fonts && <FontsDialog onClose={() => setFonts(false)} />}
      <Toast message={notice.text} token={notice.token} />
    </div>
  )
}
