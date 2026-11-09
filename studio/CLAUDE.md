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
| `npm run publish -- <name>` | Web-Player nach `published/<name>/` (eigenständig, mit Animationen). `--preview` zum Ansehen. |
| `npm run build:cloud` | Gehostete App (Vercel) nach `dist/` – speichert über die GitHub-API, siehe „Studio unterwegs“. |
| `npm run pptx -- <name>` | PowerPoint nach `exports/<name>.pptx` (Text/Bilder/Formen/Notizen nativ, Effekte als Bild). |

## Präsentationen bauen und ändern

- Ein Deck = ein Ordner `decks/<name>/` mit `deck.json` und `assets/`. `<name>` in kebab-case.
- Das Format ist in `src/schema/deck.ts` definiert (Zod, strikt). Die erste Zeile jeder `deck.json`:
  `"$schema": "../../src/schema/deck.schema.json"`.
- Koordinaten sind **logische Pixel** des Formats: 16:9 = 1920×1080, 4:3 = 1440×1080.
- Farben **immer als Brand-Token** (`"brand.accent"`, `"brand.text"` …) aus `brand/brand.json`.
  Feste Hex-Werte nur, wenn es bewusst eine Ausnahme ist.
- Text: `style` aus der Typo-Skala (`display`, `title`, `heading`, `subtitle`, `body`, `caption`, `label`).
  `fontSize` usw. nur überschreiben, wenn nötig. Inline: `**fett**`, `*kursiv*`, `***beides***`, `\n`.
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
- **Phase 8 „Animations-Paradies“** (Plan in `PLAN.md`): 8a–8c fertig – freie Bewegungen, Kurven, Pfade,
  Szenen, Zeitleiste, kinetische Typo, Formwandel, Text auf Pfad, Daten-Magic-Move, Partikel, generative Muster,
  Shader-Looks, Physik (siehe unten). 8d (3D) und 8e (Bühne) folgen. Motion-Charakter laut Vincent: *alles erlaubt* (Motion-Stufen in `STYLE.md`) –
  für Schule/Uni (iPad am Beamer) aber leichtgewichtig bauen.
- **Phase 9 „Fertigstellung“** (Plan in `FERTIGSTELLUNG.md`, vor Arbeit an der App lesen): Editor vor Engine.
  8d und 8e ruhen, bis der Editor fertig ist – Text und Schrift, Auswahl, Zoom, Menüs, Windows, eigenes
  Designsystem. Reihenfolge und Abnahme-Kriterien der Etappen stehen dort.

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
- Paletten unabhängig vom Theme: `deck.colors` (Hex je Token) überschreibt Brand-Kit und Theme; fertige Sätze in
  `templates/palettes.json`. **Neue Paletten Vincent immer erst als gerenderte Beispiele zeigen** – aufgenommen wird nur,
  was er auswählt (siehe `EXTENDING.md`).
- `*kursiv*`/`**fett**`/`***beides***` gelten nur innerhalb einer Zeile: über `\n` hinweg jede Zeile einzeln markieren.
  Parser: `src/engine/markup.ts` (Folie, Editor und PowerPoint nutzen denselben).
- Wie man Themes, Layouts, Bausteine, Vorlagen, Komponenten und Engine-Features ergänzt: `EXTENDING.md`.

## Builds und Übergänge (wie die Engine sie liest)

- Reihenfolge der Builds = Reihenfolge der `elements` (oder `build.order`). Ausblendungen kommen nach allen Einblendungen.
- `trigger`: `click` startet einen neuen Klick-Schritt. `withPrevious` startet gleichzeitig mit dem vorigen Build,
  `afterPrevious` direkt nach dessen Ende. Builds vor dem ersten `click` laufen **automatisch** beim Betreten der Folie.
- Presets: `fade`, `rise`, `blurRise` (Signature „Seide“), `scaleIn`, `maskReveal` (mit `direction`),
  `wordByWord`, `lineByLine`, `charByChar`, `typewriter`, `scramble`, `assemble` (nur Text), `drawLine` (Linien, Pfeile, Lucide-Icons), `countUp` (erste Zahl im Text,
  deutsche Schreibweise „1.250“), `kenBurns` (Bilder; lang – nicht mit `afterPrevious` dahinter verketten).
