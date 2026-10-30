# Studio – Plan für deine eigene Präsentations-App

> Arbeitstitel: **Studio**. Eine Web-App für Präsentationen mit Fokus auf **Motion & Grafik**, gestaltet im Apple-Stil, simpel und clean.
> Claude baut und ändert Präsentationen direkt im Dateiformat. Du bearbeitest sie visuell wie in Keynote/PowerPoint.
> Die App entsteht im Ordner `studio/` dieses Repos. Die bestehende Präsentation (`index.html`) bleibt unberührt.

---

## 1. Deine Entscheidungen (aus den 25 Fragen)

| Bereich | Entscheidung |
|---|---|
| Plattform | Web-App im Browser (läuft lokal auf deinem Mac, später als Link teilbar) |
| Nutzer | Nur du: kein Login, keine Benutzerverwaltung |
| Speicherung | Präsentationen als Dateien im Git-Repo |
| Ort | In diesem Repo, Ordner `studio/` |
| Claude-Rolle | Claude Code ändert die Dateien, die App lädt live neu |
| Format | **JSON mit festem Schema** plus **eigene React/MDX-Komponenten** als Erweiterung |
| Claude-Aufgaben | Ganzes Deck aus Briefing · gezielte Änderungen · neue Templates & Effekte |
| Medien | Eigene Fotos & Videos · Icons & SVG · Lottie / After Effects |
| Editor | Hybrid wie Keynote: Layouts als Start, alles frei verschiebbar |
| Elemente | Text · Bilder & Videos · Formen & Linien · animierte Zahlen & Charts · Icons & SVG |
| Bedienung | Inspector-Seitenleiste **und** schwebende Mini-Toolbar |
| Komfort | Hilfslinien & Einrasten · Ebenen & Gruppen · Master-Folien & Stile |
| Motion-Stil | **Subtil & elegant** |
| Übergänge | Magic Move · Kamerafahrt im Raum · video-artige Übergänge |
| Builds | Klick für Klick + automatische Folge |
| Motion-Tiefe | Presets + Feinschliff (Dauer, Verzögerung, Easing, Richtung) |
| Effekte | Glas & Blur · animierte Verläufe & Licht · Film-Look · 3D & Parallax |
| App-Look | Hell & Dunkel automatisch (folgt macOS) |
| Templates | Themes · Folien-Layouts · komplette Deck-Vorlagen · animierte Bausteine |
| Branding | Ein globales Brand-Kit |
| Schriften | Kuratierte Auswahl + eigene Brand-Fonts |
| Modi | Editor · Präsentation · Folienübersicht · Referentenansicht · Probe-Modus · Handy-Fernbedienung |
| Export | Teilbarer Web-Link · PowerPoint (.pptx) |
| Formate | 16:9 · 4:3 · eigenes Format |
| Vorgehen | Phasen mit frühem MVP |

**Bewusst nicht in Version 1:** Video-Export (MP4), PDF, 9:16/Social-Formate, KI-Panel in der App, Mehrbenutzer, Audio, vollständiges Keynote-Tastaturkürzel-Set (nur die üblichen Grundkürzel wie ⌘Z, ⌘C/⌘V, Entf). Die Architektur hält all das für später offen (siehe Abschnitt 10).

---

## 2. Grundidee: Eine Datei, drei Wege sie zu bearbeiten

```
             ┌────────────────────┐
  Du (Chat) ─┤   Claude Code      ├──┐
             └────────────────────┘  │  schreibt
                                     ▼
                         decks/<name>/deck.json   ◄── die eine Wahrheit
                                     ▲
             ┌────────────────────┐  │  liest & speichert
  Du (Maus) ─┤  Studio-Editor     ├──┘
             └────────────────────┘
                       │ live
                       ▼
               Präsentationsmodus
```

- Die **`deck.json`** ist die einzige Wahrheit. Editor und Claude bearbeiten exakt dieselbe Datei. Dabei geht nichts verloren, und jede Änderung landet im Git-Verlauf.
- Ein kleiner **Datei-Dienst im Dev-Server** liest und speichert Decks direkt auf der Festplatte. Ändert Claude eine Datei, merkt die App das und aktualisiert sich sofort, ohne dass du neu laden musst.
- Für Spezialfälle kann Claude **eigene React-Komponenten** schreiben. Sie erscheinen im Deck wie normale Elemente (siehe Abschnitt 4.3).

**So arbeitest du:** Am besten startest du Claude Code (Desktop-App oder Terminal) auf deinem Mac im Repo-Ordner und lässt `npm run dev` laufen. Dann siehst du jede Änderung von Claude live im Browser. In Cloud-Sessions wie dieser ändert Claude die Dateien und pusht sie, und du holst sie per `git pull`.

---

## 3. Technik (Entscheidung, kurz begründet)

