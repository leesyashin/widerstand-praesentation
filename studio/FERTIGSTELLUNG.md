# Studio – Fertigstellung (Phase 9)

> Stand: 9. November 2026. Dieser Plan macht aus Studio eine Präsentations-App, in der du ein Deck von der leeren
> Folie bis zum Vortrag baust, auf deinem Windows-Rechner, ohne JSON und ohne Umweg über Claude.
> Er ergänzt `PLAN.md` (Phasen 0–8) und ist die Arbeitsgrundlage für alle folgenden Sitzungen.

## 1. Worum es geht

Studio hat eine starke Engine und einen dünnen Editor. Die Phasen 0–8 haben vor allem gebaut, was auf der Folie
*passieren* kann: Builds, Übergänge, Partikel, Physik, Export. Der Teil, den du beim Arbeiten ständig in der Hand
hast, also Text, Auswahl, Arbeitsfläche, Menüs und Tastatur, ist auf dem Stand eines ersten Entwurfs geblieben.
Deshalb fühlt sich Studio wie eine Web-Seite mit Formular an und nicht wie Keynote oder PowerPoint.

Die Folge für die Reihenfolge: **Phase 8d (3D) und 8e (Bühne) ruhen**, bis der Editor fertig ist. Bis dahin kommen
keine neuen Effekte dazu.

**Die Messlatte („30-Minuten-Test“).** Studio ist fertig, wenn du auf deinem Windows-Rechner in 30 Minuten ein
neues Deck mit 10 Folien baust und präsentierst und dabei

- keine Datei von Hand öffnest und keinen Farb-, Datei- oder Icon-Namen tippst,
- Claude nicht brauchst (Claude bleibt der schnellere Weg für ganze Decks, ist aber keine Voraussetzung mehr),
- an keiner Stelle einen Umweg suchen musst.

## 2. Befund

Geprüft habe ich die laufende App im Browser (Chromium) in typischen Windows-Fenstergrößen: 1536×864, 1366×768 und
1280×720. Die letzte Größe entspricht einem Full-HD-Laptop mit 150 % Skalierung. Ein echtes Windows mit Edge stand
mir nicht zur Verfügung, deshalb gehören automatische Windows-Tests zu Etappe 1.

**Was stimmt:** `npm run check` ist grün, der Build für Vercel läuft durch, und in allen geprüften Ansichten gab es
keinen einzigen Fehler in der Konsole. Engine, Präsentation, Referentenansicht, Vorlagen und Export funktionieren.
Darauf baut der Plan auf, davon wird nichts weggeworfen.

**Was fehlt**, sortiert nach deinen Punkten:

