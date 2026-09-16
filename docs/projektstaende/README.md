# Projektstände – Master of Disaster

Dieser Ordner enthält konsolidierte, datierte Projektstände für **Master of Disaster**.

Ziel: Wichtige Architekturentscheidungen, Datenquellen, Arbeitsregeln, offene Punkte und Integrationsstände dauerhaft im Repository sichern, damit alte Chatverläufe archiviert werden können, ohne den fachlichen Projektstand zu verlieren.

## Namensschema

`YYYY-MM-DD_HHMM_Master-of-Disaster-Projektstand.md`

Jeder neue konsolidierte Stand wird als **neue Datei** abgelegt. Alte Stände werden nicht überschrieben und bleiben als historische Referenz erhalten.

## Vorhandene Projektstände

| Zeitpunkt | Datei | Kurzbeschreibung |
|---|---|---|
| 16.09.2026, 18:34 | `2026-09-16_1834_Master-of-Disaster-Projektstand.md` | Erster zentral konsolidierter Stand nach Zusammenführung der bisherigen Projektchats; enthält PWA, Backstage, Remote Commands, Mega-Sortierung/Kistology, SPORT/Apple Health, YAZIO, PROGRESS, Alexa und offene Themen. |

## Arbeitsregel für spätere Abfragen

Wenn nach vorhandenen **Projektständen**, **Projektdaten** oder einer früheren Projektübergabe gefragt wird:

1. zuerst diesen Ordner bzw. diese Indexdatei prüfen,
2. den gewünschten oder neuesten Snapshot öffnen,
3. aktuelle GitHub-/Supabase-Daten bei Bedarf zusätzlich frisch prüfen,
4. historische Snapshot-Aussagen nicht automatisch als aktuellen LIVE-Status behandeln.

## Wichtige Abgrenzung

- GitHub `main` = maßgebliche Codequelle.
- Normale To-do-/PWA-Livedaten = grundsätzlich lokale App-Datenhaltung/localStorage.
- Mega-Sortierung/Kistology = Supabase-Hauptprojekt, Schema `mega_sortierung`.
- Ein Projekt-Snapshot dokumentiert Wissen und Entscheidungen, ersetzt aber keinen aktuellen Runtime-Test.
