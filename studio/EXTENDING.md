# Studio erweitern

Studio ist so gebaut, dass neue Gestaltung fast immer **Daten** ist (JSON in `templates/`) und nur selten Code.
Diese Seite beschreibt alle Erweiterungspunkte – vom einfachsten zum aufwendigsten. Nach jeder Änderung:
`npm run validate` (prüft Brand-Kit, Themes, Layouts, Bausteine, Vorlagen und Decks) und vor dem Commit `npm run check`.

| Was | Wo | Format | Code nötig? |
|---|---|---|---|
| Theme | `templates/themes/<name>.json` | `src/schema/theme.ts` | nein |
| Folien-Layout | `templates/layouts/<name>.json` | `src/schema/layout.ts` | nein |
| Animierter Baustein | `templates/blocks/<name>.json` | `src/schema/block.ts` | nein |
| Deck-Vorlage | `templates/decks/<name>.json` | `src/schema/deck.ts` | nein |
| Eigene Komponente | `custom/<Name>.tsx` | React + Zod | ja, klein |
| Neuer Elementtyp, Build, Übergang, Effekt | `src/schema/`, `src/engine/` | – | ja |

Alle Vorlagen-Dateien beginnen mit `"$schema"` (Pfad zum JSON-Schema in `src/schema/`), dann prüft der Editor schon
beim Tippen. `name` muss dem Dateinamen entsprechen (kebab-case). Vorlagen dürfen nur Dateien aus dem Brand-Kit
nutzen (`brand/…`), weil sie in neue Decks kopiert werden.

## Theme

Ein Theme legt fest, **wie** das Brand-Kit eingesetzt wird: Typo-Skala, Hintergründe und Effekte je Fläche und
optional eine eigene Palette.

```json
{
  "$schema": "../../src/schema/theme.schema.json",
  "name": "papier",
  "label": "Papier",
  "description": "Hell und luftig …",
  "colors": { "background": "#f4f2ed", "text": "#141414" },
  "textStyles": { "title": { "size": 96, "weight": 600 } },
  "backgrounds": { "title": { … }, "content": { … }, "light": { … } },
  "effects": { "title": [{ "type": "grain", "amount": 0.06 }] }
}
```

- **Flächen** (`surface`): `title` (Titel, Kapitel), `content` (Inhalt), `light` (Kontrastfolie, z. B. Abschluss).
  Layouts und Bausteine sagen, welche Fläche sie sind; Hintergrund und Effekte kommen dann vom Theme.
- **`colors`** stellt Brand-Tokens für Decks mit diesem Theme um (nur Tokens, die es in `brand/brand.json` gibt).
  So funktionieren alle Layouts auch hell: Sie nutzen Rollen (`brand.background`, `brand.text`, `brand.surface` …),
  das Theme bestimmt die Werte. `light`/`ink` sind die Kontrastfläche und ihre Schrift – in hellen Themes also dunkel.
- `textStyles` überschreibt einzelne Werte der Standard-Skala (`src/engine/brand.ts`). Ein Deck kann sie mit
  `textStyles` noch einmal überschreiben.
- Theme-Wechsel im Editor (Folie-Tab → Deck → Theme) setzt Hintergrund/Effekte aller Folien neu, die aus einem
  Layout stammen oder noch den Hintergrund einer Fläche des alten Themes haben.

## Folien-Layout

Startpunkt für neue Folien (Editor: „Neue Folie“). Elemente wie im Deck, Koordinaten für `width`×`height`
(meist 1920×1080, für andere Formate wird skaliert).

- Farben als Tokens, Texte über `style` – dann passt das Layout zu jedem Theme.
- Logos als Icon: `"type": "icon", "icon": "brand/logo-mono.svg", "color": "brand.text"` (sichtbar auf hell und dunkel).
- Gleiche Element-IDs für gleiche Rollen (`headline` mit `"match": "headline"`, `kicker`, `text`) – so fließen
  Folien per Magic Move ineinander und Vorlagen lassen sich per ID befüllen.
- Builds nach `STYLE.md` gleich mitliefern.

## Animierter Baustein

