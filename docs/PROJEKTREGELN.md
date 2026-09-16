# Master of Disaster – verbindliche Projektregeln

Stand: 16.09.2026

Diese Datei enthält dauerhaft geltende Arbeitsregeln für die Weiterentwicklung von **Master of Disaster**. Sie ist zusammen mit den datierten Projektständen unter `docs/projektstaende/` die Referenz, wenn alte Chatverläufe archiviert wurden.

## GitHub-Workflow

Für jede neue Codeänderung gilt grundsätzlich:

1. Vor Beginn den aktuellen Stand von `main` prüfen.
2. Für die Änderung einen **neuen Branch direkt vom aktuellen `main`** erstellen.
3. Auf diesem Branch beliebig viele notwendige Commits erstellen.
4. Einen Pull Request (PR) gegen `main` öffnen.
5. Solange der PR noch nicht gemergt ist, Korrekturen weiterhin auf demselben Branch durchführen; neue Commits werden automatisch Bestandteil des offenen PR.
6. Automatische Tests/CI prüfen und Fehler vor dem Merge beheben.
7. Erst nach erfolgreicher Prüfung den PR nach `main` mergen.
8. Deployment/Bereitstellung prüfen.
9. Die echte PWA auf dem iPhone bzw. im vorgesehenen Produktionsbetrieb testen.
10. Eine Änderung erst dann als **LIVE/PASS** bezeichnen, wenn der reale Runtime-Test erfolgreich war.
11. Den zugehörigen Entwicklungsbranch erst **nach LIVE/PASS** löschen.

## Fehler nach dem Merge

Wird ein Fehler erst nach dem Merge bzw. im realen PWA-Test festgestellt:

- den bereits gemergten alten Branch nicht wieder als normalen Entwicklungszweig weiterverwenden,
- stattdessen einen **neuen Hotfix-/Korrektur-Branch vom aktuellen `main`** erstellen,
- Korrektur dort durchführen,
- neuen PR erstellen,
- erneut mergen, deployen und real testen,
- nach LIVE/PASS auch diesen Branch löschen.

## Branch-Hygiene

- Gemergte und erfolgreich getestete Arbeitsbranches sollen nicht dauerhaft liegen bleiben.
- Alte Branches nicht für neue, fachlich andere Änderungen wiederverwenden.
- Vor manuellen Änderungen über die GitHub-Weboberfläche immer prüfen, **welcher Branch ausgewählt ist**.
- Direkte Änderungen auf `main` nur in ausdrücklich begründeten Ausnahmefällen.
- Parallel laufende Branches nur dann, wenn tatsächlich parallel an getrennten Themen gearbeitet wird.
- Branch-Namen sollen den Zweck erkennen lassen, z. B. `vNNN-thema`, `fix/...`, `hotfix/...`, `docs/...` oder `cleanup/...`.

## Bedeutung der Statusbegriffe

- **Commit:** gespeicherter Änderungsschritt innerhalb eines Branches.
- **Branch:** temporärer Arbeitszweig auf Basis eines bestimmten Git-Stands.
- **Pull Request / PR:** Vorschlag und Prüfvorgang, Änderungen eines Branches nach `main` zu übernehmen.
- **Merge:** tatsächliche Übernahme der freigegebenen Änderungen nach `main`.
- **Deployment:** Bereitstellung des neuen `main`-Stands für die PWA/GitHub Pages.
- **LIVE/PASS:** Deployment erfolgt und gewünschtes Verhalten in der echten PWA erfolgreich geprüft.

## Daten- und Sicherheitsregel

- `main` ist die maßgebliche Codequelle.
- Produktive App-Daten dürfen durch Tests nicht absichtlich verschmutzt werden.
- App-Backups auf iPhone/Cloud sind zusätzliche Wiederherstellungspunkte, ersetzen aber nicht die Prüfung von Git-Historie und einzigartigen Branch-Commits vor einer Bereinigung.
- Dateien auf `main` werden nicht allein aufgrund einer alten Versionsnummer gelöscht. Entscheidend ist, ob sie noch referenziert oder für aktuelle Regressionstests benötigt werden.

## Projektstände

Datierte konsolidierte Projektstände liegen unter:

`docs/projektstaende/`

Wenn nach früheren oder aktuellen Projektständen gefragt wird, zuerst den dortigen Index prüfen und anschließend – falls nötig – den aktuellen GitHub-/Supabase-/Runtime-Stand frisch verifizieren.