| Dein Punkt | Was ich gesehen habe | Wo es herkommt |
|---|---|---|
| Schrift bearbeiten | Im Text gibt es nur **fett** und *kursiv*. Kein Unterstreichen, keine Farbe, Größe oder Schrift für ein einzelnes Wort, keine Listen, keine Links. | `editor/TextEditor.tsx`: eigene Leiste mit B, I, Fertig |
| | Für ein ganzes Textfeld lassen sich nur Stil, Größe, Ausrichtung und Farbe ändern. Eine Schriftart kannst du pro Text gar nicht wählen. Gewicht, Zeilenabstand und Laufweite kennt das Format, der Inspector zeigt sie am Element aber nicht. | `editor/Inspector.tsx` (Gruppe „Text“) |
| | Es gibt nur drei Schrift-Rollen (Display, Text, Mono) aus dem Brand-Kit. Freie Schriftwahl sieht das Format nicht vor. | `schema/deck.ts`: `font` ist eine feste Auswahl |
| | Ein Klick in den Inspector beendet die Textbearbeitung. Markierter Text lässt sich also von dort nicht formatieren. | `TextEditor.tsx`: `onBlur` beendet |
| | Das Textfeld wächst nicht mit. Langer Text läuft über den Rahmen hinaus, der Rahmen bleibt gleich hoch. | Rahmen ist fest, keine automatische Höhe |
| Alles auswählen | Strg+A auf der Folie wählt alles aus (14 von 14 Elementen). Danach lassen sich für mehrere Elemente aber nur Ausrichtung, Gruppe, Deckkraft und Sperre ändern, nicht Schrift, Größe oder Füllung für alle zugleich. | `Inspector.tsx`: `MultiStyle` |
| | In der Folienübersicht markiert Strg+A die ganze Oberfläche blau wie eine Web-Seite. Texte der Oberfläche sind überall markierbar. | kein `user-select: none` im App-Rahmen |
| | Kein Rechtsklick-Menü, an keiner Stelle. Tab springt nicht zum nächsten Element. Verdeckte Elemente erreichst du nur über die Ebenen-Liste. Mehrere Folien lassen sich nicht gemeinsam auswählen. | `editor/Canvas.tsx`, Navigator in `app/DeckView.tsx` |
| Windows | Die Oberfläche ist eine macOS-Nachbildung. Unter Windows erscheint sie in Segoe UI mit den Auswahllisten von Windows, das passt nicht zusammen. | `ui/tokens.css`, native `<select>` |
| | Kürzel weichen vom Windows-Üblichen ab: Gruppieren ist Strg+Alt+G, Abspielen Strg+Alt+P, F5 startet nichts. Strg beim Ziehen schaltet das Einrasten ab, unter Windows erwartet man dort eine Kopie. | Tastenkette in `DeckView.tsx` |
| | Kein Zoom: Strg+Mausrad bewirkt nichts. Bei 1280×720 bleibt für die Folie 732×450 Pixel, die Zeitleiste nimmt dauerhaft Platz weg. | `engine/Stage.tsx` passt nur ein |
| | Die Zwischenablage lebt nur im Editor. Ein Bild oder Text aus einem anderen Programm lässt sich nicht einfügen, Elemente nicht in ein anderes Deck kopieren. | `clipboard` ist ein `useRef` |
| | Gestartet wird über Terminal und `npm run dev`. Der Fenstertitel heißt immer „Studio“. | kein Starter, keine installierbare App im lokalen Betrieb |
| Alle Funktionen | Neue Elemente landen an fester Stelle über dem Vorhandenen, aufziehen mit der Maus geht nicht. Icons wählt man durch Tippen des Namens, Bilder über einen Dateipfad, Farben über unbeschriftete Punkte und Text wie `brand.surface`. | `editor/model.ts`, `Inspector.tsx` |
| | Es fehlen: Farbwähler mit Pipette, Verläufe, Schatten, Text in Formen, mehr als vier Formen, Zuschneiden von Bildern, Tabellen, Foliennummern, Suchen und Ersetzen, PDF, Hilfslinien und Lineale, Stil übertragen. | Format und Editor |
| | Auf der Startseite lässt sich ein Deck weder umbenennen noch duplizieren oder löschen. Titel und Format eines Decks sind nach dem Anlegen nicht mehr änderbar. | `app/DeckList.tsx` |
| Designsystem | Die Farben sind Apples Systemfarben (Blau `#0071e3`, Rot `#ff3b30`), die Schrift ist die Systemschrift. Von deinem Brand (Silbergelatine, Bricolage Grotesque, Sucher-Logo) ist in der App nichts zu sehen. | `ui/tokens.css` |
| Launch | Der Vercel-Build funktioniert, wurde aber nie veröffentlicht. Gehostet fehlen bisher Web-Link und PowerPoint, Uploads sind auf 3 MB begrenzt, jedes Speichern ist ein eigener Commit. | `app/ShareMenu.tsx`, `api/cloud/` |
| Sicherheitsnetz | Es gibt keinen einzigen automatischen Test für die Bedienung und keine Prüfung auf GitHub. Die App wird als eine Datei von 1,3 MB geladen. `DeckView.tsx` (831 Zeilen) und `Inspector.tsx` (1674 Zeilen) tragen fast die ganze Editor-Logik. | kein Testordner, kein `.github/` |

