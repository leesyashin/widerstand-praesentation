import type { CloudConfig } from './config'

/**
 * Schlanker Zugriff auf das Repo über die GitHub-REST-API.
 * Lesen: einmal den Dateibaum des Branches holen (Pfad → Blob-SHA), Inhalte dann über die SHA – die ändern sich nie
 * und werden deshalb im Speicher gehalten. Schreiben: Contents-API, ein Commit pro Datei, nacheinander.
 * Alle Pfade sind relativ zum App-Ordner im Repo (z. B. "decks/willkommen/deck.json").
 */

export class CloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type TreeEntry = { sha: string; size: number }

const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/')

export class Repo {
  /** Commit, zu dem `tree` gehört. */
  head: string | null = null
  tree = new Map<string, TreeEntry>()
  private blobs = new Map<string, Promise<string>>()
  private writes: Promise<unknown> = Promise.resolve()
  private refreshing: Promise<string[]> | null = null

  constructor(readonly config: CloudConfig) {}

  private url(path: string) {
    return `${this.config.api}/repos/${this.config.repo}${path}`
  }

  async request<T>(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<T> {
    let res: Response
    try {
      res = await fetch(this.url(path), {
        cache: 'no-cache', // mit ETag nachfragen: 304 kostet kein Kontingent
        ...init,
        headers: {
          Accept: accept,
          Authorization: `Bearer ${this.config.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      })
    } catch {
      throw new CloudError('Keine Verbindung zu GitHub – bist du online?', 0)
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      throw new CloudError(explain(res.status, body.message), res.status)
    }
    return (await res.json()) as T
  }

  /** Neuen Stand des Branches holen. Gibt die geänderten Pfade zurück (leer, wenn nichts neu ist). */
  refresh(): Promise<string[]> {
    this.refreshing ??= this.load().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private async load(): Promise<string[]> {
    const { branch, dir } = this.config
    const ref = await this.request<{ object: { sha: string } }>(`/git/ref/heads/${enc(branch)}`)
    const commit = ref.object.sha
    if (commit === this.head) return []
    const res = await this.request<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean }>(
      `/git/trees/${commit}?recursive=1`,
    )
    const prefix = dir ? `${dir}/` : ''
    const next = new Map<string, TreeEntry>()
    for (const item of res.tree) {
      if (item.type === 'blob' && item.path.startsWith(prefix)) {
        next.set(item.path.slice(prefix.length), { sha: item.sha, size: item.size ?? 0 })
      }
    }
    const changed = [...new Set([...next.keys(), ...this.tree.keys()])].filter((p) => next.get(p)?.sha !== this.tree.get(p)?.sha)
    const first = this.head === null
    this.head = commit
    this.tree = next
    return first ? [] : changed
  }

  async ready() {
    if (this.head === null) await this.refresh()
  }

  /** Pfade unter einem Ordner (ohne abschließenden Schrägstrich). */
  list(folder: string): string[] {
    const prefix = `${folder}/`
    return [...this.tree.keys()].filter((p) => p.startsWith(prefix)).sort()
  }

  /** Inhalt als base64 (über die Blob-SHA, darum dauerhaft im Speicher). */
  private blob(sha: string): Promise<string> {
    let p = this.blobs.get(sha)
    if (!p) {
      p = this.request<{ content: string }>(`/git/blobs/${sha}`).then((b) => b.content.replace(/\n/g, ''))
      p.catch(() => this.blobs.delete(sha))
      this.blobs.set(sha, p)
    }
    return p
  }

  async text(path: string): Promise<string | null> {
    await this.ready()
    const entry = this.tree.get(path)
    return entry ? decodeText(await this.blob(entry.sha)) : null
  }

  /** Datei schreiben (ein Commit). `expectSha`: nur, wenn die Datei noch diesen Stand hat – sonst Konflikt (409). */
  put(path: string, base64: string, message: string, expectSha?: string | null): Promise<TreeEntry> {
    return this.serial(async () => {
      await this.ready()
      const sha = expectSha === undefined ? this.tree.get(path)?.sha : (expectSha ?? undefined)
      const res = await this.request<{ content: { sha: string; size: number } }>(`/contents/${enc(this.full(path))}`, {
        method: 'PUT',
        body: JSON.stringify({ message, content: base64, branch: this.config.branch, sha }),
      })
      const entry = { sha: res.content.sha, size: res.content.size }
      this.tree.set(path, entry)
      this.blobs.set(entry.sha, Promise.resolve(base64))
      return entry
    })
  }

  remove(path: string, message: string): Promise<void> {
    return this.serial(async () => {
      await this.ready()
      const entry = this.tree.get(path)
      if (!entry) throw new CloudError(`Datei fehlt: ${path}`, 404)
      await this.request(`/contents/${enc(this.full(path))}`, {
        method: 'DELETE',
        body: JSON.stringify({ message, sha: entry.sha, branch: this.config.branch }),
      })
      this.tree.delete(path)
    })
  }

  private full(path: string) {
    return this.config.dir ? `${this.config.dir}/${path}` : path
  }

  /** Schreibzugriffe nacheinander – parallele Commits auf denselben Branch würden sich gegenseitig ablehnen. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writes.then(task, task)
    this.writes = run.catch(() => {})
    return run
  }
}

function explain(status: number, message = ''): string {
  if (status === 401) return 'Zugangsschlüssel ungültig oder abgelaufen – bitte neu anmelden'
  if (status === 403 && /rate limit/i.test(message)) return 'GitHub-Limit erreicht – in ein paar Minuten wieder'
  if (status === 403) return 'Keine Berechtigung – der Schlüssel braucht „Contents: Read and write“ für dieses Repo'
  if (status === 404) return 'Nicht gefunden – stimmen Repo und Branch, und darf der Schlüssel das Repo sehen?'
  if (status === 409) return 'Wurde inzwischen anderswo geändert (z. B. von Claude oder am Mac)'
  if (status === 422 && /too large|size/i.test(message)) return 'Datei zu groß für GitHub'
  return `GitHub: ${message || `Fehler ${status}`}`
}

/* ---------- base64 ---------- */

export function decodeText(base64: string): string {
  const bin = atob(base64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeText(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
}
