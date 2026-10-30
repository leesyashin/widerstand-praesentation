# Stil-Bibel

> Erste Fassung. Wird mit jeder Präsentation geschärft – mit deinen Referenzen, deinem Logo, deinen Farben.
> Claude hält sich beim Bauen von Decks an diese Regeln.

## Haltung

**Subtil & elegant.** Ruhig, präzise, hochwertig – wie eine Apple-Keynote, mit dem Blick eines Filmemachers.
Filmische Mittel (Grain, Light Leaks, Kamerafahrten, Letterbox) sind Gewürz, nicht Hauptgericht.

## Brand-Kit (festgelegt)

| Bereich | Wahl | Umsetzung |
|---|---|---|
| Farbpalette | **Silbergelatine** | Schwarzweiß mit warmem Silberton (`brand/brand.json`) |
| Schriftpaar | **Charakter-Grotesk** | Bricolage Grotesque (Headlines) + DM Sans (Text), lokal in `brand/fonts/` |
| Logo | **Sucher** | „VINCENT“ in Sucher-Ecken: `brand/logo.svg` (hell), `brand/logo-mono.svg` (einfarbig) |
| Motion | **Seide** | Signature-Build `blurRise`, Standard-Übergang `blurDissolve` |
| Signature-Effekt | **Licht-Verlauf** | Langsam fließender Mesh-Gradient in Silbertönen |

## Themes

| Theme | Charakter | Wofür |
|---|---|---|
| `silber` | Dunkel, Licht-Verlauf in Silbertönen – das Signature-Theme | Pitch, Standard |
| `kino` | Tiefschwarz, Kinobalken, Filmkorn, große Typo | Showreel, Portfolio |
| `sachlich` | Graphit, klare Typo, keine Effekte | Angebote, Arbeitsstände |
| `papier` | Hell, Papierweiß, dunkle Schrift, viel Weißraum | Vorträge, Workshops |

Pro Deck ein Theme. Die Regeln unten gelten für alle; „dunkel/hell“ meint dann die Rollen (`brand.background`,
`brand.text`), die das Theme mit Farben belegt.

## Komposition

- **Eine Idee pro Folie.** Lieber eine Folie mehr als eine volle Folie.
- **Großzügiger Weißraum.** Ränder mindestens 160 px links/rechts und 120 px oben/unten (bei 1920×1080).
- **Starke Hierarchie:** eine klare Hauptaussage, alles andere ordnet sich unter.
- Raster: 12 Spalten, Abstände in Vielfachen von 8 px (bevorzugt 40, 48, 80, 120).
- Bilder und Videos dürfen randlos sein – Text darüber nur mit ausreichend Kontrast (Verlauf, Vignette, Glas).
- Höchstens ~30 Wörter Fließtext pro Folie. Zahlen groß, Erklärung klein.

## Typografie

- Headlines: `display` oder `title`, enge Laufweite, kurze Zeilen (max. 2–3 Zeilen).
- Kleine Labels (`label`) in Versalien mit weiter Laufweite – sparsam, als Kicker über Headlines.
- Fließtext: `body`, gedeckte Farbe (`brand.textMuted`) für Nebeninformation.
- Bricolage Grotesque hat viel Charakter: nur für Headlines und große Zahlen, nie für Fließtext.
- Kursiv für Betonung oder Zitate, nicht fett im Fließtext.
- Keine Silbentrennung in Headlines, keine Hurenkinder (Einzelwort in letzter Zeile).

## Farbe