## 3. Grundsätze

1. **Editor vor Engine.** Jede Etappe verbessert, was du mit Maus und Tastatur tust. Das Dateiformat wächst nur
   rückwärtskompatibel, alte Decks laufen unverändert.
2. **Windows mit Edge oder Chrome ist die Hauptplattform.** Studio bleibt eine Web-App und wird als installierbare
   App ausgeliefert: eigenes Fenster, Symbol in der Taskleiste, eigene Titelleiste. Mac, iPad und Handy laufen aus
   demselben Code weiter. Eine echte `.exe` (Tauri) bleibt als späterer Schritt möglich, v1.0 braucht sie nicht.
3. **Zwei Betriebsarten, eine App.** Gehostet auf Vercel ist der Normalfall: Link öffnen, anmelden, arbeiten.
   Lokal starten bleibt für große Videos und für den Export, künftig mit einem Doppelklick statt Terminal.
4. **Jede Aktion ist ein Befehl.** Ein zentrales Verzeichnis führt jede Aktion mit Namen, Symbol, Tastenkürzel (je
   System) und der Bedingung, wann sie möglich ist. Werkzeugleiste, Menüs, Rechtsklick, Kürzel-Übersicht und
   Befehlssuche lesen alle daraus. So gibt es keine Funktion, die nur an einer versteckten Stelle erreichbar ist.
5. **Bewährte Bausteine statt Eigenbau, wo Eigenbau teuer wird.** Für Text ein Editor-Kern (Tiptap, wie im
   ursprünglichen Plan vorgesehen), für Menüs, Dialoge und Auswahllisten eine Bibliothek, die nur das Verhalten
   liefert (Radix oder Base UI). Das Aussehen bleibt vollständig deins.
6. **Nichts gilt als fertig ohne Test.** Jeder Handgriff bekommt einen automatischen Test, der bei jedem Pull
   Request auf Linux und auf Windows läuft.
7. **Die Oberfläche spricht Deutsch und keine Dateisprache.** Kein `brand.surface`, keine IDs, keine Pfade.
   Was Fachleute brauchen, liegt unter „Erweitert“.

## 4. Die Etappen

| # | Etappe | Löst vor allem | Umfang |
|---|---|---|---|
| 1 | Fundament und Launch | Vercel, Tests, Windows-Prüfung, Befehle, Design-Auswahl | mittel |
| 2 | Eigenes Gesicht | Designsystem, neuer App-Rahmen | mittel |
| 3 | Text und Schrift | „Schrift bearbeiten“ | groß |
| 4 | Arbeitsfläche und Auswahl | „alles auswählen“, Zoom, Rechtsklick, Zwischenablage | groß |
| 5 | Objekte und Funktionen | „alle Funktionen“ | groß |
| 6 | Decks und Ausgabe | Verwalten, PDF, Versionen, Export von überall | mittel |
| 7 | Windows-App | Installieren, offline, Tempo | mittel |
| 8 | Abnahme und 1.0 | 30-Minuten-Test, Hilfe, Doku | klein |

Umfang als grobe Schätzung: klein = 1 Pull Request, mittel = 2–3, groß = 4–6. Jede Etappe endet mit einem Stand,
den du über einen Link auf deinem Rechner ausprobierst. Kennzeichnung der Punkte: **Muss** gehört zu v1.0,
*Soll* kommt mit, wenn die Etappe es hergibt, sonst direkt nach 1.0.

### Etappe 1: Fundament und Launch

Ziel: Studio ist online, und alles Weitere steht auf einem Netz aus Tests.

