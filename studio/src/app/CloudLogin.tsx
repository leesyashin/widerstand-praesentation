import { useState, type FormEvent } from 'react'
import { defaultBranch, defaultRepo, saveConfig, apiBase, type CloudConfig } from '../api/cloud/config'
import { Repo } from '../api/cloud/github'
import { syncWorkerConfig } from '../api/cloud/worker'
import './CloudLogin.css'

/**
 * Anmeldung der gehosteten App: ein persönlicher GitHub-Zugangsschlüssel, der nur dieses Repo lesen und schreiben darf.
 * Er bleibt auf diesem Gerät (localStorage) und geht nur an api.github.com.
 */
export function CloudLogin({ onDone }: { onDone: () => void }) {
  const [repo, setRepo] = useState(defaultRepo)
  const [branch, setBranch] = useState(defaultBranch)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fixedRepo = Boolean(defaultRepo)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const config: CloudConfig = { repo: repo.trim(), branch: branch.trim() || 'main', token: token.trim(), api: apiBase, dir: import.meta.env.VITE_STUDIO_DIR ?? 'studio' }
    try {
      const info = await new Repo(config).request<{ permissions?: { push?: boolean } }>('')
      if (!info.permissions?.push) throw new Error('Der Schlüssel darf das Repo nur lesen – unter „Contents“ braucht er „Read and write“.')
      await new Repo(config).request(`/git/ref/heads/${encodeURIComponent(config.branch)}`)
      saveConfig(config)
      await syncWorkerConfig(config)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const tokenUrl = 'https://github.com/settings/personal-access-tokens/new'
  return (
    <main className="login">
      <form className="login__card material" onSubmit={(e) => void submit(e)}>
        <h1>Studio</h1>
        <p className="muted">Melde dich einmal auf diesem Gerät an. Deine Decks liegen in deinem GitHub-Repo – jede Änderung wird dort gespeichert.</p>

        <ol className="login__steps">
          <li>
            <a href={tokenUrl} target="_blank" rel="noreferrer">
              Neuen Zugangsschlüssel bei GitHub anlegen
            </a>{' '}
            (Fine-grained token)
          </li>
          <li>
            <strong>Repository access:</strong> Only select repositories → <span className="mono">{repo || 'dein Repo'}</span>
          </li>
          <li>
            <strong>Permissions:</strong> Contents → <em>Read and write</em>
          </li>
          <li>Erzeugen, kopieren und hier einfügen.</li>
        </ol>

        {!fixedRepo && (
          <label className="login__field">
            <span>Repo</span>
            <input className="field" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="name/repo" autoCapitalize="off" autoCorrect="off" required />
          </label>
        )}
        <label className="login__field">
          <span>Zugangsschlüssel</span>
          <input
            className="field mono"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
            autoCapitalize="off"
            required
          />
        </label>
        <details className="login__more">
          <summary>Branch</summary>
          <input className="field" value={branch} onChange={(e) => setBranch(e.target.value)} autoCapitalize="off" />
        </details>

        {error && <p className="login__error" role="alert">{error}</p>}
        <button className="btn btn--primary login__submit" disabled={busy || !token.trim() || !repo.trim()}>
          {busy ? 'Prüfe …' : 'Anmelden'}
        </button>
        <p className="login__note muted">Der Schlüssel bleibt nur auf diesem Gerät. Abmelden kannst du jederzeit in der Deck-Übersicht.</p>
      </form>
    </main>
  )
}
