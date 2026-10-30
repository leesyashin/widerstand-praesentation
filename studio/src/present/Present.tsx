import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useDeck } from '../api/live'
import { href, navigate } from '../app/route'
import { useTextStyles } from '../engine/context'
import { SlideView } from '../engine/SlideView'
import { Stage } from '../engine/Stage'
import { resolveDeck } from '../engine/masters'
import { ThemeScope } from '../engine/ThemeScope'
import { createSlideTimeline, type SlideTimeline } from '../engine/timeline'
import { matchPairs, runTransition } from '../engine/transitions'
import { worldOf } from '../engine/world'
import type { Deck } from '../schema/deck'
import { onShow, sendShow } from './sync'
import './Present.css'

/**
 * Vollbild-Präsentation: Klick für Klick durch Builds und Folien.
 * `player`: eigenständiger Web-Player (npm run publish) – ohne Editor und Referentenansicht, mit Bedienleiste und Wischen.
 */
export function Present({ name, slideId, player = false }: { name: string; slideId?: string; player?: boolean }) {
  const live = useDeck(name)
  const deck = useMemo(() => live.value && resolveDeck(live.value), [live.value])
  if (!deck) return <div className="present" />
  return (
    <ThemeScope theme={deck.theme} intensity={deck.intensity} textStyles={deck.textStyles}>
      <Show deck={deck} name={name} startId={slideId} player={player} />
    </ThemeScope>
  )
}

/** Eine Navigation: von welcher Folie (Position in der Abspielfolge) wohin, und wie. */
type Nav = { id: number; pos: number; from: number | null; direction: 'forward' | 'back' | 'jump' }

