---
name: deck
description: Baut oder ändert eine Präsentation in Studio (studio/decks/<name>/deck.json) aus einem Briefing – Vorlage und Theme wählen, Folien aus Layouts und Bausteinen setzen, Builds und Übergänge nach STYLE.md, dann validieren und Screenshots prüfen. Aufrufen mit /deck oder wenn Vincent ein neues Deck, eine Präsentation oder Folien möchte oder ein bestehendes Deck ändern will („Folie 4 ruhiger“, „Kapitel 2 mit Kamerafahrt“).
---

# /deck – Präsentationen in Studio bauen

Alles passiert im Ordner `studio/`. Lies zuerst `studio/CLAUDE.md` (Format, Befehle) und **`studio/STYLE.md`** (Gestaltung,
Motion, Dos & Don'ts). Das Format ist in `studio/src/schema/deck.ts` definiert.

## 1. Briefing klären

Aus der Anfrage herauslesen – nur nachfragen, was wirklich fehlt (höchstens 2–3 Fragen auf einmal):

- **Ziel und Publikum:** Kunde, Pitch, Vortrag, Portfolio? Was soll danach passieren?
- **Dauer** bzw. Anzahl Folien (Faustregel: 1–2 Minuten pro Folie).
- **Inhalt:** Kernaussagen, Zahlen, Bilder/Videos (liegen sie schon vor?), Kontaktdaten.
- **Ton:** ruhig/sachlich, filmisch, hell/luftig.

Fehlen Bilder, mit `brand/platzhalter.svg` bauen und in den Notizen vermerken, was dort hingehört.

## 2. Vorlage und Theme wählen

| Anlass | Vorlage (`templates/decks/`) | Theme |
|---|---|---|
| Showreel, Portfolio, Bewerbung | `portfolio` | `kino` |
| Kundenangebot, Arbeitsstand | `angebot` | `sachlich` |
| Idee verkaufen, Startup, Projektantrag | `pitch` | `silber` |
| Vortrag, Workshop, Lehre | `vortrag` | `papier` |

Themes (`templates/themes/`): `silber` (dunkel, Licht-Verlauf – Standard), `kino` (schwarz, Kinobalken, Korn),
`sachlich` (Graphit, keine Effekte), `papier` (hell, Papierweiß). Ein Theme kann die Palette umstellen – deshalb
Farben **immer als Brand-Token** setzen, nie als Hex.

## 3. Deck schreiben

1. Ordner `decks/<name>/` (kebab-case) mit `deck.json` und `assets/` anlegen. Am einfachsten: passende Vorlage
   kopieren und `title`, `description` sowie die Inhalte ersetzen. Sonst Folien aus `templates/layouts/` ableiten
   (Elemente und Koordinaten übernehmen, `"layout": "<name>"` setzen, Hintergrund/Effekte der Fläche aus dem Theme).
2. **Gliederung:** Titel – Kapitel – Inhalt – Abschluss. Eine Idee pro Folie, höchstens ~30 Wörter Fließtext.
3. Layouts (16): `titel`, `kapitel`, `agenda`, `statement`, `zitat`, `bild-vollbild`, `bild-text`, `galerie`,
   `drei-punkte`, `grosse-zahl`, `chart`, `vergleich`, `ablauf`, `ueber-mich`, `kontakt`, `abschluss`.
4. **Animierte Bausteine** (`templates/blocks/`) für besondere Momente: `intro`, `kapitel-trenner`, `abspann`
   (ganze Folien), `logo-reveal`, `counter`, `galerie` (Elemente auf einer Folie). Elemente übernehmen, IDs eindeutig
   halten, Koordinaten gelten für 1920×1080.
5. Wiederkehrendes (Logo, Linie, Kapitelmarke) als **Master** (`masters` + `"master"` an der Folie) statt Kopien.
   Typo deckweit über `textStyles` anpassen statt `fontSize` an vielen Texten.
6. **Motion nach STYLE.md:** Headlines `blurRise`, Karten/Listen `rise`, Zitate `maskReveal`; Zusammengehöriges mit
   `withPrevious`; ≤ 4 Klicks pro Folie. Standard-Übergang `blurDissolve`, `magicMove` bei gleichem `match`
   (z. B. `headline`), `lightLeak`/`camera` nur an Kapitelwechseln.
7. Sprechernotizen (`notes`) für jede Inhaltsfolie: ein, zwei Sätze, was gesagt werden soll.
8. Eigene Medien nach `decks/<name>/assets/` (Videos < 100 MB, optimierte Web-Versionen).

## 4. Prüfen (Pflicht)

```bash
cd studio
npm run validate -- <name>        # Schema, Dateien, Brand-Tokens
npm run shots -- <name>           # jede Folie als PNG nach shots/<name>/
npm run shots -- <name> --steps   # bei Animationen: Stand nach jedem Klick
```

Die Bilder **ansehen** und korrigieren: Überlappungen, abgeschnittener Text, zu kleine Abstände, Ränder
(≥ 160 px seitlich, ≥ 120 px oben/unten), Kontrast (Text auf Bildern, helle Themes), sichtbare Markup-Zeichen
(`*kursiv*` gilt nur innerhalb einer Zeile – über `\n` hinweg jede Zeile einzeln markieren). Danach erneut prüfen.

## 5. Abschluss

Kurz berichten: Name des Decks, Gliederung (eine Zeile pro Folie), Theme, was noch fehlt (eigene Bilder, Zahlen).
Vincent öffnet es unter `npm run dev` → Studio → Deck. Code-Änderungen an der App gehören nicht zu diesem Skill.

## Gezielte Änderungen

„Folie 4 ruhiger“, „Zahlen hochzählen lassen“, „Kamerafahrt zwischen Kapitel 2 und 3“: nur die betroffenen
Folien in der `deck.json` ändern, Stil-Regeln beachten, dann wieder validieren und Screenshots prüfen.
