# Master of Disaster – zentraler Projektstand

**Snapshot:** 16.09.2026, 18:34 Uhr (Europe/Berlin)  
**Zweck:** Konsolidierter Referenzstand für die Fortführung des Projekts nach Archivierung älterer Chatverläufe.

> Dieser Stand ist ein Projekt-Snapshot, kein automatischer Nachweis dafür, dass jede darin genannte Funktion aktuell LIVE/PASS ist. Für Code- oder Laufzeitstatus immer GitHub `main`, Deployment und echten Runtime-Test prüfen.

## 1. Hauptsystem

- Projekt: **Master Of Disaster Week-And-End To-Do-Dingsi**
- GitHub: `ngtzvpv8dz-create/Master-Of-Disaster`
- Supabase-Hauptprojekt: **Master Of Disaster Week-And-End To-Do-Dingsi**
- Project Ref: `oktpzwhhndsbikkeelot`
- GitHub `main` ist die maßgebliche Codequelle.
- Für normale To-do-/PWA-Daten bleibt die lokale PWA-Datenhaltung (`localStorage`) grundsätzlich Master.
- Supabase dient u. a. als Remote-Command-Mailbox, Spiegel einzelner Daten und Cloud-/Integrationsschicht.
- Für **Mega-Sortierung/Kistology** ist dagegen das Supabase-Hauptprojekt mit Schema `mega_sortierung` maßgeblich.

## 2. Entwicklungsworkflow

Vor Änderungen:
1. aktuellen `main`-Stand prüfen,
2. eigenen Branch verwenden,
3. Änderung durchführen,
4. Tests/CI prüfen,
5. Pull Request erstellen,
6. nach Freigabe nach `main` mergen,
7. Deployment prüfen,
8. echten Runtime-/Smoke-Test durchführen,
9. erst danach eine Funktion als **LIVE/PASS** bezeichnen.

Produktive App-Daten nicht durch künstliche Testdaten verschmutzen.

## 3. Aktueller verifizierter GitHub-Stand zum Snapshot

- `main` geprüft am 16.09.2026.
- Aktueller `main`-Commit bei Erstellung dieses Snapshots: `fb99fdfed69439f5e0597eef3c0c891553bbbbfc`.
- Jüngste bestätigte gemergte Feature-Version in der PR-Historie: **V540**, PR #162, „Future-Platzhalter wird Progress“.
- V540 ersetzt im Hub den bisherigen FUTURE-Platzhalter durch **PROGRESS**; der Bereich ist vorbereitet, aber noch nicht als vollständiger Progress-Funktionsumfang zu verstehen.
- Die ältere Angabe V533 ist daher nur historisch und nicht mehr der aktuelle GitHub-Codebasestand.

## 4. Master-of-Disaster-PWA

Bekannte Hauptbereiche/Funktionen:
- To-do-/Aufgabenverwaltung
- HEUTE / ALLE / PRIORITÄT / FÄLLIG / PAUSIERT / ARCHIV
- Kategorien
- Arbeits-/Timersegmente
- Archiv und Statistiken
- gruppierte Ansichten / Reihenfolgen
- Theme-/Scene-System
- Titelverwaltung
- Remote Commands
- Backup-/Restore-Funktionen
- Backstage / Maschinenraum
- SPORT
- FOOD
- KISTOLOGY
- PROGRESS als vorbereiteter Bereich

Bei echten Arbeitssegmenten oder Timerdaten niemals aus Erinnerung rekonstruieren. Erst aktuellen App-Zustand per Report/Remote Command prüfen.

## 5. Backstage / Backup / Restore

Bekannte zentrale Bereiche:
- DEV
- LOG
- BACKUP
- RESTORE
- SYSTEM
- VOLLBACKUP

Bekannte Fähigkeiten:
- ZIP-Vollbackup
- ZIP-Import
- localStorage/App-Daten im Backup
- App-Dateien
- Recovery-/Restore-Punkte
- Logdaten
- Cloud-/Wochenbackups
- Sicherung vor Restore-Vorgängen

Destruktive Restore-Aktionen immer erst gegen den aktuellen Stand prüfen.

## 6. Remote Commands