- `transition` gilt für den Übergang **zu** dieser Folie: `blurDissolve`, `dissolve`, `magicMove`, `push`, `zoom`,
  `maskReveal`, `whipPan`, `camera`, `lightLeak`, `glitch`.
- Magic Move: Elemente mit gleichem `match` auf beiden Folien fließen ineinander (Text richtet sich an der sichtbaren
  Textkante aus, skaliert nach Schriftgröße). Ihr eigener Einblend-Build wird dabei übersprungen.
- Icons: Lucide-Namen in kebab-case (`camera`, `aperture`, `film`, `sparkles` … siehe lucide.dev/icons).
- Magic Move v2: gleichartige Formen, Icons und Bilder mit gleicher Datei verwandeln sich direkt (Position, Größe,
  Drehung, Farbe, Rundung) – ideal, um z. B. eine Linie zu einer Karte werden zu lassen.
- `camera`: Die Kamera fliegt zwischen den `world`-Positionen (x/y in logischen Pixeln, `z` = Tiefe, `rotate`, `scale`).
  Ohne `world` liegen die Folien auf einer Linie (Abstand 1,25 Folienbreiten). Elemente mit `depth` erzeugen dabei Parallax.
- `lightLeak`: WebGL-Licht in der Akzentfarbe flutet über den Schnitt – Kapitelwechsel, sparsam.

## Freie Bewegung & Szenen (Phase 8a)

- `motion` an jedem Element: Liste von Spuren, zusätzlich zu `build` (Builds bewegen `.el-anim`, Bewegungen die Hülle
  `.el-motion` darin – beides lässt sich kombinieren). Beispiel-Deck: `decks/motion-demo`.
- Felder: `step` (0 = automatisch beim Betreten, 1 = erster Klick …; fehlende Klicks entstehen dadurch), `at` (Start in ms
  im Schritt), `duration` (ms, Standard 800), `ease`, und **eins von**: `from`/`to`, `keys` (≥ 2 Zustände, optional `t`
  0–1 und `ease` pro Abschnitt) oder `path` (SVG-Pfad in Folien-Koordinaten, die Element-Mitte folgt; `orient: true` dreht
  mit). `repeat` (−1 = endlos, läuft neben den Klicks weiter), `yoyo`, `repeatDelay`.
- Eigenschaften (Abweichung von der Ruhe-Position `frame`): `x`, `y`, `z`, `scale`, `scaleX`, `scaleY`, `rotate`,
  `rotateX`, `rotateY` (3D, Perspektive automatisch), `skewX`, `skewY`, `opacity`, `blur` (px), `color` (Text/Icon/Chart),
  `fill` (Form). Nur `from` = „hereinkommen“ (endet in der Ruhe-Position); nur `to` = „hinbewegen“ (bleibt dort).
- **Frame = Ruhe-Position**, und der Editor zeigt sie so. Bewegungen deshalb möglichst so bauen, dass sie in der
  Ruhe-Position enden (`from` statt `to`), dann stimmen Editor, Vorschaubilder und PowerPoint mit dem Endzustand überein.
- Kurven (`ease`): `smooth`, `spring`, `spring(0.4)` (Nachschwingen 0–0.95), `bounce`, `elastic`, `back`, `linear`, `in`,
  `out`, `inOut`, `cubic-bezier(x1,y1,x2,y2)`, `wiggle(n)` (zittert n-mal und kehrt zurück – mit `to: { rotate: 12 }`),
  `steps(n)`.
- **Szene**: `slide.scene = { loop?, duration? }` – die Folie läuft von selbst durch wie ein Film: Builds laufen nach
  Zeit (Klick-Auslöser werden zu „danach“), `step` der Bewegungen zählt nicht, `at` ist ab Folienbeginn. Ein Klick geht
  zur nächsten Folie. `loop` wiederholt die ganze Szene.
- Editor: Zeitleiste unter der Folie (Balken ziehen = Start, rechte Kante = Dauer), Inspector → Animation → „Bewegung“
  (Klick, Start, Dauer, Kurve, Wiederholung), Folie → „Ablauf“ (Szene an/aus, Schleife). Engine: `src/engine/motion.ts`,
  Schritte in `computeSteps` (`timeline.ts`).

## Kinetische Typo, Pfade, Daten (Phase 8b)

