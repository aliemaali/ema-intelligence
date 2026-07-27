# EMA Project Platform – gebündelter Release

## Ziel
Ein Projekt wird nur einmal gepflegt. Alle Berechnungen, Formulare und Dokumente verwenden dieselben zentralen Projektdaten.

## Umfang dieses Releases

- Investment Memorandum und Exposé lesen ausschließlich zentrale Projektdaten.
- Erzeugte Dokumente speichern die verwendete `master_data_version`.
- Nach Projektänderungen werden ältere Ausgaben als veraltet erkannt.
- Kundenaufnahme, Projektaufnahmebogen und Akquisebogen werden als Projektausgaben behandelt.
- CAPEX-Ergebnisse werden mit dem Projekt und dessen Ausgabemetadaten verknüpft.
- Herkunft importierter, manuell gepflegter und berechneter Werte bleibt nachvollziehbar.
- Bestehende Projekte, Dokumente und Kalkulationen werden nicht gelöscht.

## Release-Regel

Keine weiteren Teil-Releases. Alle Änderungen bleiben auf diesem Release-Branch, bis folgende Prüfungen vollständig erfolgreich sind:

1. TypeScript
2. Produktions-Build
3. Vercel-Preview
4. Prüfung von Projekt, CAPEX, Kundenaufnahme und Dokumentausgaben
5. Datenbank- und RLS-Prüfung

Erst danach erfolgt ein gemeinsamer Merge nach `main` und damit der Livegang.