| Baustein | Wahl | Warum |
|---|---|---|
| Grundgerüst | **Vite + React + TypeScript** | Schnell, modern, ideal für Live-Reload und eigene Komponenten |
| Animations-Engine | **GSAP** (Timelines, Flip, SplitText, DrawSVG, MorphSVG, alle Plugins kostenlos) | Timelines lassen sich auf jeden Zeitpunkt spulen. Das brauchen Builds, Referentenansicht, Vorschaubilder und später der Video-Export. |
| UI-Animationen | **Motion** (ehemals Framer Motion) | Federnde Apple-Mikrointeraktionen in der App-Oberfläche |
| Folien-Darstellung | **DOM/CSS** + eine **WebGL-Ebene** für Effekte | Text bleibt gestochen scharf und direkt bearbeitbar. WebGL liefert Verläufe, Grain, Licht usw. |
| Editor-Zustand | **Zustand + Immer** (Undo/Redo über Patches) | Schlank, robust, unbegrenztes Rückgängigmachen |
| Verschieben/Skalieren | **react-moveable** (oder eigene Lösung) | Ziehen, Skalieren, Drehen, Einrasten, Hilfslinien und Gruppen sind schon gelöst |
| Rich-Text | **Tiptap** (minimal: fett, kursiv, Farbe, Link) | Texte direkt auf der Folie bearbeiten, das JSON bleibt sauber |
| Schema | **Zod** → generiertes `deck.schema.json` | Eine Quelle für Typen, Validierung und Claudes Regelwerk |
| Lottie | **lottie-web** (über die Timeline gesteuert) | Läuft synchron mit Builds und lässt sich spulen |
| Charts | Eigene SVG-Charts (d3-scale/d3-shape) | Volle Kontrolle über elegante Aufbau-Animationen |
| PPTX-Export | **PptxGenJS** | Bewährt und läuft komplett im Browser |
| Qualitätskontrolle | **Playwright** (Screenshots jeder Folie) | Claude kann *sehen*, was es gebaut hat, und Fehler selbst korrigieren |

---

## 4. Das Dateiformat

### 4.1 Ordnerstruktur

```
studio/
├── PLAN.md                ← dieses Dokument
├── STYLE.md               ← deine Stil-Bibel (Motion, Typo, Farben, Dos & Don'ts)
├── CLAUDE.md              ← Regeln für Claude: Format, Stil, Pflicht-Checks
├── package.json
├── src/
│   ├── app/               ← App-Rahmen, Modi, Routing
│   ├── editor/            ← Arbeitsfläche, Auswahl, Inspector, Toolbar, Ebenen
│   ├── engine/            ← Renderer, Timeline, Builds, Übergänge, Magic Move, Kamera
│   ├── elements/          ← Text, Bild, Video, Form, Icon, Chart, Zahl, Lottie, Custom
│   ├── effects/           ← WebGL- und CSS-Effekte
│   ├── present/           ← Präsentation, Referentenansicht, Probe, Fernbedienung
│   ├── export/            ← Web-Player-Build, PPTX
│   ├── schema/            ← Zod-Schemas (→ deck.schema.json)
│   └── ui/                ← App-Designsystem im Apple-Look
├── custom/                ← eigene React/MDX-Komponenten (Erweiterung)
├── brand/                 ← brand.json, Logo, eigene Schriften
├── templates/
│   ├── themes/            ← Farben + Schriften + Motion-Charakter
│   ├── layouts/           ← Titel, Zitat, Vollbild-Bild, Zahlen, Vergleich …
│   ├── decks/             ← komplette Vorlagen (Portfolio, Angebot, Pitch, Vortrag)
│   └── blocks/            ← animierte Bausteine (Logo-Reveal, Intro, Counter …)
├── decks/
│   └── mein-deck/
│       ├── deck.json
│       └── assets/        ← Fotos, Videos, Lottie, SVG dieser Präsentation
└── scripts/               ← validate, screenshots, publish, export
```

### 4.2 So sieht eine Präsentation aus (vereinfacht)

```json
{
  "$schema": "../../src/schema/deck.schema.json",
  "version": 1,
  "title": "Portfolio 2027",
  "format": { "preset": "16:9", "width": 1920, "height": 1080 },
  "theme": "aurora",
  "slides": [
    {
      "id": "intro",
      "layout": "title",
      "master": "dark-hero",
      "background": { "type": "meshGradient", "preset": "aurora", "animate": true },
      "effects": [{ "type": "grain", "amount": 0.15 }, { "type": "vignette", "amount": 0.3 }],
      "transition": { "type": "magicMove", "duration": 900, "easing": "smooth" },
      "world": { "x": 0, "y": 0, "z": 0 },
      "elements": [
        {
          "id": "headline",
          "match": "headline",
          "type": "text",
          "style": "title",
          "content": "Licht. Bewegung. Geschichte.",
          "frame": { "x": 160, "y": 420, "w": 1600, "h": 240 },
          "build": { "in": { "preset": "blurRise", "duration": 800, "delay": 0 }, "trigger": "click" }
        },
        {
          "id": "reel",
          "type": "video",
          "src": "assets/reel.mp4",
          "frame": { "x": 0, "y": 0, "w": 1920, "h": 1080 },
          "depth": -1,
          "fit": "cover",
          "playback": { "autoplay": true, "loop": true, "muted": true }
        }
      ],
      "notes": "Kurze Pause nach dem Titel."
    }
  ]
}
```

