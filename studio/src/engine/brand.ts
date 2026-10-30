import type { CSSProperties } from 'react'
import type { Brand } from '../schema/brand'
import type { TextStyle } from '../schema/deck'

/** Wird genutzt, solange brand/brand.json fehlt oder ungültig ist – die Folien bleiben sichtbar. */
export const FALLBACK_BRAND: Brand = {
  name: 'Standard',
  colors: {
    background: '#0b0b0f',
    surface: '#1c1c22',
    text: '#f5f5f7',
    textMuted: '#a1a1a6',
    accent: '#0a84ff',
  },
  fonts: {
    display: { family: 'SF Pro Display', fallback: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif' },
    text: { family: 'SF Pro Text', fallback: '-apple-system, BlinkMacSystemFont, Inter, system-ui, sans-serif' },
  },
}

const cssVar = (token: string) => `--brand-${token}`

/** "brand.accent" → var(--brand-accent); alles andere bleibt, wie es ist. */
export function resolveColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  return color.startsWith('brand.') ? `var(${cssVar(color.slice(6))})` : color
}

function fontStack(font: Brand['fonts']['text']): string {
  return [`'${font.family}'`, font.fallback].filter(Boolean).join(', ')
}

/** CSS-Variablen des Brand-Kits für den Folien-Container. */
export function brandVariables(brand: Brand): CSSProperties {
  const vars: Record<string, string> = {}
  for (const [token, value] of Object.entries(brand.colors)) vars[cssVar(token)] = value
  vars['--font-display'] = fontStack(brand.fonts.display)
  vars['--font-text'] = fontStack(brand.fonts.text)
  vars['--font-mono'] = brand.fonts.mono ? fontStack(brand.fonts.mono) : 'ui-monospace, Menlo, monospace'
  return vars as CSSProperties
}

/** @font-face-Regeln für eigene Schriftdateien aus studio/brand/fonts/. */
export function brandFontFaces(brand: Brand): string {
  const fonts = [brand.fonts.display, brand.fonts.text, brand.fonts.mono].filter((f) => f !== undefined)
  return fonts
    .flatMap((f) =>
      (f.files ?? []).map(
        (file) =>
          `@font-face{font-family:'${f.family}';src:url('/brand/${file.src}');font-weight:${file.weight};font-style:${file.style ?? 'normal'};font-display:block}`,
      ),
    )
    .join('\n')
}

type StyleDef = {
  font: 'display' | 'text' | 'mono'
  size: number
  weight: number
  lineHeight: number
  letterSpacing: number
  color: string
  uppercase?: boolean
}

/** Typografie-Skala in logischen Pixeln (für 1080 px Folienhöhe). Wird später durch Themes ersetzbar. */
export const TEXT_STYLES: Record<TextStyle, StyleDef> = {
  display: { font: 'display', size: 156, weight: 700, lineHeight: 1.0, letterSpacing: -0.035, color: 'brand.text' },
  title: { font: 'display', size: 100, weight: 650, lineHeight: 1.05, letterSpacing: -0.025, color: 'brand.text' },
  heading: { font: 'display', size: 60, weight: 600, lineHeight: 1.1, letterSpacing: -0.015, color: 'brand.text' },
  subtitle: { font: 'text', size: 42, weight: 400, lineHeight: 1.3, letterSpacing: -0.01, color: 'brand.textMuted' },
  body: { font: 'text', size: 32, weight: 400, lineHeight: 1.45, letterSpacing: 0, color: 'brand.text' },
  caption: { font: 'text', size: 24, weight: 400, lineHeight: 1.4, letterSpacing: 0.005, color: 'brand.textMuted' },
  label: {
    font: 'text',
    size: 22,
    weight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.12,
    color: 'brand.textMuted',
    uppercase: true,
  },
}
