/** Farbwerte aus dem Deck (Hex, rgb(a), Brand-Token) → [r, g, b, a] in 0–1 für Shader. */
export type RGBA = [number, number, number, number]

/**
 * Brand-Tokens kommen aus der Palette (Brand + Theme). Fehlt dort ein Token, wird die CSS-Variable am Element
 * `from` gelesen – so gilt auch dann die Palette des Themes, in dem das Element liegt.
 */
export function resolveRgba(
  color: string,
  palette: Record<string, string> = {},
  fallback: RGBA = [0, 0, 0, 1],
  from: Element = document.documentElement,
): RGBA {
  let value = color.trim()
  if (value.startsWith('brand.')) {
    const token = value.slice(6)
    value = palette[token] ?? getComputedStyle(from).getPropertyValue(`--brand-${token}`).trim()
  }
  const hex = value.match(/^#([0-9a-f]{3,8})$/i)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255
    return [n(0), n(2), n(4), full.length === 8 ? n(6) : 1]
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i)?.[1]
  if (rgb) {
    const [r = 0, g = 0, b = 0, a = 1] = rgb.split(/[\s,/]+/).filter(Boolean).map(Number)
    return [r / 255, g / 255, b / 255, a]
  }
  if (value === 'transparent') return [0, 0, 0, 0]
  return fallback
}