Die wichtigsten Konzepte:
- **`frame`** in festen logischen Pixeln (z. B. 1920×1080). Die App skaliert das automatisch auf jeden Bildschirm.
- **`match`**: Elemente mit gleichem `match` auf zwei aufeinanderfolgenden Folien fließen per **Magic Move** ineinander.
- **`build`**: Ein- und Ausblend-Animationen pro Element, ausgelöst per Klick, *mit vorherigem* oder *nach vorherigem*.
- **`world`**: Die Position der Folie im Raum. Daraus berechnet die App die **Kamerafahrt**.
- **`depth`**: Die Tiefe für **Parallax**- und 3D-Effekte.
- **`master` / `style`**: Verweise auf Master-Folien und Textstile. Änderst du einen Stil, ändern sich alle Stellen, die ihn nutzen.
- Farben und Schriften verweisen auf **Tokens** aus dem Brand-Kit (`"color": "brand.accent"`), nicht auf feste Werte.

### 4.3 Erweiterung: eigene Komponenten (React/MDX)

Wenn das Schema etwas nicht abdeckt, schreibt Claude eine Komponente:

```json
{ "id": "strip", "type": "custom", "component": "FilmStrip",
  "props": { "images": ["assets/a.jpg", "assets/b.jpg"], "speed": 0.4 },
  "frame": { "x": 0, "y": 600, "w": 1920, "h": 360 } }
```

- Die Datei liegt in `studio/custom/FilmStrip.tsx` und exportiert drei Dinge: die **Komponente**, ein **Props-Schema** (damit der Inspector automatisch passende Regler zeigt) und **Editor-Metadaten** (Name, Icon, Standardgröße).
- Die Komponente bekommt `step`, `progress` und `mode` (edit/present) übergeben. So bleibt sie synchron mit Builds, Referentenansicht und Vorschau.
- Im Editor verschiebst und skalierst du sie wie jedes andere Element.
- Für textlastige Spezialfolien ist optional **MDX** möglich (`"type": "mdx"`).
- Bewährt sich eine Komponente, kann Claude sie zu einem festen Elementtyp oder animierten Baustein machen.

---

## 5. Motion & Grafik: das Herzstück

### 5.1 Stil-Grundsatz
**Subtil & elegant als Grundton.** Die filmischen Werkzeuge (Film-Look, Light Leaks, Whip-Pan, Kamerafahrt) gibt es, aber ihre Voreinstellungen sind bewusst *zurückhaltend*: wenig Grain, weiche Lichtkanten, kurze und ruhige Fahrten. Ein globaler **Intensitäts-Regler** pro Deck (Ruhig ↔ Filmisch) skaliert alle Effekte gemeinsam.

Diese Regeln landen in `STYLE.md`, und Claude hält sich daran:
- Pro Moment trägt **eine** Hauptbewegung, der Rest unterstützt sie oder bleibt ruhig.
- Federn statt Bouncen: kein sichtbares Überschwingen über ~2 %.
- Video-artige Übergänge setzt du an **Kapitelwechseln** ein, nicht zwischen jeder Folie.
- Bewegung folgt der Lese-Richtung und der Hierarchie (erst Headline, dann Detail).

### 5.2 Motion-Tokens

| Token | Wert (Startwert) | Einsatz |
|---|---|---|
| `fast` | 250 ms | Kleine Details, Ausblenden |
| `base` | 500 ms | Standard-Builds |
| `slow` | 800 ms | Headlines, Bilder |
| `cinematic` | 1400 ms | Kamerafahrten, große Reveals |
| `smooth` | Apple-artige Kurve `cubic-bezier(0.32, 0.72, 0, 1)` | Standard |
| `spring` | Feder, kritisch gedämpft | Magic Move, Skalierungen |
| `stagger` | 60–90 ms | Aufbau von Listen, Wörtern, Chart-Balken |

### 5.3 Build-Presets (innerhalb einer Folie)
Jedes Preset bietet Feinschliff für **Dauer, Verzögerung, Easing und Richtung**.