Supabase wird als Remote-Command-Schicht genutzt. Bekannte/gedachte Aktionen:
- Aufgaben hinzufügen
- Aufgaben bzw. Arbeitsblöcke starten/setzen
- Status/Segmente reporten
- Fehlerhafte Task-Segmente prüfen bzw. reparieren
- aktuellen Appzustand zurückmelden

Diese Infrastruktur ist auch die Grundlage für spätere externe Integrationen, z. B. Alexa.

## 7. Mega-Sortierung / Kistology

### Aktive Datenbank
- Supabase: `oktpzwhhndsbikkeelot`
- Schema: `mega_sortierung`
- zentrale Tabellen: `mega_sortierung.items`, `mega_sortierung.containers`

### Altes separates Projekt
- altes Project Ref: `ryasjfnfspvnutfnlbea`
- Status: **nur inaktives Sicherheitsbackup**
- dort nichts mehr eintragen oder ändern
- nicht als aktuellen Lagerstand verwenden
- nicht löschen oder reaktivieren

### Bekannter Migrations-/Bestandsstand
- 14 Container
- 472 Inventarpositionen
- 469 aktiv
- 3 inaktiv
- 234 physisch bestätigt zugeordnet
- 235 noch nicht endgültig bestätigt

Historische Soll-Zuordnungen sind Referenz, nicht aktuelle Wahrheit.

### Verbindliche Sortierregeln
- **Physische Realität schlägt jede alte Liste.**
- Inventarnummern erhalten.
- nichts eigenmächtig umbenennen, zusammenlegen oder löschen.
- historische Zuordnung nur als Referenz verwenden.
- Kiste erst nach physischer Kontrolle als aktuell bestätigt markieren.

Ablauf pro Kiste:
1. historischen Soll-Bestand aus dem Hauptprojekt ermitteln,
2. als historischen Referenzstand kennzeichnen,
3. tatsächlichen Inhalt physisch prüfen,
4. Abweichungen erfassen,
5. aktuellen Bestand erst danach in Supabase festlegen.

### K4
- **BEFESTIGUNG · KABELMANAGEMENT**
- am 13.09.2026 vollständig physisch geprüft und abgeschlossen
- 27 Positionen: 15 Hauptfach, 6 NOJIG 10×10 cm, 6 NOJIG 10×20 cm
- K4 nicht wieder als offene Kiste behandeln

### Als geprüft/abgeschlossen geführt
G2, K1, K2, K3, K4, K5, K8, K9, K10, M1, M4, M5, Mi5, Mi6.

### Noch offen bzw. weiter zu prüfen
Unter anderem G1, M2, M3, M6, K6A, K6B, K7, Mi1, Mi2, Mi3, Mi4 und die große Angelkiste.

Bei Eagle-Eye-Extra-Kiste zunächst physische Existenz klären. K3A/K3B und K8A nicht wie normale offene Kisten behandeln; K8B entspricht K8.

Keine starre Restreihenfolge aus alten Chats ableiten. Vor der nächsten Kiste frisch prüfen, welche Kisten tatsächlich noch offen sind.

## 8. SPORT / Apple Health

Health-Anbindung ist **geplant und teilweise vorbereitet, aber noch nicht Ende-zu-Ende fertig**.

Geplante Architektur:
`Apple Watch / iPhone → Apple Health → iPhone-Kurzbefehl → Supabase → Master-of-Disaster-PWA / SPORT`

Grund: Eine normale Web-PWA kann Apple Health nicht direkt auslesen.

Bekannte vorbereitete Bausteine:
- Health-Sync-Hook
- Supabase-Health-Datenstrukturen
- `health-shortcuts-sync-v1`
- `progress_daily`

Geplante Auslösung:
- SPORT über Hub bzw. blaues S öffnen → Health-Sync anstoßen
- SPORT verlassen / zurück zu To-do → keinen zusätzlichen Sync starten

Bekannter Event-Hook:
- `mod:health-sync-request`
- Quelle `hub-sport`

Noch offen:
- Kurzbefehl wirklich mit Supabase verbinden
- reale Health-Daten synchronisieren
- Ende-zu-Ende testen

## 9. YAZIO

Die korrekte Bezeichnung lautet **YAZIO**.

Ziel:
- Ernährungs-/Abnehmdaten mit SPORT/PROGRESS verbinden.

