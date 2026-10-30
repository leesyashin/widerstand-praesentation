import { useState, type ReactNode } from 'react'

/** Kleine, ruhige Eingabefelder im Stil der macOS-Inspektoren. */

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="row__control">{children}</span>
    </div>
  )
}

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="group">
      {title && <h3 className="section-title">{title}</h3>}
      {children}
    </section>
  )
}

/** Zahl mit Übernahme beim Tippen. Leer = `undefined` (z. B. „Auto“). */
export function NumberField({
  value,
  onChange,
  placeholder,
  step = 1,
  min,
  max,
  suffix,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  placeholder?: string
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  // Während des Tippens gilt der Entwurf, damit z. B. „-“ oder „1,“ nicht sofort verschwinden.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === undefined ? '' : String(Math.round(value * 1000) / 1000))
  const commit = (text: string) => {
    const t = text.trim().replace(',', '.')
    if (t === '') return onChange(undefined)
    const n = Number(t)
    if (!Number.isFinite(n)) return
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)))
  }
  return (
    <span className="num">
      <input
        className="field field--sm"
        inputMode="decimal"
        value={shown}
        placeholder={placeholder}
        onFocus={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) => {
          setDraft(e.target.value)
          commit(e.target.value)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
          const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, (value ?? 0) + delta))
          setDraft(String(Math.round(next * 1000) / 1000))
          onChange(next)
        }}
      />
      {suffix && <span className="num__suffix">{suffix}</span>}
    </span>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select className="field field--sm" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <span className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <span className="slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider__value">{Math.round(value * 100)}</span>
    </span>
  )
}

export function TextField({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      className={`field field--sm ${mono ? 'mono' : ''}`}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Farbe: Brand-Tokens als Swatches, dazu ein freies Feld für Hex/rgba. */
export function ColorField({
  value,
  onChange,
  brand,
  allowNone,
}: {
  value: string | undefined
  onChange: (v: string | undefined) => void
  brand: Record<string, string>
  allowNone?: boolean
}) {
  return (
    <span className="color-field">
      <span className="swatches">
        {allowNone && (
          <button
            type="button"
            className={`swatch swatch--none ${value === undefined ? 'is-on' : ''}`}
            title="Keine"
            onClick={() => onChange(undefined)}
          />
        )}
        {Object.entries(brand).map(([token, hex]) => (
          <button
            key={token}
            type="button"
            className={`swatch ${value === `brand.${token}` ? 'is-on' : ''}`}
            style={{ background: hex }}
            title={`brand.${token}`}
            onClick={() => onChange(`brand.${token}`)}
          />
        ))}
      </span>
      <input
        className="field field--sm mono"
        value={value ?? ''}
        placeholder="Standard"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.trim() || undefined)}
      />
    </span>
  )
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
