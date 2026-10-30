import type { Issue } from '../schema/issues'
import { Rehearsal, type RehearsalRun } from '../schema/rehearsal'

/** Probe-Zeiten und Netzwerk-Adressen (server/showPlugin.ts). */

export async function loadRehearsal(name: string): Promise<Rehearsal> {
  try {
    const res = await fetch(`/api/decks/${encodeURIComponent(name)}/rehearsal`, { cache: 'no-store' })
    const body = (await res.json()) as { rehearsal?: unknown }
    const parsed = Rehearsal.safeParse(body.rehearsal)
    return parsed.success ? parsed.data : { runs: [] }
  } catch {
    return { runs: [] }
  }
}

export async function saveRehearsal(name: string, rehearsal: Rehearsal): Promise<Issue[]> {
  try {
    const res = await fetch(`/api/decks/${encodeURIComponent(name)}/rehearsal`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rehearsal),
    })
    if (res.ok) return []
    const body = (await res.json()) as { issues?: Issue[] }
    return body.issues ?? [{ path: '', message: `Fehler ${res.status}` }]
  } catch (err) {
    return [{ path: '', message: (err as Error).message }]
  }
}

/** Neue Probe anhängen, höchstens 20 behalten. */
export function withRun(rehearsal: Rehearsal, run: RehearsalRun): Rehearsal {
  return { ...rehearsal, runs: [...rehearsal.runs, run].slice(-20) }
}

/** Adressen, unter denen andere Geräte im WLAN den Dev-Server erreichen. */
export async function loadNetworkUrls(): Promise<string[]> {
  try {
    const res = await fetch('/api/show/info', { cache: 'no-store' })
    const body = (await res.json()) as { network?: string[] }
    return body.network ?? []
  } catch {
    return []
  }
}

/** 83500 → "1:23" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
