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
| Präsentation | R | Referentenansicht in eigenem Fenster öffnen |
| Referentenansicht | → ← ␣ / B | Publikum steuern / Schwarzbild |

## Präsentieren mit Referentenansicht und Handy

1. `npm run dev:remote` statt `npm run dev` starten – dann erreicht dein Handy den Mac im selben WLAN.
2. Referentenansicht öffnen: im Präsentationsmodus **R** drücken oder `http://localhost:5173/#/presenter/<deck>` aufrufen.
3. In der Referentenansicht „Publikum öffnen“ – das Fenster auf den Beamer ziehen und einmal hineinklicken (Vollbild).
   In Chrome schiebt Studio es nach einer Rückfrage selbst auf den zweiten Bildschirm.
4. „Handy“ zeigt einen QR-Code für die Fernbedienung.
5. „Probe starten“ misst die Zeit pro Folie. Ergebnisse landen in `decks/<deck>/rehearsal.json` und erscheinen beim
   nächsten Mal als „Letzte Probe“ neben der aktuellen Folie.

## Prüfen

```bash
npm run validate   # Decks und Brand-Kit prüfen
npm run check      # alles inkl. Code
npm run shots      # Folien als Bilder nach shots/ (einmalig: npx playwright install chromium)
```