- Text-Builds: `charByChar` (Buchstabe für Buchstabe, mit `direction`), `typewriter` (Schreibmaschine), `scramble`
  (Zeichen wirbeln zum Wort), `assemble` (fliegt aus Einzelteilen zusammen – als `out` zerfällt der Text). Gehen auch
  als Ausblendung (`out`).
- Freie Bewegung für Textteile: `split: "char" | "word" | "line"` + `stagger` (ms, Standard 40) + `staggerFrom`
  (`start`/`end`/`center`/`random`) – jedes Teil bekommt die Bewegung versetzt, z. B. eine Welle:
  `{ "step": 1, "split": "char", "stagger": 45, "duration": 700, "repeat": -1, "yoyo": true, "to": { "y": -28 } }`.
  Buchstaben liegen als `.c` in Wörtern `.w` (Wörter brechen nie mitten im Wort um).
- Element `path`: freie Vektorform. `d` = SVG-Pfad im `viewBox` (Standard: Rahmengröße), `stroke { color, width }`,
  `fill`, `lineCap`. Zeichnet sich mit Build `drawLine`. Formwandel per Bewegung `to: { d: "…" }` (auch in `keys`)
  oder per Magic Move zwischen zwei `path` mit gleichem `match` – **beide Formen im selben viewBox** zeichnen.
  `text: { content, style?, fontSize?, color?, offset? (0–100 %), anchor? }` setzt Text auf den Pfad; ohne `stroke`
  bleibt der Pfad unsichtbar. Bewegung `textOffset` lässt den Text den Pfad entlanglaufen.
- `draw` (0–1) in Bewegungen zeichnet Konturen von Pfaden, Linien und Icons an/ab (z. B. `from: { draw: 0 }`).
- Daten-Magic-Move: zwei `chart` gleicher Art mit gleichem `match` auf aufeinanderfolgenden Folien (Übergang
  `magicMove`) – Balken wachsen/schrumpfen, Linien und Flächen verformen sich, Ringsegmente wandern, Werte zählen von
  alt nach neu. Gleiche Anzahl Datenpunkte wirkt am besten; neue Balken wachsen aus der Grundlinie.

## Partikel, Generativ, Shader-Looks, Physik (Phase 8c)

- Element `particles` (WebGL, Bahnen auf der Grafikkarte berechnet – spulbar, auch am iPad flüssig): `preset` `dust`,
  `snow`, `sparks`, `bokeh`, `confetti`, `stars` oder `shape` (setzt sich zu `shape.text` mit `shape.style` oder einem
  Bild `shape.src` zusammen). Optional `count`, `size` (px), `speed`, `colors` (Tokens), `opacity`, `form` (Start 0–1).
  Build `assemble` = Teilchen fügen sich zur Form, als `out` zerfallen sie; Bewegung `form` (0–1) steuert das frei.
  Rahmen = Bereich der Partikel (für Staub/Schnee über die ganze Folie: 0, 0, 1920, 1080).
- Generative Muster (WebGL): Hintergrund `{ "type": "generative", "pattern": … }` oder Element `generative`
  (mit `radius`). `pattern`: `flow` (Strömung), `noise` (Wolken), `waves` (Höhenlinien), `grid` (Perspektiv-Gitter),
  `rings`, `plasma`; `colors` (erste = Grund), `speed`, `scale` (0 groß … 1 fein), `intensity`, `animate`.
- Shader-Looks (SVG-Filter auf echtem HTML): auf der Folie als `effects` `distort` / `chromatic` / `glitch`
  (`amount`, `speed`, bei distort `scale`), am Element als `looks: [{ type, amount, speed?, scale? }]`.
  Übergang `glitch` (Streifen + Farbversatz). Looks kosten auf dem iPad Leistung – für Schule/Uni sparsam.
