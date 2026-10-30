import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import { useBrand } from '../api/live'
import type { Brand } from '../schema/brand'
import { Icon } from '../ui/Icon'
import { IssueList } from '../ui/IssueList'
import type { Issue } from '../schema/issues'
import { Row, Segmented, Select, TextField } from './fields'

type Role = 'display' | 'text' | 'mono'
const ROLES: { value: Role; label: string }[] = [
  { value: 'display', label: 'Überschriften' },
  { value: 'text', label: 'Fließtext' },
  { value: 'mono', label: 'Mono' },
]

const WEIGHTS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra-?light|ultra-?light/i, 200],
  [/light/i, 300],
  [/semi-?bold|demi/i, 600],
  [/extra-?bold|ultra-?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
  [/medium/i, 500],
]

/** "MeineSchrift-SemiBoldItalic.woff2" → Familie "MeineSchrift", Gewicht 600, kursiv. */
export function guessFont(fileName: string): { family: string; weight: string; italic: boolean } {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const variable = /variable|\bvf\b|\[.*\]/i.test(stem)
  const italic = /italic|oblique/i.test(stem)
  const weight = variable ? '100 900' : String(WEIGHTS.find(([re]) => re.test(stem))?.[1] ?? 400)
  const family =
    stem
      .split(/[-_]/)[0]!
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim() || stem
  return { family, weight, italic }
}

type Draft = { file: File; role: Role; family: string; weight: string; italic: boolean; previewFamily: string }

/** Eigene Schriften hochladen und den Rollen des Brand-Kits zuweisen (Überschriften, Fließtext, Mono). */
export function FontsDialog({ onClose }: { onClose: () => void }) {
  const brand = useBrand()
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pick = async (file: File) => {
    setIssues([])
    setDone(null)
    const guess = guessFont(file.name)
    const previewFamily = `studio-preview-${Date.now()}`
    try {
      const face = new FontFace(previewFamily, await file.arrayBuffer(), { weight: guess.weight, style: guess.italic ? 'italic' : 'normal' })
      await face.load()
      document.fonts.add(face)
    } catch {
      setIssues([{ path: '', message: `${file.name} lässt sich nicht als Schrift laden – ist die Datei beschädigt?` }])
      return
    }
    setDraft({ file, role: 'display', family: guess.family, weight: guess.weight, italic: guess.italic, previewFamily })
  }

  const save = async () => {
    const current = brand.value
    if (!draft || !current) return
    const weight = /^\d+$/.test(draft.weight) ? Number(draft.weight) : draft.weight
    if (typeof weight === 'string' && !/^[1-9]00 [1-9]00$/.test(weight)) {
      setIssues([{ path: '', message: 'Gewicht: eine Zahl wie 400 oder ein Bereich wie „100 900“ (variable Schrift)' }])
      return
    }
    setBusy(true)
    const up = await api.uploadFont(draft.file, draft.file.name)
    if (!up.ok) {
      setBusy(false)
      setIssues(up.issues)
      return
    }
    const next: Brand = structuredClone(current)
    const role = next.fonts[draft.role]
    const file = { src: up.value, weight, ...(draft.italic ? { style: 'italic' as const } : {}) }
    // Gleiche Familie → weiterer Schnitt; andere Familie → ersetzt die Schrift dieser Rolle.
    if (role && role.family === draft.family) role.files = [...(role.files ?? []).filter((f) => f.src !== up.value), file]
    else next.fonts[draft.role] = { family: draft.family, fallback: role?.fallback ?? current.fonts.text.fallback, files: [file] }
    const r = await api.saveBrand(next)
    setBusy(false)
    if (!r.ok) return setIssues(r.issues)
    setDone(`${draft.family} ist jetzt die Schrift für ${ROLES.find((x) => x.value === draft.role)?.label}.`)
    setDraft(null)
  }

  const fonts = brand.value?.fonts
  const rows = useMemo(() => ROLES.map((r) => ({ ...r, font: fonts?.[r.value] })), [fonts])

  return createPortal(
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog material" role="dialog" aria-label="Schriften">
        <div className="dialog__head">
          <h2>Schriften</h2>
          <button type="button" className="btn btn--plain btn--icon" title="Schließen" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <p className="field-hint muted">
          Schriften gelten im ganzen Brand-Kit (alle Decks). Dateien landen in brand/fonts/ – bitte nur Schriften mit
          Web-Lizenz hochladen (z. B. OFL), wenn du Decks später als Link teilst.
        </p>
        <div className="font-roles">
          {rows.map((r) => (
            <div key={r.value} className="font-role">
              <span className="font-role__label">{r.label}</span>
              <span className="font-role__sample" style={{ fontFamily: `var(--font-${r.value})` }}>
                {r.font?.family ?? 'Systemschrift'}
              </span>
              <span className="font-role__files muted">
                {r.font?.files?.length ? r.font.files.map((f) => `${f.src.replace('fonts/', '')} (${f.weight}${f.style === 'italic' ? ', kursiv' : ''})`).join(' · ') : 'ohne eigene Datei'}
              </span>
            </div>
          ))}
        </div>

        {!draft && (
          <button type="button" className="btn" onClick={() => input.current?.click()} disabled={!brand.value}>
            <Icon name="upload" size={14} /> Schrift hochladen …
          </button>
        )}
        <input
          ref={input}
          type="file"
          hidden
          accept=".woff2,.woff,.otf,.ttf"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void pick(f)
            e.target.value = ''
          }}
        />

        {draft && (
          <div className="font-draft">
            <div className="font-draft__preview" style={{ fontFamily: draft.previewFamily, fontStyle: draft.italic ? 'italic' : 'normal' }}>
              Licht. Bewegung. Geschichte. 0123
            </div>
            <Row label="Datei">
              <span className="mono">{draft.file.name}</span>
            </Row>
            <Row label="Rolle">
              <Segmented value={draft.role} options={ROLES} onChange={(role) => setDraft({ ...draft, role })} />
            </Row>
            <Row label="Familie">
              <TextField value={draft.family} onChange={(family) => setDraft({ ...draft, family })} />
            </Row>
            <Row label="Gewicht">
              <TextField value={draft.weight} placeholder="400 oder 100 900" onChange={(weight) => setDraft({ ...draft, weight })} />
            </Row>
            <Row label="Stil">
              <Select
                value={draft.italic ? 'italic' : 'normal'}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'italic', label: 'Kursiv' },
                ]}
                onChange={(v) => setDraft({ ...draft, italic: v === 'italic' })}
              />
            </Row>
            <p className="field-hint muted">
              {fonts?.[draft.role]?.family === draft.family
                ? `Wird als weiterer Schnitt zu ${draft.family} hinzugefügt.`
                : `Ersetzt ${fonts?.[draft.role]?.family ?? 'die Systemschrift'} für ${ROLES.find((x) => x.value === draft.role)?.label}.`}
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--plain" onClick={() => setDraft(null)}>
                Abbrechen
              </button>
              <button type="button" className="btn btn--primary" disabled={busy || !draft.family.trim()} onClick={() => void save()}>
                {busy ? 'Speichert …' : 'Übernehmen'}
              </button>
            </div>
          </div>
        )}
        {done && <p className="field-hint">{done}</p>}
        {issues.length > 0 && <IssueList title="Das hat nicht geklappt" issues={issues} />}
      </div>
    </div>,
    document.body,
  )
}
