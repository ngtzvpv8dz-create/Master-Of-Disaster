# Master of Disaster V1 · Punkt 4 · Zutatenprüfung und Sortimentserweiterung
**Stand:** 22.11.2026 · **Status:** verbindliche Codex-Arbeitsanweisung, noch keine inhaltliche Freigabe einzelner Änderungen.

## Zweck und strikte Grenzen
Die laufende V1-Food-Denkfabrik wird vor dem nächsten **festen vollständigen Monatsplan** um eine nachvollziehbare Prüfung aller Zutatenbewertungen und anschließend neue Zutatenvorschläge ergänzt. Diese Anweisung konsolidiert #499, #501/#502 (historische Vorgänger), #343, #449, #508, #133/#515 und die heute bestätigten Vorgaben. **Nicht** den Monatsplan eigenmächtig umstellen.

**Nur V1:** bestehendes Supabase-Projekt `oktpzwhhndsbikkeelot`. **V2 `ukuxyeeecbpaksbvivay` unter keinen Umständen lesen oder ändern.** Bestehende App-Module und Produkt-/Familienmodell als Quelle nutzen. Kein Ersatz durch Chatverlauf, Screenshot-Abschriften oder temporäre flache Listen.

**Nicht eigenmächtig:** persönliche Zutatenbewertungen, Rezeptdaten, Plan-/Verzehrdaten, Vorratsbestände, Einkäufe, Käufe, Chargen, vorhandene Familienbeziehungen oder den festen Monatsplan ändern. Es wird erst protokolliert, dann der Nutzer gefragt, dann eine **explizit freigegebene** konkrete Änderung ausgeführt. Keine Annahme, dass ähnliche Zutaten beliebig austauschbar oder mischbar sind.

## Live-Bestandsaudit am 22.11.2026
Verifiziert direkt in V1:
- `public.food_ingredient_preferences`: **627 Datensätze, alle 627 aktuell, 627 eindeutige Namen**, keine inaktiven Altbewertungen.
- Tatsächliche Werte von `preference` (exakt beibehalten):
  - `Ab und zu`: 229
  - `Gern`: 116
  - `Nur wenn es passt`: 108
  - `Würde ich probieren`: 95
  - `Nie`: 50
  - `Sehr gern`: 21
  - `Mag ich nicht`: 8
- `food_ingredient_families`: 310 Familien.
- `food_ingredient_family_terms`: 588 Begriffe.
- `food_ingredient_preference_aliases`: 19 Aliase.
- Nur **10 aktive Zutatennotizen** enthalten grob einen textuellen Frequenzbegriff; es existiert im geprüften Präferenzschema **keine eigene Frequenzspalte**.
- Zusätzlich: **340 aktive konkrete Shopping-Produkte** (Stand der Prüfung), eigene Rezept-/Mahlzeitenzutaten und reale Lagerbestände. Den tatsächlichen Bestand vor Bearbeitung neu abfragen, nie Zahlen der Momentaufnahme als dauerhaft festschreiben.

## Phase 0: Sichere Datenzugriffe und Review-Workflow
1. Aktuelle Tabellen, RLS, Indizes und relevante Food-/Shopping-Flows im Projekt überprüfen. Für jeden Arbeitsschritt wirklichen Code und Datenmodell lesen. Bereits laufende App-Funktionen nicht doppelt implementieren.
2. Vor Änderungen verifizierbaren Daten-Snapshot/Export mit IDs, Zeitstempeln, aktueller Auswahl, Notizen, Kategorien, Aliasen und Familien-Verknüpfungen erzeugen und mit Versionsreferenz dauerhaft dokumentieren. **Keine persönlichen DB-Daten in das öffentliche GitHub-Repo committen.** Prüfdaten in benutzergebundenen V1-Datenbanktabellen mit RLS oder einem explizit privaten User-Export halten.
3. Ein dauerhaft gespeichertes Review-Protokoll mit `preference_id`, Quellzustand und Stand (`unreviewed`, `confirmed_unchanged`, `proposed_change`, `approved`, `applied`) bereitstellen. 627+ Einträge müssen nach Unterbrechung verlustfrei weiter bearbeitbar sein. Für neue Lebensmittel eigenständige Vorschlagsdatensätze statt direkt `food_ingredient_preferences` verändern.
4. Review in **überschaubaren Gruppen (z. B. 20–30 pro Ansicht)**, mit Kategorie-Filter, Fortschritt, Differenzvorschau und eindeutiger Bestätigung. Kein 627-Zeilen-Monster im Chat, keine heimliche Massenbestätigung. Performance/Interaktion mit >600 Einträgen nachweisen.
5. **Codex ist Ausführungshelfer, nicht Entscheider über Geschmack**: bestehende `preference`-Werte dürfen nicht allein aus Einkäufen, Rezepten oder einer Vermutung umgeschrieben werden.

