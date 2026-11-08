# Preiswächter in Chrome

Gilt auch für Microsoft Edge, Brave und Vivaldi; dort heißen die Menüs leicht anders, die Schritte sind dieselben.

In Chrome bleibt die Erweiterung nach dem Laden **dauerhaft installiert**, auch nach einem Neustart.

## 1. Erweiterung einrichten

### Ordner bereitlegen

Chrome lädt die Erweiterung aus dem Ordner `extension` dieses Projekts. Der Ordner muss dauerhaft an seinem Platz bleiben; wird er verschoben oder gelöscht, ist die Erweiterung weg.

- **Linux:** Der Ordner liegt unter `~/claude/price-tracker/extension`.
- **Windows:** Den Ordner `extension` an einen festen Ort kopieren, zum Beispiel nach `C:\Users\<dein Name>\Preiswaechter\extension`.

### Laden

1. In Chrome `chrome://extensions` in die Adresszeile eingeben und Enter drücken.
2. Oben rechts den Schalter **Entwicklermodus** einschalten.
3. Oben links auf **Entpackte Erweiterung laden** klicken.
4. Den Ordner `extension` auswählen (den Ordner selbst, nicht eine Datei darin) und bestätigen.
5. Die Karte „Preiswächter 0.4.0“ erscheint.

### Symbol anheften

1. Rechts neben der Adresszeile auf das Puzzle-Symbol klicken.
2. Bei „Preiswächter“ auf die Stecknadel klicken. Das Preisschild-Symbol bleibt jetzt sichtbar.

## 2. Benachrichtigungen erlauben

Chrome darf Benachrichtigungen meist schon. Zum Prüfen: Preiswächter-Symbol → **⚙** → **Testbenachrichtigung senden**.

Erscheint nichts:

- **Windows 10/11:** Start → Einstellungen → System → Benachrichtigungen → bei **Google Chrome** einschalten. „Nicht stören“ bzw. „Konzentrationsassistent“ muss aus sein.
- **Linux (GNOME/Ubuntu):** Einstellungen → Benachrichtigungen → **Google Chrome** einschalten, „Nicht stören“ aus.

## 3. Auf eine neue Version aktualisieren

1. Den Inhalt des Ordners `extension` durch die neue Version ersetzen (gleicher Ordner, gleicher Ort).
2. `chrome://extensions` öffnen und auf der Karte „Preiswächter“ auf den Pfeilkreis **⟳** klicken.

Deine Produkte und der Verlauf bleiben dabei erhalten.

## 4. Daten sichern und umziehen

1. Preiswächter-Symbol → **⚙** → **Sicherung herunterladen**. Die Datei `preiswaechter-sicherung-JJJJ-MM-TT.json` landet im Download-Ordner.
2. Auf dem anderen Rechner oder in Firefox: **⚙** → **Sicherung einspielen …** → Datei wählen → **Jetzt einspielen** → Zugriff auf die Shops erlauben.

## 5. Entfernen

`chrome://extensions` → Karte „Preiswächter“ → **Entfernen**. Dabei werden alle Produkte und der Verlauf gelöscht; vorher eine Sicherung herunterladen, wenn du sie behalten willst.

## Wenn etwas nicht klappt

### Fehlermeldungen ansehen

- **Hintergrund (Prüfungen):** `chrome://extensions` → Karte „Preiswächter“ → Link **Service Worker** → Reiter **Console**.
- **Popup:** Mit der rechten Maustaste in das geöffnete Popup klicken → **Untersuchen** → **Console**.
- **Übersicht/Einstellungen:** Auf der Seite F12 drücken → **Console**.
- Gibt es auf der Karte unter `chrome://extensions` einen roten Knopf **Fehler**, stehen dort gesammelte Fehlermeldungen.

### Häufige Fälle

| Was du siehst | Was hilft |
|---|---|
| „Kein Zugriff auf diesen Shop“ | Produktseite öffnen → Preiswächter-Symbol → **Zugriff erlauben**. Oder `chrome://extensions` → Preiswächter → **Details** → „Websitezugriff“. |
| „Kein Preis auf der Seite gefunden“ | Prüfen, ob die Seite eine einzelne Produktseite ist. In den Einstellungen muss „Hintergrund-Tab benutzen“ an sein. Manche Shops verlangen ein Captcha: Seite einmal selbst öffnen, dann **Jetzt prüfen**. |
| Falscher Preis erkannt | Produkt in der Übersicht löschen und auf der Produktseite neu hinzufügen; bei mehreren gefundenen Preisen den richtigen auswählen. |
| Preise werden nicht aktualisiert | Geprüft wird nur, solange Chrome läuft. In der Übersicht zeigt jedes Produkt „geprüft vor …“ und „nächste Prüfung in …“. |
| Warnungen auf der Karte, die `browser_specific_settings` oder `background.scripts` erwähnen | Harmlos – diese Angaben sind für Firefox und werden von Chrome ignoriert. |
| Beim Chrome-Start Hinweis auf Erweiterungen im Entwicklermodus | Wegklicken („Schließen“). Nicht auf „Deaktivieren“ klicken, sonst ist der Preiswächter aus. |
