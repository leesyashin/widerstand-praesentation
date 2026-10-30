# Studio – Regeln für Claude

Studio ist Vincents eigene Präsentations-App (Web, Vite + React + TypeScript) mit Fokus auf Motion & Grafik im Apple-Stil.
Gesamtplan und Phasen: `PLAN.md`. Gestaltungsregeln: `STYLE.md` – **vor jedem Deck lesen**.

## Befehle (im Ordner `studio/`)

| Befehl | Zweck |
|---|---|
| `npm run dev` | App starten (http://localhost:5173). Änderungen an Decks erscheinen live. |
| `npm run validate` | Brand-Kit und alle Decks prüfen. `npm run validate -- <name>` für ein Deck. |
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
- Assets nur über `assets/…`-Pfade im Deck-Ordner. Große Videos: nur optimierte Web-Versionen (< 100 MB).
- Eigene Komponenten (`"type": "custom"`) nur, wenn das Schema es wirklich nicht abdeckt. Sie liegen in
  `custom/<Name>.tsx` (Rendering ab Phase 1).

**Nach jeder Änderung an einem Deck:** `npm run validate -- <name>` ausführen und Fehler beheben.
Danach das Ergebnis visuell prüfen (Screenshot mit Playwright, ab Phase 1 per `npm run shots`) –
auf Überlappungen, Lesbarkeit, Abstände und Ränder achten.

## Stand der Engine (Phase 0)

- Gerendert wird der **Endzustand** jeder Folie: Text, Bild, Video, Formen, Linien/Pfeile, SVG-Icons aus `assets/`,
  Hintergründe (Farbe, Verlauf, Mesh-Gradient, Bild, Video) und CSS-Vorschauen der Effekte
  (Grain, Vignette, Letterbox, Farblooks).
- `build`, `transition`, `world`, `depth` werden schon gespeichert und geprüft, aber erst ab Phase 1/3 animiert.
  Trotzdem sinnvoll setzen – Decks sollen vorwärtskompatibel sein.
- Icon-Bibliothek und eigene Komponenten erscheinen bis Phase 1 als Platzhalter.

## Code

- `src/schema/` – Format (gemeinsam für App, Server und Skripte). Schema-Änderungen rückwärtskompatibel halten
  und `version` erst bei Brüchen erhöhen.
- `server/` – Datei-Dienst (Vite-Plugin): `/api/decks`, `/api/decks/<name>` (GET/PUT), `/api/brand`, Live-Events.
- `src/engine/` – Rendering der Folien. `src/app/` – Ansichten. `src/ui/` – App-Designsystem (Tokens in `tokens.css`).
- UI-Texte auf Deutsch, Du-Form. App-Look: Apple-artig, ruhig, Hell/Dunkel automatisch.
- Die alte Präsentation im Repo-Root (`../index.html`) **nicht anfassen**.
