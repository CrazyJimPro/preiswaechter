# Preiswächter in Firefox

Firefox installiert dauerhaft nur von Mozilla signierte Erweiterungen. Der Preiswächter wird deshalb als **temporäres Add-on** geladen. Das heißt:

- Nach **jedem Firefox-Start** muss er neu geladen werden (Abschnitt 3, dauert 20 Sekunden).
- Damit deine Produkte dabei **nicht verloren gehen**, sind einmalig zwei Einstellungen nötig (Abschnitt 2).

## 1. Ordner bereitlegen

Firefox lädt die Erweiterung aus einem Ordner auf deinem Rechner.

1. Die [Releases-Seite](https://github.com/CrazyJimPro/preiswaechter/releases) öffnen (das Repo ist privat, du musst bei GitHub angemeldet sein).
2. Beim neuesten Release unter **Assets** die Datei `preiswaechter-<Version>.zip` herunterladen.
3. Die Zip-Datei an einem festen Ort entpacken:
   - **Windows:** Rechtsklick auf die Datei → **Alle extrahieren …** → als Ziel z. B. `C:\Users\<dein Name>\Preiswaechter` eingeben → **Extrahieren**.
   - **Linux:** z. B. nach `~/Preiswaechter` entpacken (Rechtsklick → **Hier entpacken** oder `unzip preiswaechter-*.zip -d ~/Preiswaechter`).
4. Darin liegt der Ordner `preiswaechter` mit der Datei `manifest.json`.

Auf dem Entwicklungsrechner (Linux) geht auch direkt der Projektordner `~/claude/price-tracker/extension`.

## 2. Einmalig: Daten über Neustarts behalten

Ohne diesen Schritt löscht Firefox beim Beenden alle verfolgten Produkte.

1. `about:config` in die Adresszeile eingeben und Enter drücken.
2. **Risiko akzeptieren und fortfahren** klicken.
3. In das Suchfeld `extensions.webextensions.keepStorageOnUninstall` eingeben.
4. Erscheint der Eintrag nicht, rechts **Boolean** wählen und auf **+** klicken. Mit dem Doppelpfeil-Knopf auf **true** stellen.
5. Dasselbe für `extensions.webextensions.keepUuidOnUninstall` – ebenfalls auf **true**.

Es braucht **beide** Werte: Der erste behält die Daten, der zweite sorgt dafür, dass Firefox der Erweiterung beim Neuladen dieselbe interne Kennung gibt und die Daten wiederfindet. Mit nur einem der beiden sind die Daten weg (getestet mit Firefox 159).

## 3. Laden (nach jedem Firefox-Start)

1. `about:debugging#/runtime/this-firefox` in die Adresszeile eingeben und Enter drücken.
   Tipp: Die Seite als Lesezeichen speichern.
2. **Temporäres Add-on laden …** klicken.
3. Im Ordner `preiswaechter` die Datei `manifest.json` auswählen und öffnen.
4. „Preiswächter“ erscheint unter „Temporäre Erweiterungen“.

Beim ersten Mal das Symbol anheften: rechts neben der Adresszeile auf das Puzzle-Symbol → bei „Preiswächter“ auf das Zahnrad → **An Symbolleiste anheften**.

Beim Laden zeigt Firefox eventuell Warnungen zu `service_worker` oder `offscreen`. Die sind harmlos; diese Angaben sind für Chrome.

## 4. Benachrichtigungen erlauben

Zum Prüfen: Preiswächter-Symbol → **⚙** → **Testbenachrichtigung senden**.

Erscheint nichts:

- **Windows 10/11:** Start → Einstellungen → System → Benachrichtigungen → bei **Firefox** einschalten. „Nicht stören“ bzw. „Konzentrationsassistent“ muss aus sein.
- **Linux (GNOME/Ubuntu):** Einstellungen → Benachrichtigungen → **Firefox** einschalten, „Nicht stören“ aus.

## 5. Daten sichern

Gerade bei einem temporären Add-on lohnt sich ab und zu eine Sicherung:

1. Preiswächter-Symbol → **⚙** → **Sicherung herunterladen**. Die Datei `preiswaechter-sicherung-JJJJ-MM-TT.json` landet im Download-Ordner.
2. Zum Wiederherstellen: **⚙** → **Sicherung einspielen …** → Datei wählen → **Jetzt einspielen** → Zugriff auf die Shops erlauben.

Vorhandene Produkte bleiben beim Einspielen unverändert, nur ihr Verlauf wird ergänzt. Die Datei funktioniert auch in Chrome.

## 6. Auf eine neue Version aktualisieren

1. Die neue Zip-Datei von der [Releases-Seite](https://github.com/CrazyJimPro/preiswaechter/releases) herunterladen und an **denselben Ort** entpacken, sodass der alte Ordner `preiswaechter` überschrieben wird (Windows: „Dateien im Ziel ersetzen“ wählen).
2. `about:debugging#/runtime/this-firefox` → bei „Preiswächter“ auf **Neu laden** klicken.

## Wenn etwas nicht klappt

### Fehlermeldungen ansehen

- **Hintergrund (Prüfungen):** `about:debugging#/runtime/this-firefox` → bei „Preiswächter“ auf **Untersuchen** → Reiter **Konsole**.
- **Übersicht/Einstellungen:** Auf der Seite F12 drücken → **Konsole**.
- **Popup:** Fehler aus dem Popup erscheinen ebenfalls in der Konsole hinter **Untersuchen** (siehe oben), solange das Popup offen ist.

### Häufige Fälle

| Was du siehst | Was hilft |
|---|---|
| Nach dem Firefox-Start ist der Preiswächter weg | Normal bei temporären Add-ons – Abschnitt 3 wiederholen. |
| Nach dem Neuladen sind alle Produkte weg | Abschnitt 2 prüfen: Beide Werte müssen auf `true` stehen. Dann die letzte Sicherung einspielen (Abschnitt 5). |
| „Kein Zugriff auf diesen Shop“ | Produktseite öffnen → Preiswächter-Symbol → **Zugriff erlauben**. Oder `about:addons` → Preiswächter → **Berechtigungen**. |
| „Kein Preis auf der Seite gefunden“ | Prüfen, ob die Seite eine einzelne Produktseite ist. In den Einstellungen muss „Hintergrund-Tab benutzen“ an sein. Manche Shops verlangen ein Captcha: Seite einmal selbst öffnen, dann **Jetzt prüfen**. |
| Preise werden nicht aktualisiert | Geprüft wird nur, solange Firefox läuft und das Add-on geladen ist. In der Übersicht zeigt jedes Produkt „geprüft vor …“ und „nächste Prüfung in …“. |