## Phase 1: Alle vorhandenen 627 Bewertungen und Verknüpfungen abgleichen
- `food_ingredient_preferences` vollständig und paginiert laden. Alle 627 per stabiler `id` referenzieren, nicht nur nach Namen. Vollständigkeitsprüfung nach dem letzten Paket.
- Mit `food_ingredient_preference_aliases`, `food_ingredient_families`, `food_ingredient_family_terms`, `food_inventory`, `shopping_products`, `food_recipe_ingredients`, `food_meal_ingredients` auf unklare Schreibweisen, Varianten, Quellen und echte Zuordnungslücken prüfen.
- Echte Widersprüche und Dubletten als **Vorschläge** markieren; nicht automatisch zusammenführen. Frisch/TK, roh/gegart, verschiedene Reisarten, Milchprodukte und ähnliche Zutaten können unterschiedliche Verwendung und Nährwerte haben. Fachregel #133/#515 gilt.
- Tatsächliches Verzehrfeedback (#449/#508) bevorzugen, aber nicht bereits geänderte Beurteilungen eigenmächtig zurücksetzen. `Nie` und `Mag ich nicht` dürfen nicht still in Rezepte gelangen.
- Nutzer kann jede bestehende Bewertung bestätigen oder ausdrücklich ändern. Eine bestätigte unveränderte Bewertung ist ein abgeschlossenes Review-Ergebnis, kein neuer Geschmacksstatus.

## Phase 2: Gewünschte Einplanhäufigkeit (#343) als eigene Dimension
- **Geschmack/Status ist NICHT identisch mit Planungsfrequenz.** Insbesondere `Ab und zu` als bestehende Präferenz nicht automatisch in einen neuen Frequenzwert umschreiben.
- Als **separate optionale** Angabe nach Nutzerfreigabe erfassen (z. B. `oft`, `gelegentlich`, `selten`, optional `keine Angabe`). Fachliche Definition vor Implementierung mit Nutzer festlegen. Nie/Mag ich nicht bleiben durch Geschmacks-Sperre unzulässig.
- Ohne explizite Nutzerentscheidung zur Häufigkeit bleibt Feld ungesetzt; **keine Standardannahmen für 627 Datensätze**.
- Rezension/Planung sollen nachvollziehbar sein: häufig bedeutet Präferenz/Bias, nicht starre wöchentliche Pflicht oder monotone Rezeptwiederholung. Mahlzeitenplanung bleibt abwechslungsreich, vollständiger fester Monatsplan, nach Freigabe keine automatische Umplanung.

## Phase 3: Zusätzliche alltägliche, internationale und ungewöhnliche Lebensmittel sowie optionale Genuss-Snacks
- Erst nach Bestandsabgleich zielgerichtete **neue bewertbare Vorschläge** erzeugen, insbesondere Gemüse, Hülsenfrüchte, Obst, unterschiedliche Proteine, Würzmittel/Internationales und Chips, Schokolade, Süßigkeiten, salzige Snacks, Eis etc.
- Doppelte Präferenznamen/Aliase, bereits bestehende Familien oder bekannte konkrete Varianten ausschließen bzw. als Verweis darstellen, statt sie erneut anzulegen.
- **Einkaufsquelle ausschließlich REWE, Lidl oder EDEKA** für Food-Zutaten und geplante Einkäufe. Verifizierbaren Händler-/Produktbeleg und Quellenstand dokumentieren; keine erfundene regionale Filialverfügbarkeit, EAN, Packungsgröße, Preis oder Nährwerte. Bei fehlendem Beleg als unbestätigte Idee kennzeichnen; keine falsche Gewissheit.
- Jeder Vorschlag: Name, fachliche Gruppe/Variante, plausibler Verwendungszweck, Nachweis und Status „noch nicht bewertet“. Erst nach ausdrücklichem Nutzerurteil als Präferenz übernehmen. `Würde ich probieren` ist freiwillig, keine automatische Kaufpflicht oder erzwungenes Testgericht.
- Die bestehende optionale Naschvorschlagsfunktion #514 und Extra-Verzehr #392 bleiben getrennt: Vorschlag != Kauf != Vorrat != gegessen. Wochenende maximal ca. 2.200 kcal pro Tag inklusive optionalem Genuss, werktags ca. 100 kcal freiwilliger Puffer innerhalb 1.500–1.800.

## Phase 4: Nachvollziehbare Einplanung und technische Tests
- Erst nach bestätigtem Review dürfen neue Präferenzen und Häufigkeiten die **nächste** feste Monatsplanung beeinflussen; die konkrete Rezeptauswahl stimmt der Nutzer **für den vollständigen Monat im Voraus** ab. Keine 3–4-Tage-Rollplanung und keine ungefragte Umplanung.
- Bestandsverbrauch anhand echter Vorräte, Chargen, MHD/Verbrauchsdatum, Einkaufsfenster, Packungen und rechtzeitigem Verderb planen. Bereits gekaufte/geöffnete Produkte zuerst sinnvoll nutzen, keine erfundenen Vorratsmengen.
- Alte Mahlzeiten, Recipe-Ratings, Buchungen und Produkt-Nährwertquellen bleiben unangetastet.
- Automatische Tests: 627/627 verlässlich erfasst; bei 600+ Einträgen nichts abgeschnitten; Weiterarbeit nach Unterbrechung; idempotente Aktionen; RLS-Benutzertrennung; unveränderte Urteile als unverändert; kein Cross-Link zwischen Varianten; keine unbestätigten Shopping-/Rezept-/Vorratsmutationen. Browser-Test in Chromium und WebKit (iPhone-Viewport) ist akzeptierter Standard; persönliche Login-Sitzung nicht fingieren.
- Aufträge und beschlossene Änderungen nur in **V1** protokollieren. V2 ausdrücklich nicht anfassen.

## Übergabe / Abschlusskriterien
Codex soll zuerst **nur eine kurze Bestandsanalyse und einen Vorschlag zur sicheren Review-UI/Datenhaltung** vorlegen. Danach Review-Oberfläche und belastbare Tests erstellen, ohne individuelle Zutatenpräferenzen automatisch zu ändern. Review-Status, unbearbeitete Anzahl, fachliche Konflikte und zukünftige Vorschläge mit eindeutigen Datensatz-IDs nachhalten. Der Nutzer entscheidet gruppenweise; erst danach Monatsplan erstellen.


## Verbindliche Excel-Übergabe (Nutzerentscheidung 22.11.2026)
Der Nutzer hat eine lokale Excel-Datei **Zutatenreview_V1_1000_627plus373_20261122.xlsx** erhalten. Sie muss für die Ausführung separat vom Nutzer an Codex gegeben werden; **NICHT** mit personenbezogenen Geschmacksurteilen ins öffentliche GitHub-Repo committen.

Die Datei wurde aus einer Live-Supabase-V1-Abfrage vorbereitet. Im Arbeitsblatt **1000 Zutaten**:
- Tabellenüberschrift in Zeile 5, Nutzdaten Zeile 6 bis 1005.
- **627 existierende Einträge in Zeilen 6–632**, mit Kategorie, exaktem Originalnamen, originaler Bewertung und einem **12-stelligen eindeutigen UUID-Präfix**. Stimmt mit den sieben Präferenzzählungen aus dem Live-Audit überein. V1-Originalnoten verbleiben im Datenbankbestand, beim Abgleich je Zutat hinzuziehen.
- **373 leere neue Rechercheplätze in Zeilen 633–1005**: Codex soll **genau 373** vielfältige, zuvor nicht im Zutatenstamm vorhandene Kandidaten mit REWE-/Lidl-/EDEKA-Beleg hinzufügen. **Vor der Recherche gibt es nicht bereits 1000 vollständig benannte Zutaten.**
- Spalten A Nummer, B Typ (V1/NEU), C Referenzpräfix, D Kategorie, E Zutatenname, F unveränderter alter Geschmacksstatus, G Nutzerbewertung, H Nutzerhäufigkeit, I Freigabe, J Händler, K Produktbeleg-URL, L Nutzerkommentar, M abgeleiteter Prüfstatus.
- **G, H, I nur durch den Nutzer freigeben lassen.** Bereits bekannte 627 Werte sind in G zunächst identisch mit F; neue in G „Noch offen“. I beginnt immer „Offen“, nie automatisch als bestätigt. Unbestätigte Änderungen und importierte Kandidaten bleiben ausschließlich Arbeitsvorschläge.
- Tastatursteuerung für Microsoft Excel Desktop über separat gelieferte Makro-Datei **MOD_Zutaten_Leertaste.bas**: Pfeile wechseln Zellen, Leertaste schaltet G/H/I vorwärts, Umschalt+Leertaste zurück. Ohne Makro Excel-Auswahl Alt+Pfeil runter/Pfeile/Enter. Normale XLSX-Datei enthält kein ausführbares Makro. Codex soll die Datei für den Nutzer nach der Recherche unverändert kompatibel behalten.
- Geschmacksoptionen G: Noch offen, Würde ich probieren, Nur wenn es passt, Ab und zu, Gern, Sehr gern, Mag ich nicht, Nie. Bestehende V1-Klassen bleiben exakt erhalten.
- Frequenzen H: Noch offen, Täglich, Alle 2–3 Tage, 1× pro Woche, Alle 2 Wochen, 1× pro Monat, Seltener, Nur bei passenden Rezepten, Nicht einplanen. Frequenz ist **nicht** gleich Geschmacksstatus und darf bei 627 bestehenden Einträgen nicht automatisch abgeleitet werden.
- Beim späteren Import von bestätigten Excel-Änderungen: 12-stelligen Präfix UND unveränderten Originalnamen gegen vollständige UUID in aktueller V1-DB auf Eindeutigkeit und aktuelle Version prüfen. Keine Schreibaktion allein aufgrund eines Präfixes.
- Recherche abgleichen mit *allen* bisherigen 627 Namen, 19 Aliasen, 310 Familien, 588 Familienbegriffen und bereits aktiven Shopping-Produkten. Neue Kandidaten dürfen keine Varianten-/Namensdubletten sein. Reale Händlerbelege aus REWE/Lidl/EDEKA in J/K und überprüfte Quellen eintragen; keine erfundenen EAN, Nährwert- oder Filialverfügbarkeitsangaben.
- Freigabe „Bestätigt“ pro Zeile ist Bedingung für **jede** spätere Präferenzänderung. Zusätzliche Änderungen an Rohbestand, Produktstammdaten, Rezepten, Kaufbelegen oder Monatsplan sind durch diese Tabelle **nicht** autorisiert.

**Akzeptanztests:** exakte 627 + 373 = 1000 Positionen; 627 alte Präferenzen unverändert erhalten; alle 373 neuen Kandidaten tatsächlich recherchiert, quellenbelegt, keine Dubletten; alle 1000 IDs/Zeilen nach Speichern und Wiederöffnen konsistent; Filter und Tastaturauswahl auf 1000 Zeilen skalierbar. Eintrag „NEU“ in Zeile 633 ist **keine** gekaufte Ware.
