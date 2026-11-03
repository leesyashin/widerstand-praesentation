import { useState, type FormEvent } from 'react'
import { signIn } from '../api/cloud/config'
import './CloudLogin.css'

/**
 * Anmeldung der gehosteten App: nur ein Passwort. Der GitHub-Schlüssel liegt auf dem Server (Vercel), das Gerät
 * bekommt ein Sitzungs-Cookie (180 Tage).
 */
export function CloudLogin({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(password)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <form className="login__card material" onSubmit={(e) => void submit(e)}>
        <h1>Studio</h1>
        <p className="muted">Melde dich einmal auf diesem Gerät an. Deine Decks liegen in deinem GitHub-Repo – jede Änderung wird dort gespeichert.</p>

        <label className="login__field">
          <span>Passwort</span>
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="off"
            autoFocus
            required
          />
        </label>

        {error && <p className="login__error" role="alert">{error}</p>}
        <button className="btn btn--primary login__submit" disabled={busy || !password}>
          {busy ? 'Prüfe …' : 'Anmelden'}
        </button>
        <p className="login__note muted">Du bleibst auf diesem Gerät angemeldet. Abmelden kannst du jederzeit in der Deck-Übersicht.</p>
      </form>
    </main>
  )
}
