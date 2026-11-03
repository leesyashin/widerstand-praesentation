/**
 * Tastenkürzel-Beschriftung je nach System: auf dem Mac ⌘ ⌥ ⇧, unter Windows/Linux Strg, Alt, Umschalt.
 * Die Kürzel selbst reagieren überall auf ⌘ und Strg (siehe `e.metaKey || e.ctrlKey`).
 */
const platform =
  typeof navigator === 'undefined'
    ? ''
    : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '')

export const IS_MAC = /mac|iphone|ipad|ipod/i.test(platform)

/** Taste für Befehle: „⌘“ bzw. „Strg+“. */
export const MOD = IS_MAC ? '⌘' : 'Strg+'

/** „⇧⌥⌘G“ → „Strg+Alt+Umschalt+G“ außerhalb des Macs. */
export function shortcut(mac: string): string {
  if (IS_MAC) return mac
  const mods: string[] = []
  let rest = mac
  for (const [sym, name] of [
    ['⌘', 'Strg'],
    ['⌥', 'Alt'],
    ['⇧', 'Umschalt'],
  ] as const) {
    if (rest.includes(sym)) {
      mods.push(name)
      rest = rest.replace(sym, '')
    }
  }
  rest = rest.replace('⌫', 'Entf')
  // Reihenfolge wie unter Windows üblich: Strg, Alt, Umschalt.
  return [...mods, rest].join('+')
}

/** Name der Zusatztaste für Hinweise: „⌥“ bzw. „Alt“, „⌘“ bzw. „Strg“. */
export const ALT_KEY = IS_MAC ? '⌥' : 'Alt'
export const MOD_KEY = IS_MAC ? '⌘' : 'Strg'
