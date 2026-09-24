# FOOD – Einkauf, Vorrat, Haltbarkeit und Essensplanung

**Konzeptstand:** 18.09.2026  
**Status:** V543 STARTBEREICH IMPLEMENTIERT – Ausbau läuft

## Ziel

FOOD soll Einkauf, vorhandene Lebensmittel, Haltbarkeit, Verbrauch und Essensplanung zu einem gemeinsamen Kreislauf verbinden.

Langfristige Leitfrage des Systems:

- Was ist zu Hause?
- Wie viel ist davon noch da?
- Was ist geöffnet?
- Was läuft bald ab?
- Was sollte zuerst verbraucht werden?
- Was wird für geplante Mahlzeiten benötigt?
- Was fehlt und muss eingekauft werden?
- Welche Mahlzeiten passen zugleich zum vorhandenen Bestand und zum Abnehmziel?

Das Abnehmziel hat bei Ernährungsvorschlägen Priorität. Persönliche Vorlieben sollen berücksichtigt werden, soweit sie damit vereinbar sind.

## Funktionsbereiche

### 1. Einkaufsliste

- Lebensmittel und Haushaltsartikel erfassen.
- Benötigte Mengen hinterlegen.
- Artikel während des Einkaufs als gekauft markieren.
- Gekaufte Lebensmittel anschließend möglichst einfach in den Bestand übernehmen.
- Haushaltsartikel müssen nicht zwingend Teil des Lebensmittelbestands werden.

### 2. Vorräte zu Hause

Pro Lebensmittel sollen mindestens erfasst werden können:

- Bezeichnung
- Menge
- Einheit bzw. Packungsgröße
- Lagerort, z. B. Kühlschrank, Gefrierschrank oder Vorratsschrank
- geöffnet / ungeöffnet
- optional Öffnungsdatum
- optional Mindesthaltbarkeits- oder Verbrauchsdatum

### 3. Mindesthaltbarkeit und Verbrauchspriorität

FOOD soll Lebensmittel priorisieren können, die zuerst verwendet werden sollten.

Beispiele für Hinweise:

- „Das ist noch offen.“
- „Das sollte noch gut sein.“
- „Das muss zuerst weg.“
- „Läuft bald ab.“

Die Hinweise sollen aus gespeicherten Daten abgeleitet werden und keine ungesicherten Aussagen über Lebensmittelsicherheit ersetzen.

### 4. Verbrauch dokumentieren

- Festhalten, wann ein Lebensmittel verwendet wurde.
- Verwendete Menge erfassen.
- Restbestand daraus aktualisieren.
- Leere Bestände erkennen.
- Optional automatisch oder mit einfacher Bestätigung erneut zur Einkaufsliste hinzufügen.

Ziel ist möglichst wenig Eingabeaufwand. Eine vollautomatische Bestandsführung ohne bestätigte Verbrauchsdaten ist zunächst nicht vorgesehen, weil sie sonst schnell falsche Bestände erzeugt.

### 5. Essensplanung

- Mahlzeiten anhand vorhandener Lebensmittel planen.
- Bereits geöffnete oder bald ablaufende Lebensmittel bevorzugen.
- Fehlende Zutaten erkennen.
- Mengen für Frühstück, Snacks, Mittag- und Abendessen festlegen.
- Ernährung auf Gewichtsabnahme ausrichten.
- Persönliche Vorlieben berücksichtigen, solange das Abnehmziel Priorität behält.
- Ab Samstag, 26.09.2026, Tagesplanung auf **1.500 bis maximal 1.800 kcal** ausrichten.
- Mittag- und Abendessen künftig bewusst kleiner portionieren; beide sollen nicht mehr den Großteil des Tagesbudgets auffressen.
- Bereits geplante Mahlzeiten für Donnerstag, 24.09.2026, und Freitag, 25.09.2026, bleiben unverändert.

### 6. Verknüpfung Einkauf ↔ Bestand ↔ Essensplan

Zielbild:

`Einkaufsliste → Einkauf → Bestand → Essensplanung → Verbrauch → Restbestand → neue Einkaufsliste`

Die Bereiche sollen nicht als isolierte Listen gebaut werden, sondern dieselben Lebensmittel-/Bestandsdaten verwenden.

## Stufenweiser Aufbau

### Phase 1 – gestartet mit V543

1. Heutige Mahlzeiten mit bestätigten, vorbereiteten und geplanten Zuständen anzeigen.
2. Gekaufte Lebensmittel und belastbare Restmengen erfassen.
3. Prognosen nach geplanten Mahlzeiten getrennt vom bestätigten Bestand anzeigen.
4. Tatsächlichen Verbrauch nach und nach bestätigen und erfassen.

### Phase 2 – Basis-FOOD in der App

- Einkaufsliste
- Bestandsliste
- Mengen und Lagerorte
- geöffnet / ungeöffnet
- MHD / Verbrauchsdatum
- einfache Übernahme von Einkauf in Bestand

### Phase 3 – Verbrauch und Priorisierung

- Verbrauchsbuchungen
- automatische Restmengenberechnung
- „bald verbrauchen“-Priorisierung
- Vorschlag zum Wiederauffüllen der Einkaufsliste

### Phase 4 – Essensplanung

- Mahlzeiten aus Bestand vorschlagen
- offene / bald ablaufende Lebensmittel bevorzugen
- fehlende Zutaten automatisch als Einkaufsbedarf erkennen
- Kalorien- und Abnehmziel berücksichtigen

### Phase 5 – spätere Automatisierung

Mögliche spätere Erweiterungen, noch nicht beschlossen:

- Barcode-Scanning
- wiederkehrende Standardartikel
- Mindestbestände
- automatische Einkaufsvorschläge
- Rezept-/Mahlzeitenhistorie
- intelligente Verbrauchsschätzung
- stärkere Verknüpfung mit PROGRESS / Health / Ernährungsdaten

## Datenhaltung und Skalierung

FOOD ist langfristig kein geeigneter Anwendungsfall für reine Chat-Datenhaltung oder ausschließlich `localStorage`.

Sobald die eigentliche FOOD-Funktion gebaut wird, soll der dauerhafte Bestand strukturiert gespeichert werden, vorzugsweise im bestehenden Supabase-Hauptprojekt. Dafür sollten getrennte, normalisierte Datenobjekte verwendet werden, z. B.:

- Produkte / Lebensmittel
- Bestandschargen bzw. Packungen
- Lagerorte
- Einkaufsliste
- Einkaufspositionen
- Verbrauchsbuchungen
- Mahlzeiten / Essensplanung

Besonders Mindesthaltbarkeit, Öffnungsdatum und Restmenge sollten möglichst auf Packungs-/Chargenebene gespeichert werden. Mehrere Packungen desselben Produkts können unterschiedliche Daten und Zustände haben.

## Wichtige Konzeptregel

Die App darf einen Bestand nicht als sicher vorhanden oder verbraucht behandeln, nur weil er theoretisch aus einem Essensplan resultieren müsste.

**Physisch bestätigter Einkauf und bestätigter Verbrauch schlagen Planung.**

Damit bleibt der Bestand auch langfristig belastbar.
