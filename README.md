# Preiswächter

Desktop-App für **Windows und Linux**, die Produktpreise in Online-Shops verfolgt. Ohne Server, ohne Konto, ohne Browser-Erweiterung: Produktlink einfügen, den Rest macht die App.

- Preis auf fast jeder Produktseite erkennen, einfach per Link
- Automatische Prüfung im Hintergrund, jedes Produkt mit eigenem Intervall
- Preisverlauf mit Diagramm, tiefstem, höchstem und durchschnittlichem Preis
- Benachrichtigung bei Zielpreis, Preissenkung und „wieder lieferbar“
- Helles und dunkles Design
- Datensicherung als Datei

## Installieren und benutzen

| System | Download | Anleitung |
|---|---|---|
| **Windows** 10/11 | [PreiswaechterSetup.exe](https://github.com/CrazyJimPro/preiswaechter/releases/latest/download/PreiswaechterSetup.exe) | [WINDOWS.md](WINDOWS.md) |
| **Linux** (Mint u. a., 64 Bit) | [Preiswaechter-x86_64.AppImage](https://github.com/CrazyJimPro/preiswaechter/releases/latest/download/Preiswaechter-x86_64.AppImage) | [LINUX.md](LINUX.md) |

Die Anleitungen führen Schritt für Schritt durch Installieren, Produkte hinzufügen, Benachrichtigungen, Sicherung, Aktualisieren und Deinstallieren.

## Welche Shops gehen?

Die App öffnet die Produktseite unsichtbar in einem echten Browser-Fenster und liest den Preis aus den Produktdaten der Seite, bei Amazon, eBay und Magento-Shops mit eigenen Regeln, sonst über allgemeine Suchmuster. Streichpreise, UVP und Ratenpreise („ab 22,88 € / Monat“) werden ignoriert. Findet sie mehrere verschiedene Preise, wählst du den richtigen aus.

Geprüft an echten Seiten (November 2026): **Amazon.de, MediaMarkt, Saturn, IKEA**. Andere Shops sollten meist funktionieren, verlässlich zeigt sich das aber erst beim Ausprobieren. Zeigt ein Shop ein Captcha, kannst du die Seite in einem sichtbaren Fenster öffnen und es dort erledigen.

## Datenschutz

Alle Daten liegen nur auf deinem Rechner. Es gibt keinen Server und kein Konto. Die App spricht nur mit den Shops, deren Produkte du verfolgst, und fragt bei GitHub nach, ob es eine neue Version gibt. Shopseiten laufen abgeschottet in einem eigenen Speicherbereich, getrennt von deinem normalen Browser.

## Für Entwickler

```bash
npm install
```

```bash
npm start
```

```bash
npm test
```

App-Test mit Test-Shop (startet die echte App unsichtbar, ca. 1 Minute, mit `FOTOS=1` sichtbar und mit Bildschirmfotos):

```bash
npm run test:app
```

Fertige Datei testen und echte Shops ansehen:

```bash
npm run dist:linux && node tests/app/run.mjs "$PWD/dist/Preiswaechter-x86_64.AppImage"
```

```bash
node tests/app/echte-shops.mjs "https://www.ikea.com/de/de/p/billy-buecherregal-weiss-00263850/"
```

**Neue Version veröffentlichen:** Version in `package.json` erhöhen, committen, Tag `vX.Y.Z` pushen, dann `gh release create vX.Y.Z --verify-tag --notes "..."`. Der Workflow `build.yml` baut und testet beide Dateien und hängt sie an. Probelauf ohne Release: `gh workflow run build.yml`.

Aufbau: `src/main/` Hauptprozess (Speicher, Lesen der Seiten, Prüfung, Infobereich, Autostart), `src/renderer/` Oberfläche, `src/lib/` Preiserkennung, Diagramm, Regeln, Sicherung.

Die Ideen zur Preiserkennung stammen von [PriceGhost](https://github.com/clucraft/PriceGhost), einer selbst gehosteten Server-App. Der Code ist neu geschrieben. Bis Version 0.4.0 war der Preiswächter eine Browser-Erweiterung.

Lizenz: [MIT](LICENSE)
