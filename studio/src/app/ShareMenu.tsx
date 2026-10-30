import { useEffect, useRef, useState } from 'react'
import { CLOUD } from '../api/cloud/config'
import type { Issue } from '../schema/issues'
import { Icon } from '../ui/Icon'
import './ShareMenu.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'done'; title: string; detail: string }
  | { kind: 'error'; title: string; detail: string }

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
const firstIssue = (issues: Issue[] | undefined, status: number) =>
  issues?.[0] ? `${issues[0].path ? issues[0].path + ': ' : ''}${issues[0].message}` : `Fehler ${status}`

/** „Teilen“ im Editor: Web-Player bauen (published/<deck>/) und PowerPoint herunterladen. */
export function ShareMenu({ name, disabled }: { name: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const ref = useRef<HTMLDivElement>(null)
  const busy = status.kind === 'busy'

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const publish = async () => {
    setStatus({ kind: 'busy', label: 'Web-Player wird gebaut …' })
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(name)}/publish`, { method: 'POST' })
      const body = (await res.json()) as { dir?: string; bytes?: number; issues?: Issue[] }
      if (!res.ok) throw new Error(firstIssue(body.issues, res.status))
      setStatus({
        kind: 'done',
        title: `Fertig · ${mb(body.bytes ?? 0)}`,
        detail: `Ordner studio/${body.dir} auf app.netlify.com/drop ziehen – fertig ist der Link. Ansehen: npm run publish -- ${name} --preview`,
      })
    } catch (err) {
      setStatus({ kind: 'error', title: 'Web-Player nicht gebaut', detail: (err as Error).message })
    }
  }

  const pptx = async () => {
    setStatus({ kind: 'busy', label: 'PowerPoint wird erstellt …' })
    try {
      const res = await fetch(`/api/decks/${encodeURIComponent(name)}/export.pptx`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { issues?: Issue[] }
        throw new Error(firstIssue(body.issues, res.status))
      }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.pptx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setStatus({
        kind: 'done',
        title: 'PowerPoint heruntergeladen',
        detail: 'Animationen fehlen dort. Für die Schriften Bricolage Grotesque und DM Sans installieren (Google Fonts).',
      })
    } catch (err) {
      setStatus({ kind: 'error', title: 'Export fehlgeschlagen', detail: (err as Error).message })
    }
  }

  return (
    <div className="share" ref={ref}>
      <button
        className={`btn ${open ? 'is-on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        title="Als Web-Link oder PowerPoint teilen"
      >
        <Icon name="upload" size={14} /> Teilen
      </button>
      {open && (
        <div className="share__menu material" role="menu">
          {CLOUD && (
            <p className="share__hint">Web-Player und PowerPoint baut der Mac (npm run dev) – unterwegs fehlt dafür der Rechner.</p>
          )}
          <button className="share__item" role="menuitem" disabled={busy || CLOUD} onClick={() => void publish()}>
            <strong>Web-Player bauen</strong>
            <span>Eigenständige Seite mit allen Animationen – zum Hochladen als Link.</span>
          </button>
          <button className="share__item" role="menuitem" disabled={busy || CLOUD} onClick={() => void pptx()}>
            <strong>PowerPoint (.pptx)</strong>
            <span>Text, Bilder, Formen und Notizen bleiben bearbeitbar, Effekte als Bild.</span>
          </button>
          {status.kind !== 'idle' && (
            <div className={`share__status share__status--${status.kind}`} role="status">
              {status.kind === 'busy' ? (
                <span className="share__spinner">{status.label}</span>
              ) : (
                <>
                  <strong>{status.title}</strong>
                  <span>{status.detail}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