- Grundton dunkel (`brand.background` #0b0b0c) mit hellem Text (`brand.text`); helle Folien
  (`brand.light` + `brand.ink`) als bewusster Kontrast, z. B. für Kapitel oder den Abschluss.
- Der Akzent ist **Silber** (`brand.accent` #e4ddcc), kein Signalfarbton: für Kicker, feine Linien, Logo-Ecken,
  Hervorhebungen. Auf hellen Folien ist er unsichtbar – dort `brand.ink` nehmen.
- `brand.accent2` (dunkles Graphit) nur in Verläufen und Licht.
- Farbige Fotos und Videos bei Bedarf mit `colorLook: "mono"` ins Brand holen. Farbe ist erlaubt, wenn sie
  der Inhalt ist (Kundenarbeit, Farbstimmung) – dann bewusst und folienweise.
- Verläufe weich und langsam, nie grell.

## Logo

- Auf dunklen Folien `brand/logo.svg` als Bild, auf hellen `brand/logo-mono.svg` als Icon mit `"color": "brand.ink"`.
- Seitenverhältnis ca. 3,9 : 1 (z. B. 234 × 60). Position bevorzugt unten links (x 160, y 930) oder zentriert auf
  Titel- und Schlussfolien. Nicht auf jeder Folie – Titel, Kapitel, Abschluss genügen.
- Das Logo ist eine Arbeitsversion aus DM Sans; Feinschliff (Kerning, eigene Zeichnung) ist jederzeit möglich.

## Motion

| Regel | Umsetzung |
|---|---|
| Eine Hauptbewegung pro Moment | Der Rest steht oder folgt gestaffelt (Stagger 60–90 ms) |
| Federn statt Bouncen | `smooth` als Standard, `spring` für Magic Move und Skalierung, kein sichtbares Überschwingen |
| Ruhige Dauer | `base` 500 ms für Builds, `slow` 800 ms für Headlines/Bilder, `cinematic` 1400 ms nur für Kamerafahrten |
| Lese-Richtung | Erst Headline, dann Detail. Bewegungen von unten nach oben oder links nach rechts |
| Signature-Build („Seide“) | `blurRise` für Headlines und Bilder, `rise` für Karten und Listen, `maskReveal` für Zitate |
| Übergänge | Standard `blurDissolve` oder `magicMove`. `camera`, `lightLeak`, `whipPan` nur an **Kapitelwechseln** |
| Builds pro Folie | Möglichst ≤ 4 Klicks. Zusammengehöriges mit `withPrevious` gruppieren |

## Effekte

- **Signature: Licht-Verlauf.** Titel- und Kapitel-Folien bekommen den Mesh-Gradient aus `brand.signature.background`
  (Silbertöne, `animate: true`). Auf Inhaltsfolien ruhige Flächen (`brand.background`).
- Grain: 0.08–0.15. Vignette: 0.2–0.4. Letterbox nur für Bild-/Video-Momente.
- Licht-Sweep: 0.3–0.6, nur auf Titel- und Kapitelfolien – er ist ein Signature-Moment, kein Dauerzustand.
- Schweben (`float`): 0.3–0.7 mit wenigen Elementen mit `depth` (Hintergrund −2…−4, Karten +2…+5). Nie Text bewegen,
  der gelesen werden muss.
- Neigung (`tilt`): höchstens 15–25°, für Bild- und Geräte-Mockups, nicht für Text.
- Charts: eine Aussage pro Chart, Akzentfarbe für den wichtigsten Wert, Rest gedämpft (`brand.textMuted`).
- Kamerafahrt: Folien eines Kapitels nah beieinander, Kapitel weiter auseinander – die Entfernung erzählt die Struktur.
  Höchstens leichte Drehungen (≤ 10°). Light Leak nur an 1–2 Stellen pro Deck.
- Glas & Blur für Karten über Bildern – nie über einfarbigen Flächen.
- Farblooks pro Kapitel einheitlich halten.
- Deck-Intensität (`intensity`) standardmäßig 0.3.

## Nicht

- Kein Clipart, keine Stock-Ästhetik, keine Schlagschatten mit harter Kante.
- Keine Aufzählungen mit mehr als 4 Punkten.
- Keine Effekte ohne Grund. Keine verspielten Animationen (Wackeln, Drehen, Hüpfen).
