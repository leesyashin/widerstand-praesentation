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

## Stand (Phase 0–5)

- Fertig: alle Elementtypen inkl. Charts und Lottie, Builds, Übergänge inkl. Magic Move v2, Kamerafahrt und Light Leak,
  WebGL-Effekte (Licht-Verlauf, Filmkorn, Licht-Sweep), Glas, 3D-Neigung, Parallax/Schweben, Deck-Intensität,
  Präsentationsmodus mit Referentenansicht, Probe-Modus und Handy-Fernbedienung, eigene Komponenten.
- Editor: Mehrfachauswahl, Hilfslinien & Einrasten, Drehen, Ebenen (Gruppen, Sperren, Ausblenden), Mini-Toolbar,
  Master-Folien, Deck-Textstile, Folienübersicht, Raum-Ansicht, Medien-Bibliothek mit Import, eigene Schriften,
  Build-Reihenfolge per Drag & Drop, Bausteine einfügen, Theme wechseln.
- Bibliothek (Phase 5): 4 Themes (`silber`, `kino`, `sachlich`, `papier`), 16 Layouts, 6 animierte Bausteine,
  4 Deck-Vorlagen (`portfolio`, `angebot`, `pitch`, `vortrag`); neue Decks über die Startseite („Neues Deck“).
- Noch nicht: Web-Link und PowerPoint-Export (Phase 6).

## Master-Folien, Textstile, Gruppen

- `masters`: `[{ id, name?, background?, effects?, elements }]` auf Deck-Ebene; eine Folie nutzt einen per
  `"master": "<id>"`. Master-Elemente liegen hinter den Folien-Elementen (gesperrt, ohne Builds, bleiben bei Magic Move
  stehen). Hintergrund/Effekte des Masters gelten, solange die Folie keine eigenen hat – für wiederkehrende Elemente
  (Logo, Seitenzahl-Linie, Kapitelmarke) also Master statt Kopien auf jeder Folie.
- `textStyles` auf Deck-Ebene überschreibt die Typo-Skala des Themes für das ganze Deck, z. B.
  `"textStyles": { "title": { "size": 112, "weight": 700 } }` (Felder: `font`, `size`, `weight`, `lineHeight`,
  `letterSpacing`, `color`, `uppercase`). Lieber hier ändern als `fontSize` an vielen Texten.
- `group`: gleicher Schlüssel an mehreren Elementen = Gruppe (im Editor gemeinsam ausgewählt/bewegt). Rein
  organisatorisch – Rendering und Ebenen-Reihenfolge bleiben unverändert.

## Neues Deck aus einem Briefing

Dafür gibt es den Projekt-Skill **`/deck`** (`../.claude/skills/deck/SKILL.md`) – er beschreibt den ganzen Ablauf.
Kurz:

1. `STYLE.md` lesen. Passende Vorlage aus `templates/decks/` wählen (`portfolio`/kino, `angebot`/sachlich,
   `pitch`/silber, `vortrag`/papier) und nach `decks/<name>/deck.json` kopieren – oder Folien selbst aus
   `templates/layouts/` ableiten (Elemente und Koordinaten übernehmen, `"layout": "<name>"` setzen, Hintergrund/Effekte
   der Fläche aus dem Theme: `title`, `content`, `light`).
2. Gliederung: eine Idee pro Folie, Titel – Kapitel – Inhalt – Abschluss. Besondere Momente mit Bausteinen aus
   `templates/blocks/` (`intro`, `kapitel-trenner`, `abspann`, `logo-reveal`, `counter`, `galerie`).
3. Builds und Übergänge nach STYLE.md setzen, dann validieren und Screenshots prüfen.

## Themes und Paletten

- Ein Theme kann mit `colors` Brand-Tokens für seine Decks umstellen (z. B. `papier`: helles `background`, dunkles
  `text`; `light`/`ink` sind dort die dunkle Kontrastfläche). Deshalb Farben in Decks und Vorlagen **immer als Token**
  und Logos als Icon `brand/logo-mono.svg` mit `"color": "brand.text"` – dann passt alles in jedem Theme.
- `*kursiv*`/`**fett**` gelten nur innerhalb einer Zeile: über `\n` hinweg jede Zeile einzeln markieren.
- Wie man Themes, Layouts, Bausteine, Vorlagen, Komponenten und Engine-Features ergänzt: `EXTENDING.md`.

## Builds und Übergänge (wie die Engine sie liest)

- Reihenfolge der Builds = Reihenfolge der `elements` (oder `build.order`). Ausblendungen kommen nach allen Einblendungen.
- `trigger`: `click` startet einen neuen Klick-Schritt. `withPrevious` startet gleichzeitig mit dem vorigen Build,
  `afterPrevious` direkt nach dessen Ende. Builds vor dem ersten `click` laufen **automatisch** beim Betreten der Folie.
- Presets: `fade`, `rise`, `blurRise` (Signature „Seide“), `scaleIn`, `maskReveal` (mit `direction`),
  `wordByWord`, `lineByLine` (nur Text), `drawLine` (Linien, Pfeile, Lucide-Icons), `countUp` (erste Zahl im Text,
  deutsche Schreibweise „1.250“), `kenBurns` (Bilder; lang – nicht mit `afterPrevious` dahinter verketten).
- `transition` gilt für den Übergang **zu** dieser Folie: `blurDissolve`, `dissolve`, `magicMove`, `push`, `zoom`,
  `maskReveal`, `whipPan`, `camera`, `lightLeak`.