- **Launch auf Vercel (Muss).** Die offenen Schritte aus `PLAN.md`: Token bei GitHub anlegen, Repo bei Vercel
  importieren (Root `studio`), `GITHUB_TOKEN` und `STUDIO_PASSWORD` setzen. Danach bekommt jeder Pull Request
  automatisch einen Vorschau-Link. Die Vorschau liest und schreibt ihren eigenen Branch, deine echten Decks auf
  `main` bleiben unberührt.
- **Bedien-Tests (Muss).** Playwright-Tests für die Grundhandgriffe: auswählen, ziehen, skalieren, Text tippen,
  rückgängig, kopieren und einfügen, speichern und neu laden. Dazu eine Liste aller Handgriffe aus diesem Plan
  (rund 60); jede Etappe hakt ihre ab.
- **Prüfung auf GitHub (Muss).** Bei jedem Pull Request: `npm run check` und die Bedien-Tests auf Linux und auf
  Windows, dort in Chrome und Edge. Damit ist „für Windows angepasst“ künftig gemessen und nicht vermutet.
- **Befehls-Verzeichnis (Muss).** Die Tastenkette in `DeckView.tsx` wird zu Befehlen (Grundsatz 4). `DeckView.tsx`
  und `Inspector.tsx` werden dabei in überschaubare Teile zerlegt.
- **Oberflächen-Bausteine (Muss).** Menü, Rechtsklick-Menü, Popover, Dialog, Tooltip mit Kürzel, Auswahlliste,
  Regler, Zahlenfeld zum Ziehen, Farbfeld. Alle mit Tastatur bedienbar.
- **Drei Design-Richtungen als Bilder (Muss).** Der echte Editor-Bildschirm in drei Richtungen, hell und dunkel,
  bei 1280×720 und 1920×1080. Du wählst, Etappe 2 setzt um. Vorschlag in Etappe 2.
- **Sofort-Korrekturen (Muss).** Oberfläche nicht mehr markierbar, Fenstertitel zeigt das Deck, Warnung beim
  Schließen mit ungespeicherten Änderungen.

Fertig, wenn: Studio unter deiner Vercel-Adresse läuft, die Prüfung auf Linux und Windows grün ist und du eine
Design-Richtung gewählt hast.

### Etappe 2: Eigenes Gesicht

Ziel: Studio sieht aus wie dein Werkzeug und ist so aufgebaut wie eine Präsentations-App.

**Designsystem (Muss)**

- Eigene Farben, abgeleitet aus dem Brand statt aus macOS. Dunkel als Standard, hell als Option.
- Eigene Schriften fest eingebaut (Bricolage Grotesque für Titel, eine gut lesbare Textschrift für die
  Oberfläche). Studio sieht dann unter Windows und macOS gleich aus. Prüfstein ist die Lesbarkeit bei 12–13 px
  unter Windows.
- Eigene Bedienelemente statt der Auswahllisten, Häkchen und Regler des Betriebssystems.
- Wiedererkennbare Details aus deinem Logo, zum Beispiel Sucher-Ecken als Auswahlrahmen und in leeren Zuständen.
- Regel für die Zukunft: Farben und Abstände nur noch über Tokens, per Lint geprüft.

Drei Richtungen zur Auswahl, alle mit deinen Brand-Schriften:

| Richtung | Charakter |
|---|---|
| **Dunkelkammer** (meine Empfehlung) | Warmes Graphit, Silber als Akzent, ein einziger Signalton (Rotlicht) nur für Auswahl und aktive Zustände. Ruhig, die Folie leuchtet. |
| Leuchttisch | Hell, Papierweiß, Folien wie ein Kontaktbogen, schwarze Typo, feine Linien. |
| Schnittplatz | Dichtes Profi-Werkzeug wie DaVinci Resolve: feste Bereiche, Zahlen in Mono wie Timecode, farbige Spuren. |

**Neuer App-Rahmen (Muss)**