| Preset | Beschreibung |
|---|---|
| Fade | Weiches Ein- und Ausblenden |
| Rise | Leicht von unten nach oben und dabei einblenden |
| Blur-Rise | Wie Rise, aus der Unschärfe heraus (Signature-Look) |
| Scale-In | Wächst sanft aus ca. 96 % |
| Mask-Reveal | Wird hinter einer Kante oder Form hervor aufgedeckt |
| Wort für Wort / Zeile für Zeile | Text baut sich elegant gestaffelt auf |
| Linie zeichnen | SVG-Konturen zeichnen sich (Icons, Formen, Pfeile) |
| Hochzählen | Zahlen zählen auf ihren Zielwert hoch |
| Chart-Aufbau | Balken wachsen, Linien zeichnen sich, Donuts füllen sich |
| Ken Burns | Langsamer Zoom/Schwenk auf Fotos |
| Schweben (Idle) | Minimale Dauerbewegung für Tiefe (mit Parallax) |
| Lottie abspielen | Lottie-Animation startet, stoppt oder springt zu einem Marker |

### 5.4 Übergänge (zwischen Folien)

| Übergang | Umsetzung |
|---|---|
| **Magic Move** | Elemente mit gleichem `match` interpolieren Position, Größe, Drehung, Farbe, Deckkraft, Eckenradius und Schriftgröße. Alles andere blendet weich über. Weil das direkt aus den JSON-Daten berechnet wird, ist es präziser als die DOM-Messung bei Keynote-Klonen. |
| **Kamerafahrt im Raum** | Alle Folien liegen in einer gemeinsamen „Welt“. Die Kamera fliegt mit 3D-Perspektive und leichter Tiefenunschärfe von einer Position zur nächsten. In der Folienübersicht ordnest du die Folien in der Ansicht **„Raum“** frei an. |
| **Mask-Reveal** | Die neue Folie wird durch eine wachsende Form, einen Textschnitt oder eine Kante aufgedeckt (CSS-Masken, GPU-schonend). |
| **Light Leak** | Ein Lichtschimmer läuft über den Schnitt. Das ist ein Overlay mit Screen-Blending, aus prozeduralem WebGL oder echten Light-Leak-Clips, genau wie im Videoschnitt. |
| **Whip-Pan** | Ein schneller Schwenk mit Bewegungsunschärfe in Richtung der nächsten Folie. |
| **Blur-Dissolve** | Überblendung durch die Unschärfe, ruhig und edel. Gut als Standard-Übergang. |
| Dissolve / Push / Zoom | Die Basis-Übergänge, sauber umgesetzt. |

> Technischer Kniff: Die video-artigen Übergänge arbeiten mit **Overlays und Masken** statt mit Screenshots der Folien. Dadurch laufen Videos und Animationen auch *während* des Übergangs weiter, und alles bleibt flüssig.

### 5.5 Grafik-Effekte

| Effekt | Umsetzung |
|---|---|
| **Glas & Blur** | Milchglas-Flächen (`backdrop-filter`), Hintergrundunschärfe, weiche, mehrlagige Schatten |
| **Animierte Mesh-Gradients** | WebGL-Shader mit fließenden Verläufen in deinen Brand-Farben |
| **Glow & Licht-Sweep** | Leuchtende Kanten und ein Lichtstreifen, der über Text oder Objekte gleitet |
| **Grain** | Feines, animiertes Filmkorn (WebGL) |
| **Vignette** | Weiche Randabdunklung |
| **Letterbox** | Kino-Balken, die bei Bedarf ein- und ausfahren |
| **Farblooks** | Color-Grading-Presets pro Folie oder Bild (warm, kühl, Teal & Orange, entsättigt …) |
| **3D-Neigung** | Ebenen leicht im Raum gekippt, mit Perspektive |
| **Parallax** | Ebenen bewegen sich je nach `depth` unterschiedlich schnell, bei Kamerafahrten und im Idle-Schweben |

Leistungsziel: **60 fps** auf deinem Mac. Alle Effekte laufen auf einer gemeinsamen WebGL-Fläche, und die nächste Folie wird vorab geladen.

---

## 6. Die App: Aufbau & Look

### 6.1 Apple-Stil
- Systemschrift (SF auf dem Mac), 8-pt-Raster, feine Haarlinien, Eckenradius 10–12 px.
- Halbtransparente Seitenleisten mit Unschärfe (wie macOS-Seitenleisten).
- Ruhige, schlanke Icons (1,5 px Strich).
- **Hell & Dunkel automatisch** nach Systemeinstellung. Die Folien selbst haben ihr eigenes Theme.
- Kurze, federnde Mikroanimationen in der Oberfläche, nie verspielt.
- Wenig Chrome: Werkzeuge erscheinen dort, wo du sie brauchst.

### 6.2 Fensteraufbau (Editor)