function Show({ deck, name, startId, player }: { deck: Deck; name: string; startId?: string; player: boolean }) {
  const styles = useTextStyles()
  // Abspielfolge ohne übersprungene Folien.
  const order = useMemo(() => deck.slides.flatMap((s, i) => (s.skip ? [] : [i])), [deck])
  const startPos = Math.max(
    0,
    order.findIndex((i) => deck.slides[i]?.id === startId),
  )
  const [nav, setNav] = useState<Nav>({ id: 0, pos: startPos, from: null, direction: 'jump' })
  const [leftNav, setLeftNav] = useState(-1) // ID der Navigation, deren Übergang fertig ist
  const [ended, setEnded] = useState(false)
  const [black, setBlack] = useState(false)
  const [idle, setIdle] = useState(false)
  // Als Publikumsfenster aus der Referentenansicht geöffnet: erster Klick schaltet Vollbild ein.
  const [needsFullscreen, setNeedsFullscreen] = useState(() => Boolean(window.opener) && !document.fullscreenElement)

  const layers = useRef(new Map<number, HTMLDivElement>())
  const timelines = useRef(new Map<number, SlideTimeline>())
  const build = useRef(0)
  const transition = useRef<gsap.core.Timeline | null>(null)
  const latest = useRef({ deck, styles, order, nav, ended, black })
  useLayoutEffect(() => {
    latest.current = { deck, styles, order, nav, ended, black }
  })

  /** Aktuellen Stand an Referentenansicht und Fernbedienung senden. */
  const publish = useCallback(() => {
    const { deck, order, nav, ended, black } = latest.current
    const index = order[nav.pos] ?? 0
    const tl = timelines.current.get(index)
    sendShow({
      deck: name,
      kind: 'state',
      state: {
        slideIndex: index,
        slideId: deck.slides[index]?.id ?? '',
        position: nav.pos,
        total: order.length,
        build: build.current,
        builds: tl ? tl.steps.length - 1 : 0,
        ended,
        black,
      },
    })
  }, [name])

  const current = order[nav.pos] ?? 0
  const leaving = nav.from !== null && leftNav !== nav.id ? order[nav.from] : undefined

  // Bei jeder Navigation: Build-Timeline der neuen Folie anlegen, Übergang abspielen, Automatik-Schritt starten.
  useLayoutEffect(() => {
    const { deck, styles, order } = latest.current
    const index = order[nav.pos]
    const slide = index === undefined ? undefined : deck.slides[index]
    const root = index === undefined ? null : layers.current.get(index)?.querySelector<HTMLElement>(':scope > .slide')
    if (!slide || !root || index === undefined) return

    const fromIndex = nav.from === null ? undefined : order[nav.from]
    const fromSlide = fromIndex === undefined ? undefined : deck.slides[fromIndex]
    const fromRoot = fromIndex === undefined ? null : layers.current.get(fromIndex)?.querySelector<HTMLElement>(':scope > .slide')

    for (const [i, tl] of timelines.current) {
      if (i !== index && i !== fromIndex) {
        tl.kill()
        timelines.current.delete(i)
      }
    }
    timelines.current.get(index)?.kill()

    const magic = nav.direction === 'forward' && fromSlide && slide.transition?.type === 'magicMove'
    const skipIn = magic ? new Set(matchPairs(fromSlide, slide).map(([, b]) => b.id)) : undefined
    const tl = createSlideTimeline(root, slide, { skipIn })
    timelines.current.set(index, tl)

    if (nav.direction === 'back') {
      build.current = tl.steps.length - 1
      tl.seek(build.current)
      publish()
      return
    }
    build.current = 0
    publish()
    if (nav.direction === 'forward' && fromSlide && fromRoot) {
      const run = runTransition({
        from: fromRoot,
        to: root,
        fromSlide,
        toSlide: slide,
        transition: slide.transition,
        styles,
        width: deck.format.width,
        height: deck.format.height,
        fromWorld: worldOf(fromSlide, fromIndex!, deck),
        toWorld: worldOf(slide, index, deck),
      })
      transition.current = run.timeline
      run.timeline.eventCallback('onComplete', () => {
        transition.current = null
        setLeftNav(nav.id)
        tl.play(0)
      })
      return () => {
        run.timeline.progress(1)
      }
    }
    tl.play(0)
  }, [nav, publish])

  const go = useCallback((pos: number, direction: Nav['direction']) => {
    setEnded(false)
    setNav((n) => ({ id: n.id + 1, pos, from: direction === 'forward' ? n.pos : null, direction }))
  }, [])

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    if (player) return
    const slide = latest.current.deck.slides[current]
    navigate({ page: 'deck', name, slideId: slide?.id })
  }, [current, name, player])

  const next = useCallback(() => {
    if (black) return setBlack(false)
    if (transition.current) return void transition.current.progress(1)
    const tl = timelines.current.get(current)
    if (tl?.finish()) return
    if (tl && build.current < tl.steps.length - 1) {
      build.current += 1
      tl.play(build.current)
      publish()
      return
    }
    if (nav.pos < order.length - 1) go(nav.pos + 1, 'forward')
    else if (ended && !player) exit()
    else setEnded(true)
  }, [black, current, nav.pos, order.length, ended, player, go, exit, publish])

  const prev = useCallback(() => {
    if (black) return setBlack(false)
    if (ended) return setEnded(false)
    if (transition.current) transition.current.progress(1)
    const tl = timelines.current.get(current)
    if (tl && build.current > 0) {
      build.current -= 1
      tl.seek(build.current)
      publish()
      return
    }
    if (nav.pos > 0) go(nav.pos - 1, 'back')
  }, [black, ended, current, nav.pos, go, publish])

  // Tastatur und Presenter-Clicker (senden meist Bild↑/Bild↓).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
        case 'n':
          next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
        case 'p':
          prev()
          break
        case 'Home':
          go(0, 'jump')
          break
        case 'End':
          go(order.length - 1, 'jump')
          break
        case 'b':
        case '.':
          setBlack((b) => !b)
          break
        case 'r':
          if (player) return
          openPresenter(name, latest.current.deck.slides[current]?.id)
          break
        case 'f':
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
          else void document.documentElement.requestFullscreen().catch(() => {})
          break
        case 'Escape':
          exit()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, exit, order.length, name, current, player])

  // Web-Player: aktuelle Folie in der Adresse (#folie) – Links auf eine bestimmte Folie funktionieren so.
  useEffect(() => {
    const id = deck.slides[current]?.id
    if (player && id) history.replaceState(null, '', `#${encodeURIComponent(id)}`)
  }, [player, deck, current])

  // Web-Player auf Handy und Tablet: nach links wischen = weiter, nach rechts = zurück.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  // Schwarzbild und Ende melden
  useEffect(() => {
    publish()
  }, [ended, black, publish])

  // Befehle von Referentenansicht und Handy
  const commands = useRef({ next, prev, go })
  useLayoutEffect(() => {
    commands.current = { next, prev, go }
  })
  useEffect(
    () =>
      onShow(name, (message) => {
        if (message.kind === 'hello') publish()
        if (message.kind !== 'command') return
        const { command } = message
        if (command.type === 'next') commands.current.next()
        if (command.type === 'prev') commands.current.prev()
        if (command.type === 'black') setBlack((b) => !b)
        if (command.type === 'goto') {
          const { deck, order } = latest.current
          const pos = order.indexOf(deck.slides.findIndex((s) => s.id === command.slideId))
          if (pos >= 0) commands.current.go(pos, 'jump')
        }
      }),
    [name, publish],
  )

  // Esc im Vollbild beendet den Vollbildmodus ohne keydown – dann auch die Präsentation.
  useEffect(() => {
    let wasFullscreen = Boolean(document.fullscreenElement)
    const onChange = () => {
      if (wasFullscreen && !document.fullscreenElement) exit()
      wasFullscreen = Boolean(document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [exit])

  // Mauszeiger nach kurzer Ruhe ausblenden.
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), 1500)
    const onMove = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), 1500)
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  useEffect(() => {
    const map = timelines.current
    return () => {
      for (const tl of map.values()) tl.kill()
    }
  }, [])

  const visible = leaving === undefined ? [current] : [leaving, current]
  return (
    <div
      className={`present ${idle ? 'is-idle' : ''}`}
      onTouchStart={(e) => {
        const t = e.touches[0]
        touch.current = t ? { x: t.clientX, y: t.clientY } : null
      }}
      onTouchEnd={(e) => {
        const start = touch.current
        const t = e.changedTouches[0]
        touch.current = null
        if (!player || !start || !t) return
        const dx = t.clientX - start.x
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(t.clientY - start.y)) return
        swiped.current = true
        if (dx < 0) next()
        else prev()
      }}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false
          return
        }
        if (needsFullscreen) {
          setNeedsFullscreen(false)
          void document.documentElement.requestFullscreen?.().catch(() => {})
          return
        }
        next()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        prev()
      }}
      data-slide-id={deck.slides[current]?.id}
    >
      <Stage format={deck.format} className="present__stage">
        {visible.map((index) => {
          const slide = deck.slides[index]
          if (!slide) return null
          return (
            <div
              key={slide.id}
              className="present__layer"
              ref={(node) => {
                if (node) layers.current.set(index, node)
                else layers.current.delete(index)
              }}
            >
              <SlideView
                slide={slide}
                deckName={name}
                mode="present"
                width={deck.format.width}
                height={deck.format.height}
              />
            </div>
          )
        })}
      </Stage>
      {needsFullscreen && (
        <div className="present__hint">Klicken für Vollbild · Steuerung über die Referentenansicht</div>
      )}
      {(black || ended) && (
        <div className="present__black">
          {ended && !black && <span>{player ? 'Ende der Präsentation · ← zurück' : 'Ende der Präsentation · Esc zum Beenden'}</span>}
        </div>
      )}
      {player && (
        <PlayerBar
          position={nav.pos}
          total={order.length}
          ended={ended}
          onPrev={prev}
          onNext={next}
          onRestart={() => go(0, 'jump')}
        />
      )}
    </div>
  )
}

