# Preiswächter

Desktop-App für **Windows und Linux**, die Produktpreise in Online-Shops verfolgt. Ohne Server, ohne Konto, ohne Browser-Erweiterung: Produktlink einfügen, fertig.

> **Umbau läuft (v0.5.0, Meilenstein 1 von 4):** Die App kann Produkte per Link hinzufügen, Preise auf Knopfdruck prüfen und den Verlauf anzeigen.
> Noch nicht enthalten: automatische Prüfung, Benachrichtigungen, Einstellungen, Windows-Installer. Der Rest dieser Datei beschreibt noch die alte Browser-Erweiterung (letzte Version v0.4.0) und wird am Ende des Umbaus ersetzt.

Inspiriert von [PriceGhost](https://github.com/clucraft/PriceGhost) (selbst gehostete Server-App, MIT laut README). Übernommen wurden die Ideen der Preiserkennung; der Code ist neu geschrieben.

## Benutzen

### Ein Produkt verfolgen

1. Die Produktseite im Shop öffnen.
2. Auf das Preiswächter-Symbol in der Symbolleiste klicken. Name, Bild, Preis und Lagerstatus werden angezeigt.
3. Findet die Erweiterung mehrere unterschiedliche Preise, den richtigen auswählen.
4. Optional einen Zielpreis eintragen und auf **Preis verfolgen** klicken.
5. Der Browser fragt einmal nach Zugriff auf diesen Shop. Bitte erlauben, sonst kann der Preis nicht im Hintergrund geprüft werden.

### Popup

- Liste aller Produkte mit Preis, letzter Änderung und Verlauf der letzten 7 Tage.
- Ein grüner Strich links markiert Produkte, die seit dem letzten Öffnen günstiger geworden sind. Die Zahl am Symbol zeigt, wie viele es sind.
- **Übersicht →** öffnet die Übersicht, **⚙** die Einstellungen.
- Auf einer verfolgten Produktseite: **Jetzt prüfen** und **Preisverlauf**.

### Übersicht

- Alle Produkte als Karten. **▼** und grün heißt günstiger, **▲** und rot heißt teurer. Oben gibt es Suche und Sortierung.
- Ein Klick auf eine Karte öffnet die Detailansicht:
  - Preisdiagramm für 7, 30, 90 Tage oder alles. Mit der Maus oder den Pfeiltasten über die Linie fahren zeigt den Preis zu jedem Zeitpunkt.
  - Tiefster, höchster und durchschnittlicher Preis im gewählten Zeitraum.
  - „Verlauf als Tabelle“ listet jede gespeicherte Messung.
  - Einstellungen je Produkt: Prüfintervall, Zielpreis, Meldung erst ab x % Senkung, Meldung bei „wieder lieferbar“, Prüfung pausieren.
  - **Produkt nicht mehr verfolgen** (zweimal klicken) löscht das Produkt samt Verlauf.

### Benachrichtigungen

Die Erweiterung meldet sich mit einer Benachrichtigung des Betriebssystems, wenn:

- der **Zielpreis** erreicht oder unterschritten wird,
- der Preis **sinkt**: bei jeder Senkung, oder erst ab der Prozentzahl, die beim Produkt eingestellt ist,
- ein ausverkauftes Produkt **wieder lieferbar** ist.

Ein Klick auf die Benachrichtigung öffnet die Produktseite. Abschalten lassen sich alle Meldungen in den Einstellungen; dort gibt es auch eine Testbenachrichtigung.

### Einstellungen

- Prüfintervall für neue Produkte, auf Wunsch auch für alle vorhandenen.
- Hintergrund-Tab an/aus (siehe unten).
- Benachrichtigungen an/aus, Testbenachrichtigung.
- **Sicherung herunterladen** und **Sicherung einspielen**. Beim Einspielen bleiben vorhandene Produkte unverändert, nur ihr Verlauf wird ergänzt.

## So prüft die Erweiterung

- Jedes Produkt wird standardmäßig **einmal pro Stunde** geprüft, mit kleinem Zufallsversatz. Das geht nur, **solange der Browser läuft**. Nach dem Browserstart holt die Erweiterung Überfälliges nach.
- Zuerst lädt sie die Produktseite unsichtbar und liest den Preis aus.
- Klappt das nicht (Shops, die den Preis erst per JavaScript anzeigen, oder eine Bot-Sperre), öffnet sie die Seite **kurz in einem Hintergrund-Tab** und schließt ihn wieder. Das lässt sich in den Einstellungen abschalten.
- Öffnest du ein verfolgtes Produkt selbst, wird der Preis gleich mitgenommen.
- Schlägt eine Prüfung fehl, erscheint ein ⚠ mit dem Grund, und die Erweiterung versucht es nach 5–30 Minuten erneut.

Erkannt werden Preise aus strukturierten Produktdaten (die meisten Shops), Meta-Angaben, mit eigenen Regeln für Amazon, eBay und Magento-Shops sowie über allgemeine Suchmuster. Streichpreise, UVP und Ratenpreise („ab 22,88 € / Monat“) werden ignoriert.

## Datenschutz

- Alle Daten liegen nur im Browser (`storage.local`). Es gibt keinen Server und keine Weitergabe.
- Die Erweiterung greift nur auf Shops zu, für die du beim Hinzufügen den Zugriff erlaubt hast. Ansehen und widerrufen lässt sich das in der Erweiterungsverwaltung des Browsers.
- Beim Prüfen ruft sie die Produktseite so auf, wie dein Browser es auch tun würde (mit deinen Cookies für diesen Shop).

## Für Entwickler

```bash
npm install
```

```bash
npm test
```

```bash
npm run lint
```

Browsertests (Chrome for Testing und Firefox über Puppeteer, ca. 5 Minuten):

```bash
cd tests/e2e && npm install && npm run setup
```

```bash
cd tests/e2e && npm test
```

Release-Zip bauen (landet in `dist/`, danach mit `gh release create vX.Y.Z dist/preiswaechter-X.Y.Z.zip` hochladen):

```bash
npm run package
```

Versionsnummer steht an zwei Stellen: `extension/manifest.json` und `package.json`.

Aufbau: `extension/` ist die Erweiterung (ein Manifest für beide Browser, kein Build-Schritt). In `extension/lib/` liegen Preiserkennung (`priceParser.js`, `extract.js`), Prüfung (`checker.js`), Speicher (`storage.js`), Diagramme (`chart.js`, `series.js`), Melderegeln (`rules.js`) und Sicherung (`backup.js`). `tests/` enthält die Unit-Tests, `tests/e2e/` die Browsertests.
