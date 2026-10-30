/**
 * Studio unterwegs (Phase 7): Die gehostete App (npm run build:cloud, z. B. auf Vercel) liest und speichert direkt
 * im GitHub-Repo statt über den Datei-Dienst des Dev-Servers. Repo und Branch kommen beim Bauen aus Vercel
 * (VERCEL_GIT_*, siehe vite.config.ts), der Zugangsschlüssel nur aus diesem Gerät (localStorage).
 */
export const CLOUD = import.meta.env.VITE_STUDIO_CLOUD === '1'

export type CloudConfig = {
  /** "owner/repo" */
  repo: string
  branch: string
  token: string
  /** GitHub-API – nur für Tests anders. */
  api: string
  /** Ordner der App im Repo. */
  dir: string
}

const KEY = 'studio.cloud'

const defaults = {
  repo: import.meta.env.VITE_GITHUB_REPO ?? '',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
  api: (import.meta.env.VITE_GITHUB_API || 'https://api.github.com').replace(/\/$/, ''),
  dir: import.meta.env.VITE_STUDIO_DIR ?? 'studio',
}

/** Gespeicherte Anmeldung – null, solange kein Schlüssel eingegeben ist. */
export function loadConfig(): CloudConfig | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CloudConfig> | null
    if (!saved?.token) return null
    return { ...defaults, ...saved, api: defaults.api, dir: defaults.dir } as CloudConfig
  } catch {
    return null
  }
}

export function saveConfig(config: Pick<CloudConfig, 'repo' | 'branch' | 'token'>) {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function clearConfig() {
  localStorage.removeItem(KEY)
}

export const defaultRepo = defaults.repo
export const defaultBranch = defaults.branch
export const apiBase = defaults.api
