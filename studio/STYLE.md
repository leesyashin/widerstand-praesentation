# Stil-Bibel

> Erste Fassung. Wird mit jeder Präsentation geschärft – mit deinen Referenzen, deinem Logo, deinen Farben.
> Claude hält sich beim Bauen von Decks an diese Regeln.

## Haltung

**Subtil & elegant.** Ruhig, präzise, hochwertig – wie eine Apple-Keynote, mit dem Blick eines Filmemachers.
Filmische Mittel (Grain, Light Leaks, Kamerafahrten, Letterbox) sind Gewürz, nicht Hauptgericht.

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
- Kursiv für Betonung oder Zitate, nicht fett im Fließtext.
- Keine Silbentrennung in Headlines, keine Hurenkinder (Einzelwort in letzter Zeile).

## Farbe

- Grundton dunkel (`brand.background`) mit hellem Text; helle Folien (`brand.light` + `brand.ink`) als bewusster Kontrast.
- **Ein Akzent pro Folie** (`brand.accent`). `brand.accent2` nur in Verläufen und Licht.
- Verläufe weich und langsam, nie grell.

## Motion

| Regel | Umsetzung |
|---|---|
| Eine Hauptbewegung pro Moment | Der Rest steht oder folgt gestaffelt (Stagger 60–90 ms) |
| Federn statt Bouncen | `smooth` als Standard, `spring` für Magic Move und Skalierung, kein sichtbares Überschwingen |
| Ruhige Dauer | `base` 500 ms für Builds, `slow` 800 ms für Headlines/Bilder, `cinematic` 1400 ms nur für Kamerafahrten |
| Lese-Richtung | Erst Headline, dann Detail. Bewegungen von unten nach oben oder links nach rechts |
| Signature-Build | `blurRise` für Headlines, `rise` für Karten und Listen, `maskReveal` für Zitate |
| Übergänge | Standard `blurDissolve` oder `magicMove`. `camera`, `lightLeak`, `whipPan` nur an **Kapitelwechseln** |
| Builds pro Folie | Möglichst ≤ 4 Klicks. Zusammengehöriges mit `withPrevious` gruppieren |

## Effekte

- Grain: 0.08–0.15. Vignette: 0.2–0.4. Letterbox nur für Bild-/Video-Momente.
- Glas & Blur für Karten über Bildern – nie über einfarbigen Flächen.
- Farblooks pro Kapitel einheitlich halten.
- Deck-Intensität (`intensity`) standardmäßig 0.3.

## Nicht

- Kein Clipart, keine Stock-Ästhetik, keine Schlagschatten mit harter Kante.
- Keine Aufzählungen mit mehr als 4 Punkten.
- Keine Effekte ohne Grund. Keine verspielten Animationen (Wackeln, Drehen, Hüpfen).
