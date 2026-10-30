# Studio

Deine Präsentations-App für Motion & Grafik. Plan: [PLAN.md](PLAN.md) · Stil: [STYLE.md](STYLE.md)

## Starten (auf deinem Mac)

Einmalig: [Node.js](https://nodejs.org) (Version 22 oder neuer) installieren.

```bash
cd studio
npm install      # nur beim ersten Mal und nach Updates
npm run dev      # öffnet http://localhost:5173
```

Lass `npm run dev` laufen, während du mit Claude arbeitest: Jede Änderung an einer `deck.json`
erscheint sofort im Browser – egal ob Claude sie macht oder du.

## Wo liegt was?

- `decks/<name>/deck.json` – deine Präsentationen, Medien in `decks/<name>/assets/`
- `brand/brand.json` – dein Brand-Kit (Farben, Schriften, Logo)
- `templates/` – Themes, Layouts, Vorlagen, Bausteine (ab Phase 1/5)
- `custom/` – eigene Komponenten für Spezialeffekte

## Bedienen

| Wo | Taste | Aktion |
|---|---|---|
| Editor | Doppelklick / ⏎ | Text bearbeiten (Esc beendet) |
| Editor | ⌘Z / ⇧⌘Z | Rückgängig / Wiederholen |
| Editor | ⌘D, ⌘C / ⌘V, ⌫ | Duplizieren, Kopieren/Einfügen, Löschen |
| Editor | Pfeile (⇧ = 10 px) | Element verschieben – ohne Auswahl: Folie wechseln |
| Editor | ⇧ beim Skalieren | Seitenverhältnis umschalten |
| Editor | ⌥⌘P | Abspielen ab aktueller Folie |
| Präsentation | → ␣ ⏎ Bild↓ / Klick | Weiter |
| Präsentation | ← Bild↑ / Rechtsklick | Zurück |
| Präsentation | B oder . | Schwarzbild |
| Präsentation | F / Esc | Vollbild umschalten / Beenden |

## Prüfen

```bash
npm run validate   # Decks und Brand-Kit prüfen
npm run check      # alles inkl. Code
npm run shots      # Folien als Bilder nach shots/ (einmalig: npx playwright install chromium)
```