- Magic Move: Elemente mit gleichem `match` auf beiden Folien fließen ineinander (Text richtet sich an der sichtbaren
  Textkante aus, skaliert nach Schriftgröße). Ihr eigener Einblend-Build wird dabei übersprungen.
- Icons: Lucide-Namen in kebab-case (`camera`, `aperture`, `film`, `sparkles` … siehe lucide.dev/icons).
- Magic Move v2: gleichartige Formen, Icons und Bilder mit gleicher Datei verwandeln sich direkt (Position, Größe,
  Drehung, Farbe, Rundung) – ideal, um z. B. eine Linie zu einer Karte werden zu lassen.
- `camera`: Die Kamera fliegt zwischen den `world`-Positionen (x/y in logischen Pixeln, `z` = Tiefe, `rotate`, `scale`).
  Ohne `world` liegen die Folien auf einer Linie (Abstand 1,25 Folienbreiten). Elemente mit `depth` erzeugen dabei Parallax.
- `lightLeak`: WebGL-Licht in der Akzentfarbe flutet über den Schnitt – Kapitelwechsel, sparsam.

## Grafik & Effekte

- Hintergrund `meshGradient` = Licht-Verlauf (WebGL, mit `animate` lebendig). Farben als Tokens, erste = Grundfarbe.
- `effects`: `grain` (Filmkorn), `vignette`, `letterbox`, `lightSweep` (Lichtstreifen alle ~8 s), `float`
  (Elemente mit `depth` schweben gegeneinander), `colorLook`. Stärken 0–1, skaliert mit `intensity` des Decks
  (0.3 = Standard = Werte wie angegeben, 0 ≈ halb, 1 ≈ doppelt).
- Formen: `glass` (0–1) macht Rechteck/Ellipse zu Milchglas; die Füllung tönt nur. Wirkt nur über Bildern/Verläufen.
- Jedes Element: `depth` (−10…10, hinten…vorne), `tilt` `{ x, y }` in Grad für räumliche Neigung.
- `chart`: `chart` = `bar` | `line` | `donut`, `data` = `[{ label, value, color? }]`, optional `unit`, `max`,
  `showValues`, `showLabels`. Mit Build `grow` wachsen Balken, Linien zeichnen sich, Ringe füllen sich.
- `lottie`: `src` = Bodymovin-JSON in `assets/`, `loop`, `speed`, `posterFrame`. Mit Einblend-Build startet die
  Animation erst mit dem Build; Videos verhalten sich genauso.



## Eigene Komponenten

`custom/<Name>.tsx` exportiert `default` (React-Komponente mit `CustomProps<P>` aus `src/engine/customTypes.ts`),
optional `schema` (Zod für `props` – wird geprüft, Fehler erscheinen als Platzhalter) und `meta`. Beispiel:
`custom/FilmStrip.tsx`. Größe kommt über `width`/`height`, Dateien über `assetUrl("assets/…")`.

## Code

- `src/schema/` – Format (gemeinsam für App, Server und Skripte). Schema-Änderungen rückwärtskompatibel halten
  und `version` erst bei Brüchen erhöhen.
- `server/` – Datei-Dienst (Vite-Plugin): `/api/decks`, `/api/decks/<name>` (GET/PUT), `/api/decks/<name>/assets`
  (GET/POST/DELETE), `/api/brand` (GET/PUT), `/api/brand/fonts` (POST), Live-Events.
- `src/engine/masters.ts` – Master-Folien auflösen (`resolveSlide`/`resolveDeck`) für Editor, Präsentation, Screenshots.
- `src/engine/` – Rendering (`SlideView`), Builds (`timeline.ts`), Übergänge (`transitions.ts`).
- `src/editor/` – Editor (Zustand/Verlauf in `useEditor.ts`, Arbeitsfläche `Canvas.tsx`, Inspector, Ebenen,
  Mini-Toolbar, Übersicht, Medien, Schriften; Bearbeitungslogik in `model.ts`). `src/present/` – Präsentation.
- `src/app/` – Ansichten und Routing. `src/ui/` – App-Designsystem (Tokens in `tokens.css`).
- `templates/themes/`, `templates/layouts/`, `templates/blocks/`, `templates/decks/` – Themes, Layouts, Bausteine,
  Deck-Vorlagen (eigene Schemas in `src/schema/`, Server-Seite in `server/templates.ts`). Anleitung: `EXTENDING.md`.
- UI-Texte auf Deutsch, Du-Form. App-Look: Apple-artig, ruhig, Hell/Dunkel automatisch.
- Die alte Präsentation im Repo-Root (`../index.html`) **nicht anfassen**.

## Präsentieren (Phase 4)

- Show-Kanal `src/present/sync.ts`: Das Publikumsfenster (`Present.tsx`) sendet seinen Stand, Referentenansicht
  (`Presenter.tsx`, `#/presenter/<deck>`) und Handy (`Remote.tsx`, `#/remote/<deck>`) senden Befehle. Der Dev-Server
  verteilt alles über seine Live-Verbindung (`server/showPlugin.ts`) – auch an Geräte im WLAN (`npm run dev:remote`).
- Probe-Zeiten liegen in `decks/<deck>/rehearsal.json` (Schema `src/schema/rehearsal.ts`), nicht in der `deck.json`.
  Die Datei nicht von Hand anlegen – sie entsteht beim Proben. `targetMinutes` = geplante Gesamtdauer.