- **Formatleiste über der Folie**, die sich nach der Auswahl richtet. Bei Text: Schrift, Größe, Gewicht, fett,
  kursiv, unterstrichen, Farbe, Ausrichtung, Liste. Bei Formen: Füllung, Kontur, Ecken, Schatten. Bei Bildern:
  Ersetzen, Zuschneiden, Ecken. Das Wichtigste liegt damit immer an derselben Stelle. Der Inspector rechts bleibt
  für die vollständigen Einstellungen.
- **Menüleiste** (Datei, Bearbeiten, Einfügen, Format, Anordnen, Folie, Ansicht, Präsentation, Hilfe), wie man es
  unter Windows erwartet. Dazu Befehlssuche und Kürzel-Übersicht.
- **Bereiche zum Ein- und Ausklappen** mit veränderbarer Breite: Folienliste, Inspector, Zeitleiste. Die
  Zeitleiste ist anfangs zu. Der Rahmen funktioniert ab 1280×720.
- **Klartext überall**: Farben mit Namen („Fläche“, „Akzent“), keine Tokens, IDs oder Pfade.
- Zustände für jede Ansicht: leer, lädt, Fehler, offline. Eigene Dialoge statt der Browser-Rückfragen.

Fertig, wenn: jede Ansicht nur noch Bausteine und Tokens des neuen Systems nutzt und Bildvergleiche von 12
App-Ansichten (hell, dunkel, zwei Fenstergrößen) in der Prüfung laufen.

### Etappe 3: Text und Schrift

Ziel: Text verhält sich wie in Keynote oder PowerPoint. Das ist dein wichtigster Punkt und die größte Etappe.

- **Neuer Text-Kern (Muss).** Tiptap ersetzt den selbstgebauten Texteditor. Der Text sieht beim Bearbeiten
  weiterhin exakt aus wie auf der Folie. Rückgängig im Text und im Deck greifen ineinander.
- **Formatieren, was markiert ist (Muss).** Fett, kursiv, unterstrichen, durchgestrichen, Farbe, Größe, Schrift,
  Gewicht, Groß-/Kleinschreibung. Mit Markierung gilt es für die Markierung, ohne für das ganze Feld. Die
  Formatleiste und der Inspector wirken, **ohne** die Bearbeitung zu beenden.
- **Absätze (Muss).** Ausrichtung, Zeilenabstand, Abstand vor und nach dem Absatz, Aufzählungen und nummerierte
  Listen mit Einrückung über Tab.
- **Textfeld (Muss).** Wächst mit dem Text. Wahl zwischen „Höhe automatisch“, „feste Größe“ und „Text
  verkleinern, bis er passt“. Innenabstand. Textwerkzeug: Klick setzt ein Feld, Ziehen legt die Breite fest.
  Tippen bei ausgewähltem Feld beginnt die Bearbeitung.
- **Schriftwahl (Muss).** Auswahlliste mit Vorschau in der jeweiligen Schrift. Quellen: Brand-Schriften, eigene
  Dateien (hochladen per Ziehen), eine kuratierte Bibliothek freier Schriften, die beim ersten Verwenden ins Repo
  geladen wird, damit Web-Link und iPad sie auch haben. Gewichte zeigen nur, was die Schrift wirklich hat.
- *Soll:* auf dem Rechner installierte Schriften (in Edge und Chrome möglich), mit dem Hinweis „nur auf diesem
  Gerät“ und der Möglichkeit, sie ins Deck einzubetten. Links im Text. Suchen und Ersetzen im ganzen Deck.
- **Einfügen (Muss).** Aus Word oder dem Web bleiben fett, kursiv und Listen erhalten, fremde Schriften und Farben
  nicht. Strg+Umschalt+V fügt reinen Text ein.
- **Mehrere Textfelder zugleich (Muss).** Alles auswählen und Schrift, Größe, Farbe für alle ändern.
- **Kürzel (Muss).** Strg+B/I/U, Strg+Umschalt+> und < für die Größe, Strg+L/E/R für die Ausrichtung, F2 oder
  Enter zum Bearbeiten, Esc zum Verlassen.
