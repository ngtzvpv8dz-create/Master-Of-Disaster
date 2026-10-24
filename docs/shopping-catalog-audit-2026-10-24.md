# Einkaufsliste: Sortiment, Dubletten und Mengeneinheiten
Stand 24.10.2026, User-Audit des vollständigen Einkaufszyklus 24.10.–25.11.2026

## Fachliche Regel
Einkaufsartikel: EIN Kaufprodukt je Einkaufstermin; Rezeptbedarfe darunter separat pro Datum.
Nicht mehrere „Kaufen“-Positionen für Bedarf und Verkaufspackung desselben Produkts anzeigen.
Bei Fehlmenge zuerst echten aktiven Bestand in vergleichbaren Einheiten abziehen, danach nur geplante, noch nicht als gekauft gebuchte Packungen deckungsgleich zuordnen.
Wegen Mindestgröße ganze Ware/Dosen/Packungen nach realen Daten planen. Ungeklärte Roh-/Abtropf-/Stückgewichte deutlich markieren, NICHT schätzen.
Gekaufte Ware erst nach erfolgreichem Wareneingangs-/Bonabschluss als Bestand buchen.
Keine pauschale Gleichsetzung von frischer/TK-Ware, Reisarten oder normalen/Light-Produkten.

## Implementierung V862
- shopping-v678.js: normierte Einkaufsnamen (Rezeptattribute wie „warm“, „roh“, „essbar“, „abgetropft“ sind kein Verkaufsprodukt), Familienabgleich, Überdeckung zwischen food.gaps und shopping_items, Kaufgesamtsumme im Checkout, Einheitwarnungen, mehrzeilige Bedarfsliste.
- food-v544.js: Karotten warm/Rohkost für Einkauf zu Karotten zusammenführen, aber Rezeptnamen/Gramm unverändert. Individueller Einkauf 07.11. auf Freitag 06.11. vorverlegt. Stück-/Gramm-Modell für bereits hinterlegtes Obst berücksichtigt.
- Einkauf 4 Äpfel („Äpfel für Snacks“) von 30.10. auf 11.11. verschoben; vorhandene sechs Pink Lady zuerst.
- Pfeffer schwarz als ganze Körner für vorhandene Pfeffermühle und Einkaufsdatum 28.10. statt 30.10.
- Automatisierte Testfälle zu Datum, Verkaufs-/Rezeptmengen, mehrfacher Benennung und Einheiten hinzugefügt.
- Deployment und reales iPhone-Ende-zu-Ende-Verhalten nach CI separat prüfen; keine Aussage, dass alle Live-Flows schon erfolgreich durchlaufen wurden.

