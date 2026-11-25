# FOOD v1 – Abschlussprüfung und eingefrorener Restumfang
Stand: 25.11.2026, 13:03 Europe/Berlin. Prüfzweig, keine Produktivfreigabe.
Referenz des getesteten Codes: 06a1b02cae5473912d23e9a249bab0716341903f.

## Gemeinsamer Datenbanktest
Die sechs SQL-Entwürfe wurden erstmals zusammen in einer einzigen zurückgerollten Subtransaktion der v1-Datenbank installiert. Die ältere dreiparametrige Planungsvorschau wurde nicht zusätzlich installiert. Alle Quellhash-Sicherungen waren erfolgreich.

Test unter der authentifizierten Benutzerrolle:
- Synthetischer Einkauf: 3 Avocados, 153 + 147 + 160 g. Bestand +3.
- Vorschlag für 2 frische Stücke: 300 g; die alten Chargen bleiben unberücksichtigt.
- Übernahme: keine Bestandsbuchung.
- Mahlzeit abschließen: exakt die zwei ausgewählten Stücke verbraucht, ursprüngliche Rezeptbasis 300 g erhalten; zwei chargengenaue Nachweise mit 153 und 147 g und Nährwertprofil 160 kcal/100 g (480 kcal konservative Bruttoschätzung).
- Das verbleibende neue Stück als verdorben entnehmen: ursprüngliche Bestandszahl wieder erreicht.
- Vollständiger Rollback: sämtliche Inventar-, Chargen-, Stück-, Mahlzeiten- und Zutatenzeilen verglichen; Anzahl Bewegungen, Verbrauchsnachweise und Einkaufsdatensätze unverändert; neue RPC nach Rollback nicht vorhanden.
- Kein tatsächlicher Einkauf, Verzehr oder Verderb gebucht. Nicht als Browser-End-to-End-Test oder Produktivfreigabe interpretieren.

## Feststehende neun Arbeitspakete
| Paket | Nachweis und verbleibender Abschluss |
| --- | --- |
| 1 Einkaufserfassung | Entwicklungsumfang Apfel/Avocado vollständig: Einzel- und Mehrchargen-Bonmaske, manuelle gewogene Charge, Schutz des alten Mengenwegs. Gemeinsame Datenbanktests für Mehrchargenkauf und manuelle Erfassung erfolgreich, Rollback verifiziert. Gesamtabnahme und Übertragung auf weitere Sorten in Paketen 2/8/9. |
| 2 Weitere Obst-/Gemüsesorten | Bruttoregel und Katalog vorhanden; Stückablauf nur Apfel/Avocado integriert. Bestehende Paprika- und sonstige Stücklogik nicht pauschal ersetzen. |
| 3 Zusatzsnacks/Rückbuchung | Alte mehrdeutige Wege geschützt, gewöhnlicher Zusatzsnack getestet; genaue Stückbuchung und Rückbuchung für Früchte fehlen. |
| 4 Automatische Speiseplanung | Stückvorschlag, Frische, Reservierung, Kalorienvorschau und explizite Übernahme vorhanden; gesamte automatische Speiseplanung noch nicht abgeschlossen. |
| 5 Automatische Einkaufsplanung | Bestehender Einkaufsplaner und Regressionstests vorhanden; durchgängige Nutzung der neuen Stückzuordnung im Einkaufsbedarf nicht nachgewiesen. |
| 6 Zutatenverwaltung | Konsolidierter Katalog und Verbrauchsregeln vorhanden; vollständige Bearbeitungsoberfläche noch nicht abgeschlossen. |
| 7 Datenqualität | Keine ungesicherten Zuordnungen erfinden. Historische Apfelstückabweichung und fehlende Produktnährwerte offen. |
| 8 Gesamttest | Datenbankkette für einen Apfel-/Avocado-Workflow erfolgreich; Browser-zu-Datenbank-Test, tatsächliche Funktionsintegration der verbleibenden Pakete, Schutz direkter alter Schreibwege und Release-Prüfung fehlen. |
| 9 Veröffentlichung | Nicht freigegeben, keine Installation. Gemeinsame Migration, Versions-/Cache-Aktivierung, Sicherung und explizite Freigabe vor Veröffentlichung erforderlich. |

## Abschlussregel
Keine neuen freiwilligen Features hinzufügen. Keine bereits bestandenen isolierten Tests erneut als eigene Arbeitspakete auflisten; bestehende automatisierte Regressionstests weiter normal ausführen. Verbleibende Punkte nur bearbeiten, wenn sie zum feststehenden Umfang oder zu nachgewiesenen Freigabeblockern gehören. Keine Produktivänderungen ohne Freigabe.

## Fortschritt: Paket 2
Gemeinsamer Rollback-Test: vorhandene Mango 753 g und Limette 98 g, manuelle neue Mango-Charge 301 + 309 g, frische Stückauswahl 610 g, exakte Entnahme, identischer vorheriger Datenbestand. Die Stückpfade sind zusätzlich für Banane vorbereitet; kein aktueller Bananenvorrat zum realen Test. Birne mit Teilstück und Paprika behalten ihre vorhandene Sonderlogik. Neue Verfügbarkeitsdefinition vor den sieben Kandidaten anwenden; nicht produktiv. Keine zusätzlichen Arbeitspakete.

## Fortschritt: Paket 6
Zutateneditor im Rezeptbereich mit paginiertem Laden, Suche, individueller Bewertung/Häufigkeit und Grundzutaten-/Varianten-Verbrauchsregel. DB-RPC unter authentifizierter Rolle erfolgreich: alte und neue Katalogzeilen, Regel-Normalisierung, Ausschluss, Variantenänderung, veralteter Stand und fremde Nutzer-ID; Rollback nachgewiesen. 1.251 synthetische Zeilen im UI-Ladetest vollständig geladen. Bestehende 123 abweichende Legacy-Bewertungen werden nicht pauschal überschrieben; der konsolidierte Katalog ist maßgeblich, Synchronisierung erfolgt bei ausdrücklicher Einzeländerung. Bisherige Geschmacksmeldung aktualisiert nach der Migration auch die Katalogbewertung. Browser-Abnahme und vollständige Planungskopplung bleiben Paket 4/8.

## Fortschritt: Paket 3
Gewogener Zusatzsnack und Rückbuchung im DB-Test erfolgreich: Mango 753 g / 451,8 kcal, Wiederholung derselben Anfrage ohne Doppelbuchung, direkte Mengenänderung gesperrt, exakt dasselbe Stück in dieselbe Charge zurückgegeben; geplanter Snack bestätigt und zurückgebucht; gesamter Datenbestand nach Rollback unverändert. App-Zusatzsnacks und geplante Extras öffnen konkrete Stückauswahl; Korrektur durch Rückbuchung und Neuauswahl. Noch keine Produktivinstallation oder Browser-Abnahme dieses neuen Codes.