- **Format.** Der Text bleibt im Feld `content`, das Markup wird erweitert (Unterstreichung, Durchstreichung,
  Link, Spanne mit Farbe, Größe oder Schrift, Listenzeilen). Dazu `fontFamily` und ein Schriften-Verzeichnis im
  Deck. So bleibt es eine Quelle, die auch Claude von Hand schreiben kann. Die genaue Schreibweise wird zu Beginn
  der Etappe an zehn Beispieltexten festgelegt und in `CLAUDE.md` beschrieben.
- **Gleiches Bild überall (Muss).** Builds (Wort, Zeile, Buchstabe), Magic Move, Web-Player und PowerPoint-Export
  zeigen die neue Formatierung wie der Editor. Ein Text-Testdeck wird per Bildvergleich geprüft.

Fertig, wenn du in einer Headline ein Wort einfärbst und in eine andere Schrift setzt, darunter eine eingerückte
Liste schreibst, Text aus Word einfügst, und alles in Präsentation und Web-Link gleich aussieht.

### Etappe 4: Arbeitsfläche und Auswahl

Ziel: direktes Arbeiten auf der Folie, wie man es gewohnt ist.

- **Zoom und Verschieben (Muss).** Strg+Mausrad und Zwei-Finger-Zoom, Strg+0 einpassen, Strg+1 für 100 %,
  Leertaste oder mittlere Maustaste zum Verschieben, Zoom-Anzeige. Graue Ablagefläche um die Folie.
- **Auswahl (Muss).** Erneuter Klick wählt das Element darunter. Tab und Umschalt+Tab wandern durch die Elemente.
  Rechtsklick listet alles unter dem Zeiger. Gesperrte Elemente lassen sich über das Menü entsperren.
  Doppelklick auf ein Master-Element bietet „Master bearbeiten“ an.
- **Gemeinsam bearbeiten (Muss).** Bei mehreren Elementen zeigt der Inspector alle gemeinsamen Eigenschaften
  (Schrift, Farbe, Füllung, Kontur, Ecken, Animation), bei unterschiedlichen Werten „gemischt“.
- **Mehrere Folien (Muss).** Mit Umschalt und Strg in Folienliste und Übersicht auswählen, dann verschieben,
  duplizieren, löschen, überspringen, Übergang setzen. Folien kopieren, auch in ein anderes Deck.
- **Rechtsklick-Menüs (Muss).** Für Element, Mehrfachauswahl, leere Folie, Folie in der Liste, Ebene, Deck-Karte.
- **Zwischenablage des Systems (Muss).** Elemente zwischen Folien, Decks und Fenstern kopieren. Bild aus der
  Zwischenablage wird ein Bild, Text ein Textfeld.
- **Erzeugen durch Aufziehen (Muss).** Werkzeug wählen, auf der Folie aufziehen. Ohne Aufziehen landet Neues in
  der sichtbaren Mitte und nicht über Vorhandenem. Linien bekommen zwei Endpunkte zum Greifen.
- **Tasten wie auf dem System (Muss).** Unter Windows: Strg+G gruppieren, Strg+Umschalt+G auflösen, F5 abspielen,
  Umschalt+F5 ab aktueller Folie, Strg+Ziehen kopiert, Alt schaltet das Einrasten ab. Auf dem Mac bleibt es wie
  heute.
- **Rückgängig mit Namen (Muss).** „Rückgängig: Verschieben“. Rückgängig stellt auch Auswahl und Folie wieder her.
- *Soll:* Hilfslinien für gleiche Abstände und gleiche Größen, Lineale mit eigenen Hilfslinien, die Ränder aus
  `STYLE.md` als einblendbare Zonen, mehrere Elemente gemeinsam drehen, Skalieren aus der Mitte.