```
┌──────────────────────────────────────────────────────────────────┐
│  ◀ Decks     Text  Form  Medien  Chart  Baustein      ▶ Abspielen │  ← Toolbar
├─────────┬──────────────────────────────────────────┬─────────────┤
│ Folie 1 │                                          │ Stil        │
│ Folie 2 │            ┌────────────────┐            │ Animation   │
│ Folie 3 │            │     Folie      │ ◄ Mini-    │ Folie       │
│   …     │            └────────────────┘   Toolbar  │             │
│         │                                          │ (Inspector) │
│ Ebenen ▾│                                          │             │
└─────────┴──────────────────────────────────────────┴─────────────┘
```

- **Links:** Folien-Navigator, darunter einklappbar die **Ebenen**-Liste (gruppieren, sperren, ausblenden, sortieren).
- **Mitte:** Arbeitsfläche mit **Hilfslinien & Einrasten** (Mitte, Ränder, Nachbarelemente, gleiche Abstände).
- **Mini-Toolbar** am ausgewählten Element für das Schnelle: Schrift, Farbe, Ausrichtung, Animation.
- **Rechts:** Inspector mit drei Tabs: **Stil** (Aussehen), **Animation** (Builds, Reihenfolge, Feinschliff, Vorschau), **Folie** (Hintergrund, Effekte, Übergang, Master, Notizen).

### 6.3 Modi

| Modus | Inhalt |
|---|---|
| **Decks** | Startseite mit all deinen Präsentationen und „Neu aus Vorlage“ |
| **Editor** | Siehe oben |
| **Folienübersicht** | Raster aller Folien mit Drag & Drop, Duplizieren und Überspringen. Umschaltbar auf **Raum**, um Folien für Kamerafahrten anzuordnen. |
| **Präsentation** | Vollbild, Pfeiltasten, Leertaste und Presenter-Clicker. Videos und Effekte laufen live. |
| **Referentenansicht** | Zweites Fenster bzw. zweiter Bildschirm: aktuelle und nächste Folie bzw. nächster Build, Notizen, Uhr und Timer |
| **Probe-Modus** | Du sprichst den Vortrag durch, und die App misst die Zeit pro Folie und zeigt deine Ziel- gegenüber der Ist-Zeit |
| **Handy-Fernbedienung** | QR-Code scannen, dann weiterschalten, Notizen und Timer auf dem iPhone. Läuft über dein WLAN. |

---

## 7. Templates & Brand-Kit

- **Brand-Kit** (`brand/brand.json`): deine Farben (als Tokens), Schriften (kuratiert + eigene `.woff2/.otf`), Logo-Varianten und die Motion-Grundintensität. Alle Themes und Vorlagen nutzen es automatisch.
- **Themes:** Je ein Paket aus Farbrollen, Typografie-Skala, Hintergründen, Effekt-Defaults und Motion-Charakter. Start mit 3–4 Themes, z. B.:
  - *Aurora*: dunkel, fließende Mesh-Gradients, Glas-Elemente
  - *Paper*: hell, viel Weißraum, edle Serif-Headlines
  - *Cinema*: schwarz, Letterbox, Grain, große Typo
  - *Studio*: neutral-grau, sachlich, für Angebote
- **Folien-Layouts:** Titel, Kapitel, Statement/Zitat, Vollbild-Bild/Video, Bild + Text, Galerie, Große Zahl, Chart, Vergleich, Timeline/Ablauf, Team/Über mich, Kontakt/Abschluss.
- **Komplette Deck-Vorlagen:** Portfolio/Showreel, Kundenangebot, Pitch, Vortrag/Workshop.
- **Animierte Bausteine:** Logo-Reveal, Intro-Sequenz, Kapitel-Trenner, Zahlen-Counter, Bildergalerie im Fluss, Zitat-Reveal, Abspann.
- **Schriften:** Eine kuratierte Auswahl frei nutzbarer Schriften (z. B. Inter / Inter Display als SF-ähnliche Grotesk, dazu 1–2 edle Serifen) und deine eigenen Fonts. SF Pro selbst ist für geteilte Web-Links nicht lizenzierbar. Lokal auf dem Mac kann es als Systemschrift genutzt werden.

---

## 8. Wie Claude für dich baut

