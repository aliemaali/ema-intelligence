# Wiedervorlage entfernt – 14.11.2026

Auf ausdrücklichen Nutzerwunsch vollständig aus EMA Mail entfernt:

- Ja/Nein-Auswahl, Terminwahl, „Morgen erinnern“, „Erinnern, wenn keine Antwort“ und Erklärungstexte.
- Erinnerungsbutton im Nachrichtenkopf sowie Antwortbeobachtung in den Einstellungen.
- Follow-up-Daten aus Produktivitätsantwort und Client-Zustand.
- Automatische Antwortprüfung und Erinnerungserzeugung aus dem Versand-Dispatcher. Der bestehende Dispatcher verarbeitet ausschließlich ausdrücklich freigegebene Versandaufträge.

Die früheren Follow-up-API-Aktionen antworten mit HTTP 410, bevor Graph-Zugriff oder ein Schreibzugriff erfolgt. Damit können bereits geöffnete ältere App-Versionen keine neuen Wiedervorlagen anlegen. Generische Aufgaben, Projektzuordnung, Gesprächsverlauf und freigegebener Terminversand bleiben eigenständige Funktionen. Der allgemeine Aufgabendialog heißt jetzt eindeutig „Aufgabe anlegen“.

Vor dem Release geprüft: keine bestehenden Mail-Follow-ups und keine aus Nachrichten erzeugten Mail-Erinnerungen in der produktiven Datenbank. Bei der Abschlussprüfung offene Legacy-Aufträge auf cancelled setzen. Bestehende Aufgaben anderer EMA-Module und historische, serverseitig geschützte Datenbankstrukturen werden nicht gelöscht.

74 Mail-Tests und 5 PWA-Tests bestanden; die beiden bisherigen Follow-up-Tests wurden durch Regressionen ersetzt, die HTTP 410 ohne Writes sowie das Ignorieren vorhandener Legacy-Aufträge ohne Erinnerungserzeugung nachweisen. TypeScript und ESLint bestanden. Browser-Abnahme: Nachrichtenwerkzeuge und Einstellungen ohne Wiedervorlage prüfen.
