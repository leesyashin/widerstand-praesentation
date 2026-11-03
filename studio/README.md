# Studio

Deine Präsentations-App für Motion & Grafik. Plan: [PLAN.md](PLAN.md) · Stil: [STYLE.md](STYLE.md)

## Starten (Mac oder Windows)

Einmalig: [Node.js](https://nodejs.org) (Version 22 oder neuer) installieren.

```bash
cd studio
npm install      # nur beim ersten Mal und nach Updates
npm run dev      # öffnet http://localhost:5173
```

Unter Windows dasselbe in PowerShell oder im Terminal von VS Code. Tastenkürzel: überall, wo ⌘ steht, **Strg**
(⌥ = Alt). Für Screenshots und PowerPoint-Export einmalig `npx playwright install chromium`.

Lass `npm run dev` laufen, während du mit Claude arbeitest: Jede Änderung an einer `deck.json`
erscheint sofort im Browser – egal ob Claude sie macht oder du.

## Wo liegt was?

- `decks/<name>/deck.json` – deine Präsentationen, Medien in `decks/<name>/assets/`
- `brand/brand.json` – dein Brand-Kit (Farben, Schriften, Logo)
- `templates/` – Themes, Layouts, Bausteine und Deck-Vorlagen (erweitern: [EXTENDING.md](EXTENDING.md))
- `custom/` – eigene Komponenten für Spezialeffekte

Neues Deck: auf der Startseite „Neues Deck“ – leer mit Theme oder aus einer Vorlage (Portfolio, Angebot, Pitch,
Vortrag). Oder in Claude Code `/deck` mit einem kurzen Briefing.

## Bedienen

| Wo | Taste | Aktion |
|---|---|---|
| Editor | Doppelklick / ⏎ | Text bearbeiten (Esc beendet) |
| Editor | ⌘Z / ⇧⌘Z | Rückgängig / Wiederholen |
| Editor | ⇧-Klick, Rahmen ziehen, ⌘A | Mehrfachauswahl |
| Editor | ⌘-Klick / Doppelklick | Einzelnes Element in einer Gruppe wählen |
| Editor | ⌥⌘G / ⇧⌥⌘G | Gruppieren / Gruppe auflösen |
| Editor | ⌘] / ⌘[ (mit ⇧: ganz) | Ebene nach vorne / hinten |
| Editor | ⌘D, ⌘C / ⌘X / ⌘V, ⌫ | Duplizieren, Kopieren/Ausschneiden/Einfügen, Löschen |
| Editor | ⌥ beim Ziehen | Kopie ziehen |
| Editor | Pfeile (⇧ = 10 px) | Element verschieben – ohne Auswahl: Folie wechseln |
| Editor | ⇧ beim Ziehen / Skalieren / Drehen | Achse sperren / Seitenverhältnis umschalten / 15°-Schritte |
| Editor | ⌘ beim Ziehen | Einrasten an Hilfslinien kurz aus |
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

Medien (Fotos, Videos, Lottie) ziehst du einfach auf die Folie oder in die Medien-Bibliothek – Bilder werden dabei
auf max. 3840 px optimiert, Videos bekommen ein Posterbild. Eigene Schriften lädst du im Folie-Tab unter
„Textstile → Schriften …“ hoch.

## Studio unterwegs (Handy, ohne Mac)

Die App kann auch gehostet laufen – dann speichert sie direkt in dieses GitHub-Repo (jede Änderung ein Commit)
und funktioniert überall, auch ohne laufenden Mac. Einmal einrichten:

1. **GitHub-Schlüssel:** Auf [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
   einen *Fine-grained token* anlegen: Repository access → *Only select repositories* → dieses Repo,
   Permissions → *Contents: Read and write*. Ablaufdatum z. B. 1 Jahr. Kopieren – er kommt gleich zu Vercel,
   nicht aufs Handy.
2. **Vercel:** Auf [vercel.com/new](https://vercel.com/new) mit GitHub anmelden und dieses Repo importieren.
   *Root Directory* auf `studio` stellen. Unter *Environment Variables* zwei Einträge anlegen:
   - `GITHUB_TOKEN` = der Schlüssel aus Schritt 1
   - `STUDIO_PASSWORD` = ein Passwort deiner Wahl (damit meldest du dich an)

   Deploy. Ab dann baut Vercel bei jedem Push neu. Alles andere kommt aus `studio/vercel.json`.
3. **Handy:** Die Vercel-Adresse öffnen, Passwort eingeben, „Anmelden“. In Safari über Teilen →
   **Zum Home-Bildschirm** wird Studio eine Vollbild-App.

Auf dem Handy: Folien im Streifen unten antippen, Elemente antippen und ziehen, **Doppeltippen** bearbeitet Text,
**Details** öffnet Stil/Animation/Folie (inkl. Notizen), Folien mit ‹ › verschieben, duplizieren, löschen,
„Neue Folie“ aus Layouts, Abspielen mit Wischen. Gespeichert wird 2,5 s nach der letzten Änderung (und sofort,
wenn du die App verlässt). Änderungen von Claude oder vom Mac erscheinen nach spätestens 15 s.

Gut zu wissen:
- Der GitHub-Schlüssel liegt nur bei Vercel, nie auf dem Handy. Das Gerät bleibt 180 Tage angemeldet; abmelden in
  der Deck-Übersicht. **Passwort ändern** (in Vercel, danach *Redeploy*) meldet alle Geräte ab – z. B. wenn ein Handy
  verloren geht.
- Die Vercel-Adresse ist öffentlich, zeigt ohne Passwort aber nichts aus dem Repo. Studio darf über den Server nur
  Dateien in `studio/` auf dem eigenen Branch lesen und schreiben.
- Nur am Mac: Web-Player und PowerPoint bauen, Handy-Fernbedienung über WLAN, Videos und Dateien über 3 MB
  (große Fotos verkleinert Studio unterwegs automatisch).
- Optional in Vercel: `STUDIO_BRANCH` (Standard: der deployte Branch, also `main`), `STUDIO_REPO` (`name/repo`, falls
  Vercel es nicht selbst weiß).
- Am Mac danach `git pull`, damit du die Änderungen vom Handy hast.

## Teilen: Web-Link und PowerPoint

Im Editor oben rechts **Teilen**:

- **Web-Player bauen** → `studio/published/<deck>/`: eine eigenständige Seite mit allen Animationen und
  Übergängen (nur Ansehen; Pfeiltasten, Klick, Wischen auf dem Handy, Bedienleiste). Den Ordner auf
  [Netlify Drop](https://app.netlify.com/drop) ziehen – fertig ist der Link. Alternativ `npx vercel deploy published/<deck> --prod`
  oder GitHub Pages. Wer den Link hat, sieht die Präsentation; einen Passwortschutz gibt es bei Netlify/Vercel
  in den Site-Einstellungen. Ein Link auf eine bestimmte Folie: `…/index.html#<folien-id>`.
- **PowerPoint (.pptx)** → Download. Texte, Bilder, Formen, Videos und Notizen bleiben bearbeitbar; Licht-Verlauf,
  Korn, Icons, Charts und Lottie werden als Bilder eingebettet. Animationen und Übergänge fehlen (Grenze des
  Formats). Damit die Schriften stimmen, *Bricolage Grotesque* und *DM Sans* installieren (Google Fonts).

Dasselbe im Terminal:

```bash
npm run publish -- <deck>            # Web-Player nach published/<deck>/
npm run publish -- <deck> --preview  # … und lokal ansehen (http://localhost:4173)
npm run pptx -- <deck>               # PowerPoint nach exports/<deck>.pptx
```

## Prüfen

```bash
npm run validate   # Decks und Brand-Kit prüfen
npm run check      # alles inkl. Code
npm run shots      # Folien als Bilder nach shots/ (einmalig: npx playwright install chromium)
```