1. **`CLAUDE.md`** im Repo beschreibt Format, Bausteine, Stilregeln und Pflicht-Checks. Jede Claude-Session weiß damit sofort, wie Studio funktioniert.
2. **`STYLE.md`** ist deine Stil-Bibel. Wir füllen sie gemeinsam und schärfen sie mit jeder Präsentation nach.
3. **Projekt-Skill `/deck`**: Du gibst ein Briefing (Stichpunkte, Text, Ziel, Publikum, Dauer). Claude wählt Theme und Layouts, schreibt die `deck.json`, setzt Builds und Übergänge und prüft das Ergebnis.
4. **Gezielte Änderungen** in natürlicher Sprache: „Folie 4 ruhiger“, „Kamerafahrt zwischen Kapitel 2 und 3“, „Zahlen hochzählen lassen“.
5. **Neue Templates & Effekte:** Claude erweitert `templates/`, `custom/` und die Effekt-Bibliothek im selben Stil.
6. **Pflicht-Checks nach jeder Änderung:**
   - `npm run validate`: Die Datei entspricht dem Schema, alle Assets existieren, alle `match`-Paare sind gültig.
   - `npm run shots`: Playwright rendert jede Folie (auch Build-Zwischenstände) als Bild. Claude schaut sie sich an und korrigiert Überlappungen, Lesbarkeit und Abstände selbst.

---

## 9. Phasenplan

Jede Phase endet mit etwas, das du **wirklich benutzen** kannst.

### Phase 0: Fundament ✅ erledigt
- Projekt in `studio/` aufsetzen (Vite, React, TypeScript, Linting)
- Deck-Schema v1 (Zod → `deck.schema.json`) und `npm run validate`
- Datei-Dienst im Dev-Server: Decks laden und speichern, Live-Reload bei Änderungen von außen
- App-Designsystem: Tokens, Hell/Dunkel, Grundkomponenten
- `CLAUDE.md`, erste Fassung von `STYLE.md`, Brand-Kit-Gerüst
- **Ergebnis:** Eine von Claude geschriebene `deck.json` erscheint sofort im Browser.
- *Umgesetzt:* Schema v1 mit strikter Prüfung (Tippfehler, doppelte IDs, fehlende Dateien, unbekannte Brand-Farben),
  Datei-API mit atomarem Speichern, Live-Updates (ungültige Dateien zeigen den letzten gültigen Stand plus Hinweis),
  Deck-Übersicht, Deck-Ansicht mit Navigator und Inspector, Notizen werden direkt in die `deck.json` gespeichert,
  statischer Renderer inkl. CSS-Vorschau von Grain, Vignette, Letterbox und Farblooks, Beispiel-Deck `decks/willkommen`.

### Phase 1: MVP: Bauen & Präsentieren ✅ erledigt
- Renderer: Text, Bild, Video, Form, Linie, Icon/SVG; Skalierung auf 16:9, 4:3 und eigene Formate
- Builds (Klick + automatische Folge) mit den ersten Presets: Fade, Rise, Blur-Rise, Scale-In, Mask-Reveal, Wort für Wort
- Übergänge: Blur-Dissolve, Push und **Magic Move v1**
- Präsentationsmodus im Vollbild (Tastatur und Clicker)
- Basis-Editor: auswählen, verschieben, skalieren, Text direkt bearbeiten, Inspector-Grundfunktionen, Undo/Redo, Speichern in die Datei
- Ein Theme und ca. 6 Layouts, Brand-Kit mit deinen Farben, Logo und Schriften
- Erste Version der Erweiterung über eigene Komponenten (`custom/`)
- `npm run shots` für Claudes visuelle Kontrolle
- **Ergebnis:** Claude baut aus einem Briefing ein Deck, du feilst im Editor nach und hältst den Vortrag damit.
- *Umgesetzt:* GSAP-Timeline-Engine (Klick/Automatik-Schritte, 10 Presets inkl. Wort für Wort, Hochzählen, Linie zeichnen),
  Übergänge Blur-Dissolve, Dissolve, Push, Zoom, Kreis-Reveal, Whip-Pan und Magic Move (misst die sichtbare Textkante),
  Präsentationsmodus (Vollbild, Tastatur/Clicker, Schwarzbild, Ende-Bildschirm), Editor (Auswahl, Ziehen, Skalieren,
  Text direkt bearbeiten, Inspector mit Stil/Animation/Folie, Undo/Redo, Autosave, Kopieren/Einfügen, Folien aus Layouts,
  duplizieren, löschen, Vorschau), Theme `silber`, 8 Layouts, Lucide-Icons, eigene Komponenten (`custom/FilmStrip.tsx`),
  `npm run shots`. Bewusst nach Phase 2 verschoben: Mehrfachauswahl und Drehen per Griff.

