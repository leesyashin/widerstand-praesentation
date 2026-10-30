# Studio – Regeln für Claude

Studio ist Vincents eigene Präsentations-App (Web, Vite + React + TypeScript) mit Fokus auf Motion & Grafik im Apple-Stil.
Gesamtplan und Phasen: `PLAN.md`. Gestaltungsregeln: `STYLE.md` – **vor jedem Deck lesen**.

## Befehle (im Ordner `studio/`)

| Befehl | Zweck |
|---|---|
| `npm run dev` | App starten (http://localhost:5173). Änderungen an Decks erscheinen live. |
| `npm run validate` | Brand-Kit, Themes, Layouts und alle Decks prüfen. `npm run validate -- <name>` für ein Deck. |
| `npm run shots -- <name>` | Jede Folie als PNG nach `shots/<name>/` (Endzustand). Mit `--steps` auch den Stand nach jedem Klick. |
| `npm run schema` | JSON-Schemas neu erzeugen – **nach jeder Änderung in `src/schema/*.ts`**. |
| `npm run check` | Alles: Schema aktuell, Typen, Lint, Decks. Muss vor jedem Commit grün sein. |

## Präsentationen bauen und ändern

- Ein Deck = ein Ordner `decks/<name>/` mit `deck.json` und `assets/`. `<name>` in kebab-case.
- Das Format ist in `src/schema/deck.ts` definiert (Zod, strikt). Die erste Zeile jeder `deck.json`:
  `"$schema": "../../src/schema/deck.schema.json"`.
- Koordinaten sind **logische Pixel** des Formats: 16:9 = 1920×1080, 4:3 = 1440×1080.
- Farben **immer als Brand-Token** (`"brand.accent"`, `"brand.text"` …) aus `brand/brand.json`.
  Feste Hex-Werte nur, wenn es bewusst eine Ausnahme ist.
- Text: `style` aus der Typo-Skala (`display`, `title`, `heading`, `subtitle`, `body`, `caption`, `label`).
  `fontSize` usw. nur überschreiben, wenn nötig. Inline: `**fett**`, `*kursiv*`, `\n`.
- IDs (Folien, Elemente) in kebab-case, sprechend (`headline`, `karte-1-text`), pro Ebene eindeutig.
- Magic Move: gleicher `match`-Wert auf zwei aufeinanderfolgenden Folien. Reihenfolge der `elements` = Ebenen
  (erstes Element ganz hinten).
- Assets über `assets/…` (Deck-Ordner) oder `brand/…` (Brand-Kit, z. B. `brand/logo.svg`).
  Große Videos: nur optimierte Web-Versionen (< 100 MB).
- Brand-Kit steht fest (Silbergelatine, Bricolage Grotesque + DM Sans, Sucher-Logo, Seide, Licht-Verlauf) –
  Details und Logo-Regeln in `STYLE.md`. Schriften liegen lokal in `brand/fonts/` (OFL-Lizenz daneben).
- Eigene Komponenten (`"type": "custom"`) nur, wenn das Schema es wirklich nicht abdeckt (siehe unten).

**Nach jeder Änderung an einem Deck:** `npm run validate -- <name>`, dann `npm run shots -- <name>` und die Bilder
ansehen – auf Überlappungen, Lesbarkeit, Abstände und Ränder achten. Bei Animationen `--steps` nutzen.

## Stand der Engine (Phase 1)

- Fertig: alle Elementtypen, Hintergründe, CSS-Vorschau der Effekte, Builds, Übergänge inkl. Magic Move,
  Präsentationsmodus (`#/present/<deck>`), Editor mit Auswahl/Ziehen/Skalieren/Textbearbeitung/Undo/Autosave,
  Theme `silber`, 8 Layouts, eigene Komponenten.
- Noch nicht: `world`/`depth` (Kamerafahrt, Parallax – Phase 3), WebGL-Effekte (Phase 3), Referentenansicht (Phase 4).
  Diese Felder trotzdem sinnvoll setzen – Decks sollen vorwärtskompatibel sein.

## Neues Deck aus einem Briefing

1. `STYLE.md` lesen. Theme `"theme": "silber"` setzen.
2. Gliederung: eine Idee pro Folie, Titel – Kapitel – Inhalt – Abschluss.
3. Folien von den Layouts in `templates/layouts/` ableiten (Elemente und Koordinaten übernehmen, Inhalte ersetzen,
   `"layout": "<name>"` setzen). Hintergründe/Effekte je Fläche aus `templates/themes/silber.json`
   (`title` = Licht-Verlauf + Korn + Vignette, `content` = dunkle Fläche, `light` = hell).
4. Builds und Übergänge nach STYLE.md setzen, dann validieren und Screenshots prüfen.

## Builds und Übergänge (wie die Engine sie liest)

- Reihenfolge der Builds = Reihenfolge der `elements` (oder `build.order`). Ausblendungen kommen nach allen Einblendungen.
- `trigger`: `click` startet einen neuen Klick-Schritt. `withPrevious` startet gleichzeitig mit dem vorigen Build,
  `afterPrevious` direkt nach dessen Ende. Builds vor dem ersten `click` laufen **automatisch** beim Betreten der Folie.
- Presets: `fade`, `rise`, `blurRise` (Signature „Seide“), `scaleIn`, `maskReveal` (mit `direction`),
  `wordByWord`, `lineByLine` (nur Text), `drawLine` (Linien, Pfeile, Lucide-Icons), `countUp` (erste Zahl im Text,
  deutsche Schreibweise „1.250“), `kenBurns` (Bilder; lang – nicht mit `afterPrevious` dahinter verketten).
- `transition` gilt für den Übergang **zu** dieser Folie: `blurDissolve`, `dissolve`, `magicMove`, `push`, `zoom`,
  `maskReveal`, `whipPan` sind fertig; `camera` und `lightLeak` laufen bis Phase 3 als Zoom bzw. Blur-Überblendung.
- Magic Move: Elemente mit gleichem `match` auf beiden Folien fließen ineinander (Text richtet sich an der sichtbaren
  Textkante aus, skaliert nach Schriftgröße). Ihr eigener Einblend-Build wird dabei übersprungen.
- Icons: Lucide-Namen in kebab-case (`camera`, `aperture`, `film`, `sparkles` … siehe lucide.dev/icons).

## Eigene Komponenten

`custom/<Name>.tsx` exportiert `default` (React-Komponente mit `CustomProps<P>` aus `src/engine/customTypes.ts`),
optional `schema` (Zod für `props` – wird geprüft, Fehler erscheinen als Platzhalter) und `meta`. Beispiel:
`custom/FilmStrip.tsx`. Größe kommt über `width`/`height`, Dateien über `assetUrl("assets/…")`.

## Code

- `src/schema/` – Format (gemeinsam für App, Server und Skripte). Schema-Änderungen rückwärtskompatibel halten
  und `version` erst bei Brüchen erhöhen.
- `server/` – Datei-Dienst (Vite-Plugin): `/api/decks`, `/api/decks/<name>` (GET/PUT), `/api/brand`, Live-Events.
- `src/engine/` – Rendering (`SlideView`), Builds (`timeline.ts`), Übergänge (`transitions.ts`).
- `src/editor/` – Editor (Zustand/Verlauf in `useEditor.ts`, Arbeitsfläche, Inspector). `src/present/` – Präsentation.
- `src/app/` – Ansichten und Routing. `src/ui/` – App-Designsystem (Tokens in `tokens.css`).
- `templates/themes/`, `templates/layouts/` – Theme und Folien-Layouts (eigene Schemas in `src/schema/`).
- UI-Texte auf Deutsch, Du-Form. App-Look: Apple-artig, ruhig, Hell/Dunkel automatisch.
- Die alte Präsentation im Repo-Root (`../index.html`) **nicht anfassen**.
