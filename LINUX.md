# Preiswächter unter Linux

Gilt für Linux Mint und andere 64-Bit-Systeme. Die App ist eine einzelne Datei (AppImage), du brauchst **kein Passwort und keine Installation**. Zurück zur [Übersicht](README.md).

## Installieren

1. Lade die Datei herunter:
   **[Preiswaechter-x86_64.AppImage](https://github.com/CrazyJimPro/preiswaechter/releases/latest/download/Preiswaechter-x86_64.AppImage)**
   (ca. 125 MB, landet in deinem Ordner **Downloads**).
2. Verschiebe sie an einen festen Platz, zum Beispiel in einen neuen Ordner **Programme** in deinem Persönlichen Ordner. Dort bleibt sie liegen, sie **ist** das Programm.
3. Mach sie ausführbar: Rechtsklick auf die Datei → **Eigenschaften** → Reiter **Zugriffsrechte** → Haken bei **Der Datei erlauben sie als Programm auszuführen** → **Schließen**.
4. Doppelklick auf die Datei. Der Preiswächter startet.

Beim ersten Start legt die App selbst einen Eintrag im Startmenü an (unter **Zubehör**) und richtet den Autostart ein. Ab jetzt startest du sie über das Startmenü.

Verschiebst du die Datei später, starte sie einmal per Doppelklick von ihrem neuen Platz. Das Startmenü und der Autostart ziehen dann mit.

> Passiert beim Doppelklick nichts, siehe [Wenn etwas nicht klappt](#wenn-etwas-nicht-klappt).

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
2. Oben steht der aktuelle Preis, darunter das Diagramm. Wähle rechts den Zeitraum: **7 Tage**, **30 Tage**, **90 Tage**, **1 Jahr** oder **Alles**.
3. Fahre mit der Maus über das Diagramm. Du siehst den Preis, um wie viel er sich geändert hat und wie lange er galt.
4. **Verlauf als Tabelle** listet jede Preisänderung auf. Mit dem Häkchen **Alle Messpunkte zeigen** siehst du jede gespeicherte Messung. **Zum Shop** öffnet die Seite in deinem Browser.

So liest du das Diagramm:

- Eine **grüne Stufe** heißt günstiger, eine **rote Stufe** teurer.
- **Tief** und **Hoch** markieren den tiefsten und den höchsten Preis im gewählten Zeitraum.
- Die **gestrichelte Linie** ist der Preis beim Hinzufügen, die **durchgezogene graue Linie** dein Zielpreis.
- **Grau hinterlegt** ist die Zeit, in der das Produkt nicht lieferbar war.

Die Kacheln über dem Diagramm zeigen den tiefsten und höchsten Preis mit Datum und wie weit der aktuelle Preis über oder unter dem Durchschnitt liegt.

Die App merkt sich den Preis beim Hinzufügen. Oben in der Detailansicht und auf jeder Karte siehst du, was sich seitdem getan hat, zum Beispiel **Seit Hinzufügen: ▼ 105,00 € (−19,1 %)**. Über **Sortieren** → **Größte Ersparnis** stehen die besten Treffer oben. Mit **Sortieren** → **Preis zuletzt geändert** steht das Produkt oben, dessen Preis sich zuletzt verändert hat; Produkte ohne Preisänderung kommen ans Ende.

In der Übersicht heißt **▼** günstiger und **▲** teurer. Die farbige Pille neben dem Preis zeigt die letzte Änderung in Prozent. Ein grüner Strich links an der Karte markiert Produkte, die günstiger geworden sind, seit du zuletzt nachgesehen hast.

## Die Übersicht ordnen

- **Abzeichen** sagen dir, ob jetzt ein guter Zeitpunkt ist: **Zielpreis erreicht**, **Tiefstpreis seit 45 Tagen**, **Bester Preis bisher** (bei kürzerem Verlauf) oder **Unter dem Durchschnitt** (mindestens 3 % unter dem Schnitt der letzten 30 Tage).
- Hast du einen Zielpreis eingetragen, zeigt ein **Balken** auf der Karte, wie weit der Weg vom Preis beim Hinzufügen bis zum Ziel schon geschafft ist, zum Beispiel **noch 29,00 € bis Ziel 450,00 €**.
- Über der Liste stehen **Filter** mit der Anzahl der Treffer: **Zielpreis erreicht**, **Mit Problem**, **Pausiert**, **Nicht lieferbar**. Klicke auf **Alle**, um wieder alles zu sehen. Ein Filter ohne Treffer wird ausgeblendet.
- Oben rechts schaltest du zwischen **Kacheln** und **Liste** um. Die Liste zeigt jedes Produkt in einer Zeile, praktisch bei vielen Produkten. Die App merkt sich deine Wahl.

## Ein Produkt umbenennen oder eine Notiz anlegen

Shop-Namen sind oft sehr lang. Du kannst jedem Produkt einen eigenen Namen und eine Notiz geben.

1. Klicke in der Übersicht auf das Produkt und scrolle zu **Einstellungen für dieses Produkt**.
2. Trage unter **Eigener Name** einen kurzen Namen ein, zum Beispiel **Unsere Kaffeemaschine**.
3. Schreib bei Bedarf unter **Notiz** etwas dazu, zum Beispiel **Erst im Angebot kaufen**.
4. Klicke auf **Speichern**.

Der eigene Name erscheint in der Übersicht, in der Detailansicht und in den Benachrichtigungen. Den Namen aus dem Shop siehst du klein darunter. Die Notiz steht auf der Karte und über dem Diagramm, die Suche findet auch Wörter aus der Notiz. Leerst du das Feld **Eigener Name** und speicherst, gilt wieder der Name aus dem Shop.

## Den Preisverlauf als CSV-Datei speichern

1. Klicke in der Übersicht auf das Produkt.
2. Klappe unter dem Diagramm **Verlauf als Tabelle** auf.
3. Klicke auf **Als CSV speichern …**, wähle einen Ordner und klicke auf **Speichern**. Vorgeschlagen wird der Download-Ordner.

Die Datei `preisverlauf-NAME-JJJJ-MM-TT.csv` enthält alle Messpunkte mit Datum, Preis, Änderung und Lagerstatus. Sie öffnet sich per Doppelklick in Excel oder LibreOffice Calc direkt mit richtigen Spalten.

## Zielpreis und Benachrichtigungen einstellen

Die App meldet sich, wenn der Zielpreis erreicht ist, der Preis sinkt oder ein Produkt wieder lieferbar ist. Ein Klick auf die Meldung öffnet das Produkt.

1. Klicke in der Übersicht auf das Produkt und scrolle zu **Einstellungen für dieses Produkt**.
2. Trage **Zielpreis** und **Melden ab Preissenkung um (%)** ein. Bleibt das zweite Feld leer, meldet die App jede Senkung.
3. Klicke auf **Speichern**.

Prüfe einmal, ob Meldungen ankommen: **⚙ Einstellungen** → **Testbenachrichtigung senden**. Erscheint nichts, schau in den Systemeinstellungen unter **Benachrichtigungen** nach, ob „Nicht stören“ aus ist.

## Im Hintergrund laufen lassen

Geprüft wird nur, solange die App läuft. Deshalb startet sie automatisch beim Anmelden und liegt dann als Preisschild-Symbol im Panel neben der Uhr. Das **X** schließt nur das Fenster, die Prüfung läuft weiter.

- **Klick auf das Symbol:** öffnet das Fenster.
- **Rechtsklick:** **Preiswächter öffnen**, **Alle Preise jetzt prüfen**, **Beenden**.
- **Ein roter Punkt** am Symbol heißt: Etwas ist günstiger geworden.
- **Autostart abschalten:** **⚙ Einstellungen** → Haken bei **Beim Anmelden automatisch starten** entfernen.
- **Ganz beenden:** Rechtsklick auf das Symbol → **Beenden**, oder im Fenster `Strg` + `Q`.

Wie oft geprüft wird, stellst du je Produkt ein (15 Minuten bis 24 Stunden, Standard 1 Stunde). Für neue Produkte gilt der Wert unter **⚙ Einstellungen**.

## Das Design wechseln

**Schnell umschalten:** Klicke oben rechts auf **☾ Mitternacht** (im hellen Design) oder **☀ Hell** (im dunklen Design). Die App wechselt sofort.

**Über die Einstellungen:** Dort gibt es zusätzlich **Wie das System**.

1. Klicke auf **⚙ Einstellungen**.
2. Wähle ganz oben unter **Aussehen** bei **Design** den Eintrag **Wie das System**, **Hell** oder **Mitternacht**. Bei **Wie das System** richtet sich die App nach deinem Betriebssystem.

Ein Neustart ist nicht nötig, die Wahl bleibt beim nächsten Start erhalten.

## Eine Sicherung erstellen

1. Klicke auf **⚙ Einstellungen**.
2. Klicke unter **Datensicherung** auf **Sicherung speichern …**.
3. Wähle einen Ort, vorgeschlagen ist **Downloads**, und klicke auf **Speichern**.

Die Datei `preiswaechter-sicherung-JJJJ-MM-TT.json` enthält alle Produkte, den Preisverlauf und die Einstellungen je Produkt.

## Eine Sicherung einspielen oder umziehen

So holst du deine Daten zurück oder nimmst sie auf einen anderen Rechner mit, auch von Windows nach Linux.

1. Klicke auf **⚙ Einstellungen** → **Sicherung einspielen …** und wähle die Datei aus.
2. Die App zeigt an, wie viele Produkte neu sind. Klicke auf **Jetzt einspielen**.

Vorhandene Produkte bleiben dabei unverändert, nur ihr Preisverlauf wird ergänzt.

## Aktualisieren

Die Versionsnummer steht oben neben dem Namen, ein Klick darauf zeigt die Versionshinweise. Bei jedem Start fragt die App bei GitHub nach. Gibt es etwas Neues, erscheint dort das Abzeichen **Update verfügbar: vX**. Von Hand geht das unter **⚙ Einstellungen** → **Nach Updates suchen**.

1. Klicke auf das Abzeichen und lade auf der Seite unter **Assets** die Datei **Preiswaechter-x86_64.AppImage** herunter.
2. Beende die App: Rechtsklick auf das Symbol neben der Uhr → **Beenden**.
3. Ersetze die alte Datei an ihrem Platz durch die neue.
4. Mach sie wieder ausführbar (Rechtsklick → **Eigenschaften** → **Zugriffsrechte**) und starte sie.
5. Oben erscheint **Aktualisiert auf Version X**, und neben dem Namen steht die neue Nummer.

Deine Produkte und Einstellungen bleiben erhalten, sie liegen nicht in der Programmdatei.

## Deinstallieren

1. Klicke auf **⚙ Einstellungen** → **Aus dem Startmenü entfernen und beenden** und klicke zur Bestätigung noch einmal. Das entfernt Startmenü-Eintrag und Autostart und beendet die App.
2. Lösche die Datei `Preiswaechter-x86_64.AppImage`.

Deine Daten bleiben dabei liegen. Um auch sie zu löschen, entferne den Ordner `~/.config/Preiswaechter`. Der ist versteckt: Im Dateimanager mit `Strg` + `H` einblenden.

## Wenn etwas nicht klappt

| Was du siehst | Was hilft |
|---|---|
| Doppelklick auf die Datei tut nichts | Prüfe den Haken unter **Eigenschaften** → **Zugriffsrechte**. Sonst starte sie im Terminal, siehe unten, dort steht die Fehlermeldung. |
| Im Terminal: `dlopen(): error loading libfuse.so.2` | Es fehlt ein Paket: `sudo apt install libfuse2t64` (ältere Systeme: `libfuse2`). |
| Im Terminal: `The SUID sandbox helper binary was found, but is not configured correctly` | Tritt auf normalem Ubuntu ab 24.04 auf, unter Linux Mint normalerweise nicht. Das System sperrt die Sandbox, die die App für Shopseiten braucht. Siehe unten. |
| Nach dem Update hat sich nichts geändert | Schau auf die Nummer neben dem Namen. Steht dort die alte, läuft noch die alte App: Rechtsklick auf das Symbol neben der Uhr → **Beenden**, dann die neue Datei starten. Ab Version 1.1.0 beendet sich eine ältere laufende App von selbst, wenn du die neuere startest. Prüfe auch, ob du wirklich die neue Datei gestartet hast und nicht eine alte Kopie. |
| „Kein Preis auf der Seite gefunden“ | Prüfe, ob es eine einzelne Produktseite ist und keine Liste. Sonst **Im Fenster öffnen** beim Produkt bzw. **Seite im Fenster öffnen** beim Hinzufügen. |
| Falscher Preis erkannt | Produkt löschen und neu hinzufügen. Stimmt der Preis weiter nicht, schick mir den Link. |
| Preise bleiben alt | Läuft die App? Das Symbol muss im Panel liegen. In der Detailansicht steht „geprüft vor …“ und „nächste Prüfung in …“. |
| Keine Benachrichtigungen | **Testbenachrichtigung senden** und „Nicht stören“ prüfen, siehe oben. |

**Im Terminal starten**, um Fehlermeldungen zu sehen (`Strg` + `Alt` + `T`, Pfad anpassen):

```bash
~/Programme/Preiswaechter-x86_64.AppImage
```

**Logbuch:** `~/.config/Preiswaechter/logs/preiswaechter.log`. **Datenordner:** `~/.config/Preiswaechter`, die Produkte stehen in `daten.json`. In der App: **⚙ Einstellungen** → **Datenordner öffnen**.

**Sandbox-Sperre auf Ubuntu ab 24.04:** Die App startet dort erst, wenn die Sperre aufgehoben ist. Das gilt für das ganze System und schwächt eine Schutzmaßnahme von Ubuntu ab, darum nicht einfach so übernehmen. Getestet ist der Preiswächter bisher nur auf Linux Mint 22.3, wo die Sperre aus ist.

```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
```

Starte die App nicht mit `--no-sandbox`: Sie öffnet fremde Shopseiten, die Sandbox schützt dich dabei.