- **Tempo (Muss).** 50 Elemente ziehen bleibt flüssig. Heute rechnet jede Mausbewegung die ganze Folie neu, das
  wird gemessen und bei Bedarf umgebaut.

Fertig, wenn du eine Folie mit zwölf Elementen anordnest, ohne ein Zahlenfeld zu benutzen, und jeder Punkt oben
einen grünen Test hat.

### Etappe 5: Objekte und Funktionen

Ziel: die Werkzeuge, die man in jeder Präsentations-App voraussetzt. Drei Pakete, je ein bis zwei Pull Requests.

**Paket A: Farbe und Fläche**

- Farbwähler **(Muss)**: Palette mit Namen, freie Farbe, Deckkraft, Pipette, zuletzt benutzt.
- Verlauf als Füllung, Kontur mit Stärke, Strichart und Pfeilspitzen, weicher Schatten **(Muss)**.
- Stil kopieren und auf andere Elemente übertragen **(Muss)**.

**Paket B: Formen, Bilder, Icons**

- Formen-Bibliothek **(Muss)**: Dreieck, Vieleck, Stern, Pfeile, Sprechblase, auf Basis des vorhandenen
  Pfad-Elements. Text in Formen **(Muss)**.
- Bilder **(Muss)**: einfügen über Dateidialog, Ziehen oder Zwischenablage. Doppelklick öffnet das Zuschneiden
  (Ausschnitt verschieben und zoomen), Masken, Ersetzen bei gleicher Größe.
- Icon-Auswahl mit Suche auf Deutsch statt Namen tippen **(Muss)**.
- *Soll:* Zeichenstift für freie Pfade, Video-Startbild wählen.

**Paket C: Folien und Inhalte**

- Platzhalter in Layouts **(Muss)**: „Titel eingeben“, Bildfläche zum Hineinziehen. Neue Folien laden zum
  Ausfüllen ein, statt Beispieltext zu zeigen.
- Foliennummer und Fußzeile über den Master, Layout einer bestehenden Folie wechseln **(Muss)**.
- *Soll:* einfache Tabellen, Chart-Daten als Tabelle mit Einfügen aus Excel, Abschnitte in der Folienliste,
  Links auf Folien oder Web-Adressen.
- Animation **(Muss)**: Auswahl als Karten mit Vorschau beim Darüberfahren statt als Liste. Die Engine bleibt.

Fertig, wenn jede Zeile der Befund-Tabelle unter „Alle Funktionen“ erledigt oder bewusst auf „nach 1.0“ gesetzt ist.

### Etappe 6: Decks und Ausgabe

- **Startseite (Muss).** Umbenennen, duplizieren, löschen (mit Papierkorb), suchen, sortieren, zuletzt geöffnet.
- **Deck-Einstellungen (Muss).** Titel, Format (16:9, 4:3, eigenes), Theme, Palette, Schriften. Das Brand-Kit
  (Farben, Schriften, Logo) bekommt eine eigene Seite.
- **PDF und Bilder (Muss).** Eine Seite pro Folie, auf Wunsch jeder Klick als eigene Seite.
- *Soll:* **Versionen.** Weil jedes Speichern im Git landet, kann Studio frühere Stände eines Decks zeigen und
  wiederherstellen.
- *Soll:* **Web-Link und PowerPoint auch gehostet.** Eine GitHub-Aktion baut Player, PowerPoint und PDF und liefert
  den Link zurück. Damit ist der Export nicht mehr an den lokalen Start gebunden.

Fertig, wenn du ein Deck umbenennst, als PDF verschickst und einen alten Stand zurückholst, alles in der App.

### Etappe 7: Windows-App

- **Installierbar (Muss).** In Edge oder Chrome „Als App installieren“: eigenes Fenster, Symbol in der Taskleiste,
  eigene Titelleiste mit Deck-Titel und Speicherstand. Gilt gehostet und lokal.