Eine fertige Bewegung zum Einfügen (Editor: „Baustein“, mit Vorschau beim Darüberfahren).

```json
{
  "$schema": "../../src/schema/block.schema.json",
  "name": "kapitel-trenner",
  "label": "Kapitel-Trenner",
  "description": "…",
  "kind": "slide",
  "surface": "title",
  "width": 1920, "height": 1080,
  "transition": { "type": "lightLeak", "duration": 1400 },
  "elements": [ … ]
}
```

- `kind: "slide"` → neue Folie hinter der aktuellen; `background`/`effects` des Bausteins oder die der `surface`.
- `kind: "elements"` → die Elemente kommen als Gruppe auf die aktuelle Folie (IDs werden eindeutig gemacht,
  doppelte `match`-Werte fallen weg). Auf Master-Folien ohne Builds.
- Die Bewegung steckt in den `build`s: erstes Element meist `afterPrevious` (läuft automatisch) oder `click`,
  der Rest `withPrevious`/`afterPrevious` mit kleinen `delay`s (Stagger 60–90 ms).
- IDs mit dem Baustein-Namen beginnen lassen (`kapitel-titel`), dann kollidieren sie selten.

## Deck-Vorlage

Ein komplettes, gültiges Deck mit `description` (Editor: Startseite → „Neues Deck“). Beim Anlegen wird es kopiert
und bekommt den neuen Titel. Am besten aus Layouts zusammensetzen (`"layout"` an jeder Folie lassen – dann
funktioniert später auch der Theme-Wechsel) und mit `npm run shots` prüfen, indem man ein Deck daraus anlegt.

## Eigene Komponente

Wenn das Schema etwas wirklich nicht abdeckt (z. B. ein Filmstreifen, eine Karte, ein Spezial-Chart):

```tsx
// custom/FilmStrip.tsx
import { z } from 'zod'
import type { CustomProps } from '../src/engine/customTypes'

export const schema = z.strictObject({ images: z.array(z.string()), speed: z.number().default(0.4) })
export const meta = { label: 'Filmstreifen' }

export default function FilmStrip({ props, width, height, mode, assetUrl }: CustomProps<z.infer<typeof schema>>) {
  …
}
```

Im Deck: `{ "type": "custom", "component": "FilmStrip", "props": { … }, "frame": { … } }`. `props` werden mit
`schema` geprüft (Fehler erscheinen als Platzhalter auf der Folie), im Editor als JSON bearbeitet.
`mode` ist `view` | `thumb` | `present` | `render` – in `thumb`/`render` nichts Teures oder Endloses starten.
Bewährt sich eine Komponente, wird sie ein fester Elementtyp (nächster Abschnitt).

## Engine: neuer Elementtyp, Build, Übergang oder Effekt

| Erweiterung | Schritte |
|---|---|
| Elementtyp | Zod-Schema in `src/schema/deck.ts` (in `Element` aufnehmen) → Darstellung in `ElementBody` (`src/engine/SlideView.tsx`) → Felder im Inspector (`src/editor/Inspector.tsx`), ggf. `newElement` in `src/editor/model.ts` |
| Build-Preset | `BuildPreset` in `deck.ts` → `PRESET_DURATION`, `hiddenVars`/`addIn` in `src/engine/timeline.ts` → Liste `PRESETS` im Inspector |
| Übergang | `TransitionType` in `deck.ts` → Umsetzung in `src/engine/transitions.ts` (Overlays/Masken statt Screenshots) → `TRANSITIONS` im Inspector |
| Effekt | `Effect` in `deck.ts` → `EffectView` in `SlideView.tsx` (WebGL-Shader in `src/engine/gl/shaders.ts`) → Inspector (EffectsGroup) |

Danach `npm run schema` (JSON-Schemas neu erzeugen), `npm run check`, ein Beispiel in `decks/willkommen` und
`npm run shots`. Schema-Änderungen rückwärtskompatibel halten (neue Felder optional); `version` nur bei Brüchen
erhöhen. Die Regeln für Claude (`CLAUDE.md`) und den Skill `/deck` (`../.claude/skills/deck/SKILL.md`) ergänzen.