## Verbindliche Sortimentskonventionen
- Gurke/Salatgurke = Salatgurke; Blattsalat roh/frisch = Blattsalat frisch; Karotten warm/Rohkost = Karotten frisch.
- Hähnchenbrust/Brustfilet = Hähnchenbrustfilet, Roh-/TK- und MHD-Status weiterhin getrennt.
- Mageres Rinderhack 5%: tatsächliches Packungsetikett wichtiger als „70 % weniger Fett“ (kein automatisches Nährwertgleichsetzen).
- Naturjoghurt = mild/fettarm 1,5%; griechischer Joghurt = 2% Fett, ausdrücklich NICHT alte 9,4%-Variante.
- Kiwi (essbar) = frische Kiwi, „essbar“ betrifft nur Nährwertgramm ohne Schale; Stückgewicht klären.
- Pide-Fladen/Pidefladenbrot = Pide-Fladenbrot; Pita/Pita-Taschen = Pita-Taschen, NICHT Pide.
- Reis-fit Naturreis im Rezept = Naturreis trocken unabhängig vom Hersteller (kein Kochbeutel gewünscht). Unspezifisches „Reis“ muss konkrete Sorte benennen; bei Kaufvorschlag Langkornreis trocken. Naturreis NICHT als identisch mit Basmatireis/Langkornreis/Risottoreis behandeln.
- Passata/passierte Tomaten = Passierte Tomaten; Tomaten roh/warm = frische Tomaten. Große Rispen/Fleischtomaten versus Cherry-/Dattel-Cherry nach Rezeptfunktion wählen und Varianten offen kennzeichnen.
- Pfeffer schwarz für Pfeffermühle als ganze Körner (nicht gemahlene Ersatzware). Bei sonstigem Senf gern scharf.
- Mozzarella immer Light; Schnittkäse frisch/Schnittkäse = Schnittkäse, kein Hinweis auf Verderb. Oregano gerebelt statt „gerieben“.
- Mais, Kichererbsen „abgetropft“: Konserve mit entsprechendem Abtropfgewicht, nicht als schon abgetropfte Ware suchen.
- Ananas in eigenem Saft: Dose; Nussmischung natur, ungesüßt/ungesalzen, konkrete Zusammensetzung noch nicht festgelegt.
- TK grüne Bohnen/Erbsen/Edamame ohne Schote und echte frische Bohnen nicht pauschal ersetzen.
- Sojasauce: Flaschenkauf und ml-Rezeptbedarf EINE Position; genaue Flaschengröße vor Buchung feststellen.
- Pide/Lasagneplatten/Kokosraspeln/Ricotta/TK-Kirschen/Brokkoli/Zitrone/Limette/Radieschen/Schnittlauch: Nachfrage nach benötigten Gramm und Verkaufspackungsgröße in derselben Produktzeile.

## Bestandsprüfung direkt aus Supabase
- Tomaten am 24.10.: 585 g = 506 g Dattelcherrytomaten Celia + 79 g Rispentomaten, weitere Sorten 0 g. Frische/MHD/geeignete Verwendung vor Verzehr kontrollieren.
- CHIO Dip Mild Salsa 230 ml vorhanden, Hot Salsa 0 ml. Tomatensalsa im Rezept in g ist NICHT ohne Prüfung automatisch das gleiche Produkt; Geschmack, Zucker, Konsistenz und g/ml prüfen.
- 6 Pink Lady Stück im Vorrat; Stückgewichte vorläufiger Schätzwert, nicht jedes echte Stück gewogen.
- 678 g Hähnchenbrustfilet im Bestand bei letzter Prüfung (Einkäufe am 24.10. noch nicht automatisch angenommen).
- Mandarine 1 Stück mit vorläufigem essbarem Gewichtsstandard 76 g; Avocado Hass 5 Stück mit geschätztem essbarem Fruchtgewicht; tatsächliche Frische und Portion wiegen.

## Noch nicht vollautomatisch lösbare Sachfragen
1. Welche Tomatensorte für welche offenen Rezepte? Nicht eigenmächtig riesige Fleischtomaten statt Cherry verplanen.
2. Ist die CHIO Salsa Mild für die Taco-Bowl geschmacklich/nährwerttechnisch gewollt? Kein automatischer Ersatz ohne Bestätigung.
3. Wie viel essbares Fruchtfleisch liefert die konkret gekaufte Kiwi/Avocado/Mandarine? Gewichte ggf. einzeln prüfen, „Einheit prüfen“ statt fiktiver Bestände.
4. Packungsgewicht/Abtropfgewicht von Mais, Kichererbsen, Sojasauce, Lasagneplatten/Pide und Gewürzglas bei Kauf erfassen.
5. 70%-weniger-Fett-Rinderhack anhand Fettgehalt pro 100 g mit 5%-Ziel abgleichen; Nährwerte für abweichendes Produkt neu rechnen.
6. Die genaue Nussmischung (ungesüßt, ungesalzen) und eventuelle persönliche Einschränkungen konkret festlegen.
7. Tatsächliche Wareneingänge, Restbestände, Haltbarkeit und Rückbuchungen vor weiteren Käufen abgleichen.