- **Offline und sicher (Muss).** Die App startet ohne Netz. Änderungen landen zuerst auf dem Gerät und werden
  danach mit GitHub abgeglichen. Anzeige in zwei Stufen: „auf diesem Gerät gesichert“, „synchronisiert“.
  Commits werden gebündelt statt alle 2,5 Sekunden einer. Nach einem Absturz ist nichts verloren.
- **Lokal mit Doppelklick (Muss).** `Studio starten.cmd`: prüft Node, holt den neuesten Stand, startet den Dienst
  und öffnet das App-Fenster. Dazu ein Knopf „Synchronisieren“ in der App. Geprüft mit Leerzeichen, Umlauten und
  OneDrive-Ordnern im Pfad.
- **Tempo (Muss).** Start unter zwei Sekunden auf einem normalen Laptop: Code wird in Teilen geladen (Editor,
  Player, Export, WebGL getrennt), Vorschaubilder der Folien als Bild statt als lebende Folie.
- **Windows-Details (Muss).** Skalierung 100–175 %, Touch und Stift, Kontrastmodus, Edge, Chrome und Firefox,
  zweiter Bildschirm beim Präsentieren, Bildschirm bleibt beim Vortrag wach.
- *Soll:* Uploads über 3 MB im gehosteten Betrieb (Videos).

Fertig, wenn Studio auf deinem Rechner wie ein Programm startet, ohne Netz weiterarbeitet und nach dem Verbinden
alles synchron ist.

### Etappe 8: Abnahme und 1.0

- Du baust ein echtes Deck auf Windows, am besten deinen nächsten Vortrag. Alles, was hakt, kommt auf eine Liste
  und wird behoben. Das wiederholen wir, bis ein Durchlauf ohne Hänger gelingt (30-Minuten-Test).
- Hilfe in der App: Kürzel-Übersicht, kurze Einführung beim ersten Start, Fehlerseite mit „Bericht kopieren“.
- Doku: README mit Installation unter Windows in drei Schritten, `CLAUDE.md` und `EXTENDING.md` auf Stand,
  `PLAN.md` abgeschlossen, Version 1.0.
- Danach geht Phase 8d/8e weiter.

## 5. Was v1.0 bewusst nicht enthält

3D und Bühne (Phase 8d/8e, direkt danach), gleichzeitiges Arbeiten zu mehreren, Kommentare, Video-Export, ein
KI-Feld in der App, PowerPoint-Import, Handy-Fernbedienung über das Internet, eine `.exe` mit Installer.

## 6. Was ich von dir brauche

1. **Vercel einrichten** (rund zehn Minuten, Schritte in Etappe 1). Ohne das kann ich dir keine Vorschau-Links
   geben.
2. **Design-Richtung wählen**, sobald die drei Beispiele da sind. Wenn du schon jetzt eine App nennst, deren
   Aussehen dir gefällt, fließt das in die Beispiele ein.
3. **Wie arbeitest du unter Windows am liebsten?** Über den Link (gehostet) oder lokal im Repo-Ordner. Der Plan
   nimmt den Link als Normalfall an. Wenn du überwiegend lokal arbeitest, ziehe ich den Doppelklick-Starter aus
   Etappe 7 nach vorn.
4. **Schriften.** Welche Schriften außer Bricolage Grotesque und DM Sans brauchst du sicher? Sie kommen als Erste
   in die Bibliothek.

## 7. So arbeiten wir die Etappen ab

- Ein Pull Request pro Teilstück, jeweils mit Vorschau-Link, grüner Prüfung auf Linux und Windows und einer
  kurzen Liste „Das kannst du jetzt ausprobieren“.
- Zu jeder Etappe: Tests, Doku (`CLAUDE.md`, `EXTENDING.md`), Stand in `PLAN.md`.
- Abweichungen vom Plan werden hier nachgetragen, mit Grund.
- Neue Wünsche während der Arbeit kommen auf die Liste „nach 1.0“, außer sie verhindern den 30-Minuten-Test.