### Phase 2: Editor wie Keynote ✅ erledigt
- Hilfslinien & Einrasten, Mehrfachauswahl, Drehen
- Ebenen-Liste, Gruppieren, Sperren, Ausblenden
- Schwebende Mini-Toolbar
- Master-Folien & Textstile (eine Änderung wirkt überall)
- Folienübersicht als Raster (Drag & Drop, Duplizieren, Überspringen)
- Medien-Bibliothek: Dateien per Drag & Drop importieren, automatische Optimierung (Bildgrößen, Video-Posterbilder)
- Eigene Schriften hochladen
- Animations-Tab: Reihenfolge der Builds, Feinschliff und Vorschau
- *Umgesetzt:* Mehrfachauswahl per ⇧-Klick, Auswahlrahmen und ⌘A; gemeinsames Verschieben/Skalieren; Drehgriff
  (⇧ = 15°, rastet bei 0/90/180° ein); Einrasten an Folienrändern/-mitte und an Kanten/Mitten anderer Elemente mit
  roten Hilfslinien und Positions-/Größenanzeige (⌘ = frei); ⌥-Ziehen kopiert. Ausrichten und Verteilen, Ebenen
  nach vorne/hinten. Ebenen-Liste im Navigator (Drag & Drop, Umbenennen, Auge/Schloss, Gruppen-Kopfzeilen).
  Gruppen über `group` (ändern die Ebenen-Reihenfolge nicht). Mini-Toolbar mit Textstil, Ausrichtung, Farbe, Build,
  Gruppieren, Duplizieren, Löschen. Master-Folien (`masters`, eigener Master-Modus, „Neuer Master aus Folie“ übernimmt
  Hintergrund, Effekte und ausgewählte Elemente). Deck-Textstile (`textStyles`) mit „Stil aktualisieren“ am Text.
  Folienübersicht als Raster mit Größenregler; Folien auch im Navigator per Drag & Drop sortierbar. Medien-Bibliothek
  (Deck + Brand-Kit) mit Import per Drag & Drop auf Bibliothek oder Folie, Bild-Optimierung im Browser (max. 3840 px,
  JPEG bzw. WebP bei Transparenz), Video-Posterbild, Limit 100 MB, Ersetzen und Löschen ungenutzter Dateien. Schriften
  hochladen mit Vorschau, Familie/Gewicht aus dem Dateinamen erkannt. Build-Liste per Drag & Drop sortierbar
  (`build.order`), Start direkt in der Liste, Vorschau ab jedem Klick.
  Bewusst offen: Gleich-Abstands-Hilfslinien beim Ziehen, Drehen mehrerer Elemente auf einmal, Git LFS für große
  Videos (bisher genügt das 100-MB-Limit).

### Phase 3: Motion- & Grafik-Engine ✅ erledigt
- WebGL-Effektebene: Mesh-Gradients, Glow/Licht-Sweep, Grain, Vignette, Letterbox, Farblooks
- Glas & Blur, 3D-Neigung, Parallax über `depth`, Idle-Schweben
- **Kamerafahrt im Raum** und die Ansicht „Raum“ in der Folienübersicht
- Video-artige Übergänge: Mask-Reveal, Light Leak, Whip-Pan
- Magic Move v2 (Farben, Radien, Schriftgrößen, Text-Überblendung)
- Neue Elemente: animierte Zahlen, Charts (Balken, Linie, Donut), Lottie, SVG-Linien zeichnen
- Globaler Intensitäts-Regler (Ruhig ↔ Filmisch)
- *Umgesetzt:* WebGL-Shader für Licht-Verlauf (organisch, mit Dithering gegen Banding), Filmkorn (24 fps), Licht-Sweep
  und Light Leak; Glas (backdrop-filter), 3D-Neigung, Parallax bei Kamerafahrten und Schweben; Kamerafahrt mit
  Raum-Ansicht (Ziehen, Linie/Raster/Kreis, „Alle als Kamerafahrt“); Magic Move v2 (Formen/Bilder morphen ohne
  Verzerrung, Farbe und Rundung inklusive); Charts (Balken, Linie, Ring) mit Build „grow“; Lottie mit Start beim Build;
  Deck-Intensität. Farblooks bleiben als CSS-Filter (WebGL-LUTs bräuchten ein Rendern der Folie in eine Textur).

### Phase 4: Bühne ✅ erledigt
- Referentenansicht (zweites Fenster, synchronisiert)
- Probe-Modus mit Zeitmessung pro Folie
- Handy-Fernbedienung per QR-Code im WLAN
- *Umgesetzt:* Show-Kanal über die Live-Verbindung des Dev-Servers (alle Fenster und Geräte im WLAN), Referentenansicht
  mit aktueller/nächster Folie im genauen Klick-Zustand, Notizen (Schriftgröße einstellbar), Uhr, Timer, Ziel-Fortschritt,
  „Publikum öffnen“ (Chrome: automatisch auf den zweiten Bildschirm), Probe-Modus mit Zeiten pro Folie, Vergleich zur
  letzten Probe und Ziel in Minuten (`rehearsal.json`), Handy-Fernbedienung mit QR-Code, Notizen, Schwarzbild,
  Vibration und wach bleibendem Bildschirm. Ein Knopf im Editor folgt nach dem Merge von Phase 2 (Taste R im
  Präsentationsmodus geht schon).

