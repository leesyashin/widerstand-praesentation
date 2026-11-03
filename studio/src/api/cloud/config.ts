/**
 * Studio unterwegs (Phase 7): Die gehostete App (npm run build:cloud, z. B. auf Vercel) liest und speichert im
 * GitHub-Repo statt über den Datei-Dienst des Dev-Servers. Der GitHub-Schlüssel liegt nur auf dem Server
 * (Vercel-Funktion api/studio.ts); die App meldet sich dort mit einem Passwort an und bekommt ein Sitzungs-Cookie.
 */
export const CLOUD = import.meta.env.VITE_STUDIO_CLOUD === '1'

export type CloudConfig = {
  /** "owner/repo" – nur zur Anzeige und für Commit-Ziele; erzwungen wird beides auf dem Server. */
  repo: string
  branch: string
  /** Ordner der App im Repo. */
  dir: string
  /** Basis der Server-Funktion (…/api/), über die alle Zugriffe laufen. */
  api: string
}

const API = `${import.meta.env.BASE_URL}api/`

let session: CloudConfig | null = null

/** Aktuelle Anmeldung – null, solange nicht angemeldet. */
export function loadConfig(): CloudConfig | null {
  return session
}

type SessionInfo = { repo: string; branch: string; dir: string }

const toConfig = (info: SessionInfo): CloudConfig => ({ ...info, api: API })

/** Beim Start: Ist dieses Gerät schon angemeldet (gültiges Cookie)? */
export async function checkSession(): Promise<CloudConfig | null> {
  try {
    const res = await fetch(`${API}session`, { cache: 'no-store' })
    session = res.ok ? toConfig((await res.json()) as SessionInfo) : null
  } catch {
    session = null
  }
  return session
}

/** Mit Passwort anmelden. Wirft mit verständlicher Meldung. */
export async function signIn(password: string): Promise<CloudConfig> {
  let res: Response
  try {
    res = await fetch(`${API}login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
  } catch {
    throw new Error('Keine Verbindung – bist du online?')
  }
  const body = (await res.json().catch(() => ({}))) as Partial<SessionInfo> & { message?: string }
  if (!res.ok) throw new Error(body.message || `Anmelden fehlgeschlagen (${res.status})`)
  session = toConfig(body as SessionInfo)
  return session
}

export async function signOut() {
  session = null
  await fetch(`${API}logout`, { method: 'POST' }).catch(() => {})
}
