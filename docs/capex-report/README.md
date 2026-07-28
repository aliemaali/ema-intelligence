# Übergabe an die Entwicklung
## CAPEX-Report PDF-Export für EMA Intelligence

Stand: 28.07.2026 · Auftraggeber: Ali Ünlüer, EMA Enterprise GmbH

## 1. Was umgesetzt werden soll

Ein PDF-Export für den bestehenden CAPEX-Rechner. Zwei Seiten, DIN A4 Hochformat, ohne neue Berechnungslogik. Das PDF-Modul formatiert und positioniert ausschließlich; alle Werte kommen fertig aus der Kalkulations-Engine.

## 2. Umgesetzte Leitlinien

- Einheitliches EMA-Design in Navy `#1F2A44` und Grün `#5CB800`
- Zwei Seiten: Übersicht/Cashflow sowie Kalkulation/Wirtschaftlichkeit
- Keine zusätzlichen CAPEX-Kategorien
- Leere Werte und Positionen mit Wert 0 werden ausgeblendet
- Projekttypabhängige Bezeichnung, Einheit und Symbolik für PV, BESS, Windkraft und Rechenzentrum
- Deutsche Zahlenformate
- Break-even im Diagramm ausdrücklich nominal gekennzeichnet
- Bestehende Funktionen zum Erstellen, Speichern und Versenden bleiben erhalten

## 3. Wichtige Regeln

1. Keine neue Berechnungslogik im PDF-Layer.
2. Keine erfundenen Felder oder Kennzahlen.
3. Der Dateiname enthält Projektname und Erstellungsdatum.
4. Negative Werte werden normal dargestellt und nicht rot eingefärbt.
5. Nicht vorhandene Werte werden vollständig ausgeblendet.

## 4. Referenz

Die vollständige Claude-Spezifikation ist in `spezifikation.md` dokumentiert. Das in EMA integrierte Layout orientiert sich an dieser Spezifikation und wurde an die tatsächlich vorhandenen CAPEX-Daten angepasst.
