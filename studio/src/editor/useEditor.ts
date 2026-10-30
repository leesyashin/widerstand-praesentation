import { produce, type Draft } from 'immer'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { CLOUD } from '../api/cloud/config'
import { api } from '../api/client'
import { useDeck, type Live } from '../api/live'
import type { Deck } from '../schema/deck'
import type { Issue } from '../schema/issues'

/**
 * Zustand des Editors: das bearbeitete Deck mit Verlauf (Rückgängig/Wiederholen) und automatischem Speichern.
 *
 * Datei und Editor bleiben synchron:
 * - Eigene Änderungen werden nach kurzer Pause in die deck.json geschrieben.
 * - Änderungen von außen (Claude, Texteditor) werden übernommen, sobald nichts Ungespeichertes ansteht –
 *   und landen im Verlauf, sodass auch sie rückgängig gemacht werden können.
 */

type State = {
  doc: Deck | null
  past: Deck[]
  future: Deck[]
  /** Ungespeicherte eigene Änderungen. */
  pending: boolean
  saveIssues: Issue[]
  /** Zusammenfassen von Änderungsserien (Ziehen, Tippen) zu einem Verlaufsschritt. */
  mergeKey: string | null
  mergeAt: number
  /** Letzter verarbeiteter Stand aus der Datei. */
  seen: Deck | null
  /** Zuletzt gespeicherte Stände – verspätete Echos davon sind keine Änderungen von außen. */
  recentSaves: string[]
  externalUpdates: number
}

type Action =
  | { type: 'live'; deck: Deck }
  | { type: 'edit'; recipe: (draft: Draft<Deck>) => void; merge?: string; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved'; deck: Deck; issues: Issue[] }

const HISTORY = 200
/** Unterwegs ist jedes Speichern ein Commit – dort erst nach einer kurzen Pause speichern. */
const SAVE_DELAY = CLOUD ? 2500 : 400
const MERGE_WINDOW = 1200

/** JSON mit sortierten Schlüsseln: Der Server liefert Felder in Schema-Reihenfolge, der Editor in Einfügereihenfolge. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

const same = (a: Deck | null, b: Deck | null) => a === b || canonical(a) === canonical(b)

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'live': {
      if (same(action.deck, state.doc) || state.pending) return { ...state, seen: action.deck }
      if (state.recentSaves.includes(canonical(action.deck))) return { ...state, seen: action.deck }
      const external = state.doc !== null
      return {
        ...state,
        seen: action.deck,
        doc: action.deck,
        past: state.doc ? [...state.past, state.doc].slice(-HISTORY) : state.past,
        future: [],
        mergeKey: null,
        externalUpdates: state.externalUpdates + (external ? 1 : 0),
      }
    }
    case 'edit': {
      if (!state.doc) return state
      const next = produce(state.doc, action.recipe)
      if (next === state.doc) return state
      const merge = action.merge !== undefined && action.merge === state.mergeKey && action.at - state.mergeAt < MERGE_WINDOW
      return {
        ...state,
        doc: next,
        past: merge ? state.past : [...state.past, state.doc].slice(-HISTORY),
        future: [],
        pending: true,
        mergeKey: action.merge ?? null,
        mergeAt: action.at,
      }
    }
    case 'undo': {
      const prev = state.past[state.past.length - 1]
      if (!prev || !state.doc) return state
      return {
        ...state,
        doc: prev,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        pending: true,
        mergeKey: null,
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next || !state.doc) return state
      return { ...state, doc: next, past: [...state.past, state.doc], future: rest, pending: true, mergeKey: null }
    }
    case 'saved':
      return {
        ...state,
        pending: state.doc !== action.deck,
        saveIssues: action.issues,
        recentSaves: action.issues.length ? state.recentSaves : [...state.recentSaves, canonical(action.deck)].slice(-20),
      }
  }
}

const initial: State = {
  doc: null,
  past: [],
  future: [],
  pending: false,
  saveIssues: [],
  mergeKey: null,
  mergeAt: 0,
  seen: null,
  recentSaves: [],
  externalUpdates: 0,
}

export type Editor = {
  live: Live<Deck>
  doc: Deck | null
  /** Ändert das Deck. Gleicher `merge`-Schlüssel kurz hintereinander = ein Verlaufsschritt. */
  edit: (recipe: (draft: Draft<Deck>) => void, merge?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  status: 'saved' | 'saving' | 'error'
  saveIssues: Issue[]
  externalUpdates: number
}

export function useEditor(name: string): Editor {
  const live = useDeck(name)
  const [state, dispatch] = useReducer(reducer, initial)

  // Neuer Stand aus der Datei → während des Renderns übernehmen (React-Muster für abgeleiteten Zustand).
  if (live.value && live.value !== state.seen) dispatch({ type: 'live', deck: live.value })

  const pendingDoc = useRef<Deck | null>(null)
  useEffect(() => {
    pendingDoc.current = state.pending ? state.doc : null
  })

  useEffect(() => {
    if (!state.pending || !state.doc) return
    const doc = state.doc
    const timer = setTimeout(() => {
      void api.saveDeck(name, doc).then((r) => dispatch({ type: 'saved', deck: doc, issues: r.ok ? [] : r.issues }))
    }, SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [state.pending, state.doc, name])

  // Beim Verlassen nichts verlieren.
  useEffect(() => {
    const flush = () => {
      if (pendingDoc.current) void api.saveDeck(name, pendingDoc.current)
    }
    // Handy: Wechsel zu einer anderen App oder Sperren → sofort speichern, ein „beforeunload“ kommt dort oft nicht.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [name])

  const edit = useCallback(
    (recipe: (draft: Draft<Deck>) => void, merge?: string) => dispatch({ type: 'edit', recipe, merge, at: performance.now() }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return {
    live,
    doc: state.doc,
    edit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    status: state.saveIssues.length ? 'error' : state.pending ? 'saving' : 'saved',
    saveIssues: state.saveIssues,
    externalUpdates: state.externalUpdates,
  }
}
