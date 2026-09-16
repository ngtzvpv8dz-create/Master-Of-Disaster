# Master of Disaster – Repository-Cleanup-Audit

Stand: 16.09.2026

Ziel: GitHub aufräumen, ohne aktuelle PWA-Funktionalität oder noch nicht übernommene Änderungen versehentlich zu verlieren.

## Grundsatz

- Branches sind Arbeitszweige und sollen nach erfolgreichem Merge, Deployment und LIVE/PASS nicht dauerhaft liegen bleiben.
- Die PR-Historie bleibt auch nach Löschen eines Branches erhalten.
- Commits auf `main` bleiben Teil der Git-Historie; ein gelöschter Arbeitsbranch entfernt nicht automatisch gemergten Code aus `main`.
- Dateien werden niemals nur aufgrund einer niedrigen Versionsnummer gelöscht. Viele ältere V3xx/V4xx/V5xx-Dateien werden von der aktuellen PWA noch aktiv geladen.

## Aktueller Befund

- Das Repository besitzt eine sehr große Zahl historischer Arbeitsbranches; allein die Branch-Suche nach Versionszweigen lieferte 193 Treffer, zusätzlich existieren `main` und weitere nicht mit `v` gefundene Branches.
- Zum Audit-Zeitpunkt existiert kein offener Pull Request.
- Der Großteil der Branches gehört zu abgeschlossenen, bereits gemergten PRs oder historischen Tests/Experimente.
- Einige Branches wurden nach einem Merge weiterverwendet oder enthalten bewusst historische/abweichende Stände. Deshalb darf nicht pauschal nach Versionsnummer gelöscht werden.

## Sicher erkannte Aufräumkandidaten

### V422-Duplikatfamilie

Mehrere alte `fix/v422-video-icon-unify-*`-Branches zeigen auf denselben bereits vollständig in `main` enthaltenen Stand. Ein repräsentativer Vergleich (`fix/v422-video-icon-unify-2`) ergibt `ahead_by = 0`; der Branch liegt nur noch weit hinter `main`.

Diese Duplikatfamilie besitzt damit keinen aktuellen eigenständigen Codewert mehr und ist als Branch-Löschkandidat einzustufen.

### Explizit verworfene/Test-Branches

- `v521-floating-launcher-surface` – PR #140 wurde ausdrücklich als verworfen/obsolete geschlossen und nicht gemergt.
- `test/v426-regression-suite` – PR #26 war ausdrücklich ein temporärer Test-PR und sollte nicht gemergt werden.

Diese Branches sind historische Arbeitsreste und keine aktuelle Produktivquelle.

### Alte Backup-/Restore-Zweige

Geprüfte Beispiele:

- `backup-v392-before-pages-fix`: ca. 1313 Commits hinter aktuellem `main`; Abweichungen betreffen nur alte Build-/Offline-/Service-Worker-Dateien aus dem V39x/V400-Umfeld.
- `backup-broken-v401-before-v398-rollback`: ebenfalls ca. 1313 Commits hinter `main`; zusätzliche Unterschiede betreffen alte Runtime-/Pages-Smoke- und Offline-/Service-Worker-Stände.
- `restore/v418-2026-08-20-1602`: ca. 1150 Commits hinter `main`; Unterschiede bestehen aus historischen V416/V418-UI- und Workflowständen.

Für den aktuellen Produktivcode sind diese Zweige technisch überholt. Die heutige App besitzt außerdem eigene vollständige Backups auf iPhone/Cloud. Sie werden daher als Branch-Löschkandidaten eingestuft, sofern kein bewusster historischer Git-Snapshot mehr gewünscht ist.

## Noch NICHT löschen

### `v540-progress-hub`

PR #162 wurde gemergt. Danach wurden jedoch über die GitHub-Weboberfläche zwei weitere Commits auf diesem alten Branch erzeugt:

1. `Delete assets/icons/progress-v540-192.png`
2. `Add files via upload`

Der Branch unterscheidet sich heute nur noch bei `assets/icons/progress-v540-192.png` von `main`.

Wichtig: Das nachträglich hochgeladene Branch-Icon hat einen anderen Blob-SHA als das aktuelle Main-Icon:

- Branch V540: `668ba70b94f2d7cb7b5afd4f12c0ac47ebdd15de`
- `main`: `ba29b2346c8eecded1f488614b27484aa0da0263`

Da der manuelle Austausch nach Aussage des Nutzers beabsichtigt war, darf `v540-progress-hub` erst gelöscht werden, wenn entschieden bzw. geprüft ist, welche Icon-Datei der gewünschte Produktionsstand ist.

## Dateien auf `main`

### Sicher entfernbar – 1024px-Launcher-Originale

Die folgenden alten 1024px-Launcherbilder werden vom aktuellen Default-Branch nicht mehr referenziert; die PWA verwendet die optimierten 192px-Varianten:

- `assets/icons/backstage-v520-1024.PNG`
- `assets/icons/food-v519-1024.png`
- `assets/icons/future-v519-1024.png`
- `assets/icons/kistology-v520-1024.PNG`
- `assets/icons/sport-v519-1024.png`
- `assets/icons/todo-v519-1024.png`

Gesamtgröße: rund 9,47 MB. Diese Dateien werden im aktuellen Cleanup-Branch entfernt.

### Noch behalten

`assets/icons/future-v524-192.png` ist funktional überholt, wird aber in `index.html` derzeit noch vorab geladen. Daher in diesem Cleanup noch nicht löschen. Erst den veralteten Preload sauber auf PROGRESS umstellen und testen.

## GitHub Actions / Workflows

Es existieren neben den zentralen Workflows (`build-consistency.yml`, `regression.yml`, `runtime-smoke.yml`, `update-development-metrics.yml`) noch zahlreiche versionsspezifische Workflows.

Einige davon laufen weiterhin auf jedem PR/Push und schützen weiterhin aktive Altmodule. Beispiel: `v488-typography-hotfix.yml` prüft heute noch aktiv genutzte V488/V494-Komponenten.

Daher werden versionsspezifische Workflows nicht blind gelöscht. Sie sollen in einem separaten CI-Konsolidierungsschritt darauf geprüft werden, welche Checks bereits vollständig von den zentralen Workflows abgedeckt werden.

## Zielzustand

Künftig gilt der Workflow aus `docs/PROJEKTREGELN.md`:

`aktuelles main → neuer Branch → Commits → PR → Tests → Merge → Deployment → echter PWA-Test → LIVE/PASS → Branch löschen`

Fehler nach Merge werden auf einem neuen Hotfix-Branch vom aktuellen `main` korrigiert; alte gemergte Branches werden nicht wieder als normale Arbeitszweige benutzt.