/** Bedienleiste des Web-Players: erscheint bei Mausbewegung (ausgeblendet mit .is-idle). */
function PlayerBar(props: {
  position: number
  total: number
  ended: boolean
  onPrev: () => void
  onNext: () => void
  onRestart: () => void
}) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void document.documentElement.requestFullscreen?.().catch(() => {})
  }
  return (
    <div className="player-bar" onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      <button className="player-bar__btn" title="Zurück (←)" aria-label="Zurück" onClick={stop(props.onPrev)}>
        ‹
      </button>
      <span className="player-bar__count">
        {props.position + 1} / {props.total}
      </span>
      <button className="player-bar__btn" title="Weiter (→)" aria-label="Weiter" onClick={stop(props.onNext)}>
        ›
      </button>
      <span className="player-bar__sep" />
      {props.ended || props.position > 0 ? (
        <button className="player-bar__btn player-bar__btn--text" title="Von vorn (Pos1)" onClick={stop(props.onRestart)}>
          Von vorn
        </button>
      ) : null}
      {document.fullscreenEnabled && (
        <button className="player-bar__btn player-bar__btn--text" title="Vollbild (F)" onClick={stop(fullscreen)}>
          Vollbild
        </button>
      )}
    </div>
  )
}

/** Referentenansicht in einem eigenen Fenster öffnen (zum Verschieben auf den Laptop-Bildschirm). */
export function openPresenter(name: string, slideId?: string) {
  const url = href({ page: 'presenter', name, slideId })
  window.open(url, `studio-presenter-${name}`, 'popup,width=1280,height=800')
}
