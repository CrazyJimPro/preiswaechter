# Preiswächter unter Windows

Gilt für Windows 10 und 11 (64 Bit). Du brauchst **keine Adminrechte**. Zurück zur [Übersicht](README.md).

## Installieren

1. Lade den Installer herunter:
   **[PreiswaechterSetup.exe](https://github.com/CrazyJimPro/preiswaechter/releases/latest/download/PreiswaechterSetup.exe)**
   (ca. 100 MB, landet in deinem Ordner **Downloads**).
2. Falls der Browser meldet, die Datei werde *nicht häufig heruntergeladen*: in der Download-Liste auf **⋯** → **Behalten** → **Trotzdem behalten** klicken.
3. Doppelklick auf **PreiswaechterSetup.exe**.
4. Wahrscheinlich erscheint ein blaues Fenster **„Der Computer wurde durch Windows geschützt“**. Das liegt daran, dass der Installer nicht bei Microsoft signiert ist. Klicke auf **Weitere Informationen** und dann auf **Trotzdem ausführen**.
5. Ein kurzer Fortschrittsbalken läuft durch, eine Rückfrage gibt es nicht. Danach startet der Preiswächter von selbst.
6. Ab jetzt findest du **Preiswächter** im Startmenü und als Verknüpfung auf dem Desktop.

## Ein Produkt hinzufügen

1. Öffne im Browser die Seite des Produkts und kopiere den Link aus der Adresszeile (`Strg` + `L`, dann `Strg` + `C`).
2. Wechsle zum Preiswächter. Der Link steht meist schon im Feld oben. Sonst klicke hinein und drücke `Strg` + `V`.
3. Klicke auf **Hinzufügen**. Nach ein paar Sekunden erscheinen Name, Bild und Preis.
4. Findet die App mehrere verschiedene Preise, wähle den richtigen aus.
5. Trage bei Bedarf einen **Zielpreis** ein und klicke auf **Preis verfolgen**.

### Wenn kein Preis gefunden wird

Manche Shops zeigen zuerst ein Captcha oder eine Cookie-Abfrage. Dann erscheint der Knopf **Seite im Fenster öffnen**:

1. Klicke darauf, ein Fenster mit der Shopseite geht auf.
2. Erledige dort die Abfrage, bis das Produkt zu sehen ist.
3. Schließe das Fenster mit dem **X**. Die App liest den Preis beim Schließen und zeigt ihn an.

## Den Preisverlauf ansehen

1. Klicke in der Übersicht auf ein Produkt.
2. Oben steht der aktuelle Preis, darunter das Diagramm. Wähle rechts den Zeitraum: **7 Tage**, **30 Tage**, **90 Tage** oder **Alles**.
3. Fahre mit der Maus über das Diagramm, dann siehst du den Preis zu jedem Zeitpunkt.
4. **Verlauf als Tabelle** listet jede Messung auf, **Zum Shop** öffnet die Seite in deinem Browser.

Die App merkt sich den Preis beim Hinzufügen. Oben in der Detailansicht und auf jeder Karte siehst du, was sich seitdem getan hat, zum Beispiel **Seit Hinzufügen: ▼ 105,00 € (−19,1 %)**. Über **Sortieren** → **Größte Ersparnis** stehen die besten Treffer oben.

In der Übersicht heißt **▼** günstiger und **▲** teurer. Ein grüner Strich links an der Karte markiert Produkte, die günstiger geworden sind, seit du zuletzt nachgesehen hast.

## Zielpreis und Benachrichtigungen einstellen

Die App meldet sich unten rechts, wenn der Zielpreis erreicht ist, der Preis sinkt oder ein Produkt wieder lieferbar ist. Ein Klick auf die Meldung öffnet das Produkt.

1. Klicke in der Übersicht auf das Produkt und scrolle zu **Einstellungen für dieses Produkt**.
2. Trage **Zielpreis** und **Melden ab Preissenkung um (%)** ein. Bleibt das zweite Feld leer, meldet die App jede Senkung.
3. Klicke auf **Speichern**.

Prüfe einmal, ob Meldungen ankommen: **⚙ Einstellungen** → **Testbenachrichtigung senden**. Erscheint nichts: Windows-Einstellungen → **System** → **Benachrichtigungen** → **Preiswächter** einschalten, „Nicht stören“ muss aus sein.

## Im Hintergrund laufen lassen

Geprüft wird nur, solange die App läuft. Deshalb startet sie nach der Installation automatisch beim Anmelden und liegt dann als Preisschild-Symbol unten rechts neben der Uhr. Das **X** schließt nur das Fenster, die Prüfung läuft weiter.

- **Klick auf das Symbol:** öffnet das Fenster.
- **Rechtsklick:** **Preiswächter öffnen**, **Alle Preise jetzt prüfen**, **Beenden**.
- Windows versteckt neue Symbole gern hinter dem **Pfeil ^** neben der Uhr. Damit es immer sichtbar ist, zieh es von dort in die Leiste.
- **Ein roter Punkt** am Symbol heißt: Etwas ist günstiger geworden.
- **Autostart abschalten:** **⚙ Einstellungen** → Haken bei **Beim Anmelden automatisch starten** entfernen.
- **Ganz beenden:** Rechtsklick auf das Symbol → **Beenden**, oder im Fenster `Strg` + `Q`.

Wie oft geprüft wird, stellst du je Produkt ein (15 Minuten bis 24 Stunden, Standard 1 Stunde). Für neue Produkte gilt der Wert unter **⚙ Einstellungen**.

## Das dunkle Design einschalten

1. Klicke auf **⚙ Einstellungen**.
2. Wähle ganz oben unter **Aussehen** bei **Design** den Eintrag **Dunkel**. Die App wechselt sofort, ein Neustart ist nicht nötig.

Zur Auswahl stehen **Wie das System**, **Hell** und **Dunkel**. Die Wahl bleibt beim nächsten Start erhalten.

## Eine Sicherung erstellen

1. Klicke auf **⚙ Einstellungen**.
2. Klicke unter **Datensicherung** auf **Sicherung speichern …**.
3. Wähle einen Ort, vorgeschlagen ist **Downloads**, und klicke auf **Speichern**.

Die Datei `preiswaechter-sicherung-JJJJ-MM-TT.json` enthält alle Produkte, den Preisverlauf und die Einstellungen je Produkt.

## Eine Sicherung einspielen oder umziehen

So holst du deine Daten zurück oder nimmst sie auf einen anderen Rechner mit, auch von Linux nach Windows.

1. Klicke auf **⚙ Einstellungen** → **Sicherung einspielen …** und wähle die Datei aus.
2. Die App zeigt an, wie viele Produkte neu sind. Klicke auf **Jetzt einspielen**.

Vorhandene Produkte bleiben dabei unverändert, nur ihr Preisverlauf wird ergänzt.

## Aktualisieren

Die Versionsnummer steht oben neben dem Namen, ein Klick darauf zeigt die Versionshinweise. Bei jedem Start fragt die App bei GitHub nach. Gibt es etwas Neues, erscheint dort das Abzeichen **Update verfügbar: vX**. Von Hand geht das unter **⚙ Einstellungen** → **Nach Updates suchen**.

1. Klicke auf das Abzeichen und lade auf der Seite unter **Assets** die Datei **PreiswaechterSetup.exe** herunter.
2. Starte die Datei. Die neue Version ersetzt die alte.
3. Oben erscheint **Aktualisiert auf Version X**, und neben dem Namen steht die neue Nummer.

Deine Produkte und Einstellungen bleiben erhalten.

## Deinstallieren

1. Beende die App: Rechtsklick auf das Symbol neben der Uhr → **Beenden**.
2. Windows-Einstellungen → **Apps** → **Installierte Apps** → **Preiswächter** → **Deinstallieren**.

Deine Daten bleiben dabei liegen, damit eine spätere Neuinstallation sie wiederfindet. Um auch sie zu löschen: `Windows` + `R` drücken, `%APPDATA%\Preiswaechter` eingeben, `Enter`, und den Ordner löschen.

## Wenn etwas nicht klappt

| Was du siehst | Was hilft |
|---|---|
| „Kein Preis auf der Seite gefunden“ | Prüfe, ob es eine einzelne Produktseite ist und keine Liste. Sonst **Im Fenster öffnen** beim Produkt bzw. **Seite im Fenster öffnen** beim Hinzufügen. |
| Falscher Preis erkannt | Produkt löschen und neu hinzufügen. Stimmt der Preis weiter nicht, schick mir den Link. |
| Preise bleiben alt | Läuft die App? Das Symbol muss neben der Uhr liegen. In der Detailansicht steht „geprüft vor …“ und „nächste Prüfung in …“. |
| Keine Benachrichtigungen | **Testbenachrichtigung senden** und die Windows-Einstellungen prüfen, siehe oben. |
| Die App startet nicht oder stürzt ab | Logbuch ansehen, siehe unten. |

**Logbuch:** `Windows` + `R` drücken, `%APPDATA%\Preiswaechter\logs` eingeben, `Enter`, dann `preiswaechter.log` öffnen. Oder in der App **⚙ Einstellungen** → **Datenordner öffnen** → Ordner `logs`.

**Datenordner:** `%APPDATA%\Preiswaechter`, die Produkte stehen in `daten.json`. **Programm:** `%LOCALAPPDATA%\Programs\Preiswaechter`.