- Physik: Bewegung mit `physics` `{ gravity?, bounce?, friction?, velocity? { x, y }, spin?, floor?, walls?, collide? }`
  – das Element fällt aus seiner `from`-Lage (x/y/rotate), prallt an Boden (Standard Folienunterkante) und Rändern ab
  und stößt alle Physik-Elemente desselben Schritts an (als Kreise). Vorab berechnet → jedes Mal gleich; Standarddauer
  3 s. Ruhe-Position `frame` = wo es ungefähr liegen bleiben soll (z. B. auf dem Boden).

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
- `src/editor/` – Editor (Zustand/Verlauf in `useEditor.ts`, Arbeitsfläche `Canvas.tsx`, Text auf der Folie
  `TextEditor.tsx`, Inspector, Ebenen,
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

## Studio unterwegs (Phase 7)

- `npm run build:cloud` (`--mode cloud`, `.env.cloud`) baut die gehostete App für Vercel (`vercel.json`, Root `studio`).
  Dort gibt es keinen Dev-Server: `src/api/client.ts` schaltet mit `CLOUD` auf `src/api/cloud/backend.ts` um, das
  dieselbe API über die GitHub-REST-API umsetzt (Dateibaum + Blobs lesen, Contents-API schreiben, ein Commit pro
  Datei). Live-Events ersetzt ein Abgleich alle 15 s (`onCloudEvent`). Speichern im Editor dort nach 2,5 s.
- Der GitHub-Schlüssel liegt **nur auf dem Server**: Vercel-Funktion `api/studio.ts` (Umgebung `GITHUB_TOKEN`,
  `STUDIO_PASSWORD`, optional `STUDIO_REPO`/`STUDIO_BRANCH`/`STUDIO_DIR`). `vercel.json` leitet `/api/<weg>` dorthin.
  Wege: `login` (Passwort → HttpOnly-Cookie, 180 Tage, HMAC mit Passwort+Schlüssel), `logout`, `session`,
  `gh/<pfad>` (GitHub-API, nur freigegebene Pfade: Ref des Branches, Trees/Blobs per SHA, Contents unter `studio/`,
  Schreiben nur auf den eigenen Branch) und `media?path=` (Datei roh, gestreamt). Neue GitHub-Zugriffe der App
  müssen dort in `allowed()` freigegeben werden.
- Medien laufen unterwegs über den Service Worker `public/sw.js` (holt sie über `/api/media`, `?v=<blob-sha>` =
  dauerhaft im Cache, Range-Antworten für Safari-Videos). Datei-URLs deshalb immer über `assetUrl()` bilden.
- Anmeldung: `src/app/CloudLogin.tsx` (nur Passwort), Sitzung in `src/api/cloud/config.ts` (`checkSession` beim Start).
  Uploads unterwegs max. 3 MB (Vercel nimmt pro Anfrage 4,5 MB, base64 +⅓); größere Fotos werden im Browser
  verkleinert.
- Handy-Layout: Media Query in `src/app/DeckView.css` (≤ 760 px oder flaches Touch-Gerät), `.compact-only` für
  Knöpfe nur auf dem Handy. Doppeltippen = Doppelklick (`Canvas.tsx`).
- Was Claude an Decks pusht, erscheint unterwegs nach ≤ 15 s. Was am Handy gespeichert wurde, liegt als Commit
  auf `main` – vor eigenen Änderungen also `git pull`.

## Teilen & Export (Phase 6)

- Web-Player: `server/publish.ts` baut `player.html` + `src/player/main.tsx` mit `base: './'`. Deck, Brand-Kit und
  Theme kommen als Modul `virtual:studio-bundle` fest in den Build (`setBundle` in `src/api/client.ts` ersetzt dann
  die `/api`-Abfragen); benutzte Medien und Schriften werden nach `decks/<name>/…` und `brand/…` kopiert. Datei-URLs
  laufen deshalb immer über `assetUrl()` bzw. `import.meta.env.BASE_URL` – nie fest mit `/` beginnen lassen.
  Der Player ist `Present` mit `player` (keine Referentenansicht, Bedienleiste, Wischen, Folie in der Adresse).
- PowerPoint: `server/pptx.ts` öffnet jede Folie über `#/render/…` (Endzustand) und liest die berechneten Stile.
  Text, Bilder (Raster, auf den Rahmen zugeschnitten), Rechteck/Ellipse/Linie/Pfeil, MP4/MOV-Videos und Notizen
  werden echte Objekte; Hintergründe mit Effekten, SVG, Icons, Charts, Lottie, eigene Komponenten und geneigte
  Elemente werden als Bild (2×) eingebettet. Am Folienende ausgeblendete Elemente fehlen. 1 px = 1/144 Zoll = 0,5 pt.
- Im Editor: Menü „Teilen“ (`src/app/ShareMenu.tsx`) ruft `POST /api/decks/<name>/publish` und
  `GET /api/decks/<name>/export.pptx` auf. `published/` und `exports/` sind nicht im Git.