Geplante Datenroute:
`YAZIO ↔ Apple Health → iPhone-Kurzbefehl → Supabase → Master of Disaster`

Ein direkter belastbarer persönlicher YAZIO-API-Zugriff wurde bislang nicht als Grundlage festgelegt.

Noch zu testen:
- welche YAZIO-Daten tatsächlich nach Apple Health geschrieben werden,
- Kalorien / Ernährung,
- Gewicht,
- weitere brauchbare Werte.

FOOD bleibt zunächst hauptsächlich Rezept-/Essensplanungsbereich.

## 10. PROGRESS

PROGRESS ist im Hub seit V540 an Stelle des früheren FUTURE-Platzhalters vorgesehen.

Langfristig geplant:
- Gewicht
- Aktivität
- Training
- Ernährung
- Fortschrittsdiagramme
- Laufdaten wie Dauer, Distanz, Pausen, Geschwindigkeit

PROGRESS erst auf belastbare Daten aufbauen, wenn die Health-/YAZIO-Datenpipeline zuverlässig funktioniert.

## 11. Aktuelles Apple-Health-/YAZIO-Diagnosethema

Zuletzt beobachtet:
- Schritte vorhanden
- Distanz vorhanden
- Stockwerke vorhanden
- Ruheenergie vorhanden
- Aktivitätsenergie fehlte bzw. wurde nicht erwartungsgemäß übernommen

Das ist ein offener Diagnosepunkt für die spätere zuverlässige Health-/YAZIO-Integration.

## 12. Alexa Skill / Sprachsteuerung

Technisch grundsätzlich machbar.

Geplante Architektur:
`Alexa Custom Skill → Alexa-hosted Backend oder AWS Lambda → Supabase → Remote Commands / synchronisierter Zustand → PWA`

Mögliche Sprachaktionen:
- Aufgabe erstellen
- Aufgabe starten
- Aufgabe pausieren/beenden
- Aufgabe erledigen
- später Kistology/Inventar abfragen
- später Statusinformationen abrufen

Alexa ist **bewusst niedrige Priorität / späterer Backlog** und soll aktuelle Kernarbeiten nicht verdrängen.

## 13. PDF-Export

PDF-Export bleibt als geplante Funktion bestehen. Kein belastbarer Stand, nach dem der vollständige gewünschte Export bereits als LIVE/PASS gelten dürfte.

## 14. Bekannte offene technische Themen

- Health-Sync Ende-zu-Ende fertigstellen
- echte Health-Daten nach Supabase übertragen
- YAZIO→Apple-Health-Datenumfang testen
- PROGRESS danach funktional ausbauen
- weitere Mega-Sortierungs-Kisten physisch prüfen
- ungeklärte Inventarpositionen bereinigen
- PDF-Export
- Alexa später
- separaten iOS/WebKit-Startblitz weiter untersuchen, falls noch reproduzierbar

## 15. Empfohlene Arbeitsstränge

### MASTER – Projektsteuerung
Architektur, Prioritäten, Übergaben, Gesamtüberblick.

### PWA – Entwicklung
GitHub, Versionen, PRs, Bugs, UI, Backstage.

### KISTOLOGY – Mega-Sortierung
Kisten, Inventar, Supabase `mega_sortierung`.

### HEALTH – SPORT / YAZIO / PROGRESS
Apple Health, Kurzbefehle, Supabase Health, Ernährung, Fortschritt.

### INTEGRATIONEN
Alexa und spätere externe Systeme.

Diese Bereiche gehören zum selben Gesamtprojekt, sollten aber als getrennte Arbeitsstränge geführt werden.

## 16. Pflege dieses Projektstands

- Neue konsolidierte Stände werden **nicht überschrieben**, sondern als neue Datei unter `docs/projektstaende/` angelegt.
- Dateinamensschema: `YYYY-MM-DD_HHMM_Master-of-Disaster-Projektstand.md`
- `docs/projektstaende/README.md` dient als Index aller verfügbaren Projektstände.
- Bei der Frage nach vorhandenen Projektständen zuerst diesen Ordner bzw. den Index prüfen.
- Alte Chatverläufe dürfen archiviert werden; wichtige neue Entscheidungen müssen in zukünftige Snapshots übernommen werden.