### Phase 5: Templates & Bibliothek ✅ erledigt
- 3–4 Themes, vollständige Layout-Bibliothek
- 4 Deck-Vorlagen: Portfolio/Showreel, Kundenangebot, Pitch, Vortrag
- Animierte Bausteine: Logo-Reveal, Intro, Kapitel-Trenner, Counter, Galerie, Abspann
- Projekt-Skill `/deck` fertig ausgebaut, Erweiterungsmechanismus voll dokumentiert
- *Umgesetzt:* Themes `silber`, `kino` (schwarz, Kinobalken, Korn), `sachlich` (Graphit, ohne Effekte) und `papier`
  (hell). Themes dürfen die Brand-Palette umstellen (`colors`) – die Farben laufen dafür über einen Kontext statt
  `:root`, damit WebGL-Verläufe und mehrere Decks nebeneinander stimmen. 16 Layouts (neu: Agenda, Zitat, Galerie,
  Chart, Vergleich, Ablauf, Über mich, Kontakt; Logos als Icon in Textfarbe, damit sie in jedem Theme sichtbar sind).
  6 Bausteine (`templates/blocks/`, eigenes Schema) mit animierter Vorschau beim Darüberfahren im Editor – Folien-
  Bausteine kommen als neue Folie, Element-Bausteine als Gruppe auf die aktuelle Folie. 4 Deck-Vorlagen
  (`templates/decks/`) aus den Layouts zusammengesetzt; Startseite mit „Neues Deck“ (leer mit Theme oder aus Vorlage).
  Theme-Wechsel im Inspector setzt Hintergründe/Effekte passend neu. `npm run validate` prüft auch Bausteine und
  Vorlagen. Skill `/deck` unter `.claude/skills/deck/`, Erweiterungen in `EXTENDING.md`.

### Phase 6: Teilen & Export
- **Web-Link:** `npm run publish <deck>` baut einen eigenständigen Player (nur Ansehen, mit Animationen) und veröffentlicht ihn, z. B. über GitHub Pages, Netlify oder Vercel
- **PowerPoint-Export:** Text, Bilder, Formen und Notizen als echte PPTX-Objekte. Effekte und Verläufe werden als Bilder eingebettet, Animationen gehen dabei verloren (das ist eine Grenze des Formats).

---

## 10. Später möglich (Architektur ist vorbereitet)
- **Video-Export (MP4)**: Weil die Timeline spulbar ist, lässt sich jede Folie Bild für Bild rendern.
- **PDF-Export**: Fällt fast nebenbei aus dem Screenshot-Werkzeug ab.
- **9:16 / 4:5 / 1:1** für Social Media, zusammen mit dem Video-Export.
- **KI-Panel direkt in der App** (Claude API).
- **Audio**: Hintergrundmusik und dezentes Sound-Design.
- **Fernbedienung über das Internet** (nicht nur im WLAN), wenn du über einen geteilten Link präsentierst.
- **Mac-App** (Tauri) aus derselben Codebasis.

---

## 11. Risiken & offene Punkte

| Thema | Umgang |
|---|---|
| **Große Videos im Git-Repo** | GitHub erlaubt max. 100 MB pro Datei, und das Repo wird schnell schwer. Empfehlung: Rohmaterial bleibt außerhalb, ins Repo kommen nur optimierte Web-Versionen. Für große Dateien ist **Git LFS** sinnvoll. Stand Phase 2: Der Import lehnt Videos über 100 MB ab und erklärt warum; Git LFS richten wir ein, sobald echte große Clips anfallen. |
| **Web-Links sind öffentlich** | Wer den Link hat, sieht die Präsentation. Ein Passwortschutz ist z. B. über Netlify/Vercel möglich. Das entscheiden wir in Phase 6. |
| **Eigene Komponenten** | Sie sind im Editor nur über ihre Regler bearbeitbar, nicht frei gestaltbar. Deshalb: das Schema zuerst, Komponenten nur für echte Spezialfälle. |
| **PPTX verliert Motion** | Das ist eine Grenze des Formats. Der Web-Link ist die „echte“ Version. |
| **Handy-Fernbedienung** | Funktioniert in Phase 4 nur, wenn Handy und Mac im selben WLAN sind. |
| **Vorhandene Präsentation** | `index.html` im Repo-Root bleibt unverändert. Studio lebt komplett in `studio/`. |

---

## 12. Was ich von dir brauche, um zu starten
1. **Node.js** auf deinem Mac (für `npm run dev`). Ich kann dich bei der Einrichtung anleiten.
2. **Brand-Material**: Logo (SVG), deine Farben und deine Schriften, falls vorhanden.
3. **Ein echtes erstes Deck-Thema** als Testprojekt für Phase 1, z. B. dein Portfolio oder ein Kundenangebot.
4. **2–3 Referenzen**, deren Look oder Motion dir gefällt (Präsentationen, Websites, Videos). Daraus entsteht die erste `STYLE.md`.
