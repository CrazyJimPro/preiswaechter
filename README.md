# Preiswächter

Browser-Erweiterung für **Firefox und Chrome**, die Produktpreise in Online-Shops verfolgt – ohne Server, alles läuft im Browser.

Inspiriert von [PriceGhost](https://github.com/clucraft/PriceGhost) (selbst gehostete Server-App, MIT laut README). Übernommen wurden die Ideen der Preiserkennung (JSON-LD → Meta-Angaben → Shop-Erkennung → allgemeine Selektoren, Abstimmung mehrerer Methoden, Ratenpreise verwerfen), der Code ist neu geschrieben.

> **Stand: Meilenstein 1 (v0.1.0)** – Preis auf der offenen Seite erkennen und Produkt speichern.
> Noch nicht enthalten: Prüfung im Hintergrund, Preisverlauf-Diagramm, Benachrichtigungen (folgen in M2–M4).

## Ausprobieren

### Chrome

1. `chrome://extensions` öffnen.
2. Oben rechts **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** → den Ordner `extension` in diesem Projekt auswählen.
4. Über das Puzzle-Symbol in der Leiste „Preiswächter“ anheften.

Die Erweiterung bleibt dauerhaft installiert. Nach Code-Änderungen auf der Erweiterungskarte auf ⟳ klicken.

### Firefox (temporär)

1. `about:debugging#/runtime/this-firefox` öffnen.
2. **Temporäres Add-on laden …** → die Datei `extension/manifest.json` auswählen.

Firefox entfernt temporäre Add-ons beim Beenden. Damit die verfolgten Produkte dabei erhalten bleiben, einmalig in `about:config` den Wert `extensions.webextensions.keepStorageOnUninstall` auf `true` setzen.

### Benutzen

1. Eine Produktseite öffnen (z. B. bei Amazon, eBay oder einem anderen Shop).
2. Auf das Preiswächter-Symbol klicken – Name, Bild, Preis und Lagerstatus werden angezeigt.
3. Findet die Erweiterung mehrere unterschiedliche Preise, wählst du den richtigen aus.
4. Optional einen Zielpreis eintragen, dann **Preis verfolgen**.
5. Der Browser fragt einmal nach Zugriff auf diesen Shop – bitte erlauben, sonst kann später nicht im Hintergrund geprüft werden.

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

`npm run firefox` startet ein frisches Firefox-Profil mit geladener Erweiterung.
