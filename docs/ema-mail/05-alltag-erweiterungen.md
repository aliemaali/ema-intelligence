# EMA Mail – Alltagserweiterungen

Auftrag: alle acht vorgeschlagenen Erweiterungen im bestehenden Entwicklungsbranch. Keine Produktivänderungen.

1. Formatierter Editor mit restriktiver HTML-Bereinigung auf Client und Server; nur Textformatierung, Links und Tabellen, keine eingebetteten Fremdbilder/Skripte.
2. Gemeinsame Größen-/Anzahlprüfung für Dateiauswahl und Drag-and-drop.
3. Antworten an alle mit Ausschluss der eigenen Adresse, ohne Übernahme von Bcc; paginierter Graph-Gesprächsverlauf in Textansicht.
4. Vorgegebene und persönliche Textvorlagen, serverseitig je Benutzer gespeichert.
5. Projektzuordnung mit vorhandener Projekt-/DMS-Berechtigung und Projektansicht für verknüpfte Mails.
6. Bestehende Erinnerungen für feste Wiedervorlagen; persistente Antwortbeobachtung ausschließlich für eigene ausgehende Mails.
7. Geplanter Versand nur nach ausdrücklicher Freigabe des gespeicherten Inhalts inkl. Termin; atomarer einmaliger Claim, keine Wiederholung bei unklarem Status, Abbrechen nur solange noch nicht beansprucht. Getrennt aktivierbarer Versand-Cron.
8. Persönliche Textsignatur je Benutzer/Postfach, unveränderte kompakte Bildsignatur für unluer@ema-enterprise.de; eingefrorener Signaturinhalt im Freigabe-Hash.

Neue Tabellen und Cron-Konfiguration werden nur vorbereitet. Sicherheits-/API-/SQL-Tests lokal; Vorschau ausschließlich mit Demo-Daten. Echte Microsoft-/DMS-/Scheduler-Abnahme bleibt in einer isolierten Umgebung erforderlich.

## Umsetzungs- und Prüfstand

Alle acht Punkte sind als Code im Entwicklungsbranch vorhanden. Der Editor verwendet eine gepflegte Sanitize-HTML-Abhängigkeit (keine laufenden Dienstkosten); Fremdbilder, aktive Tags, Event-Handler und gefährliche URL-Schemata werden entfernt. Paste/Drop von HTML wird als Text übernommen. Die Freigabe zeigt den bereinigten formatierten Inhalt.

Neue Migration: `20261114110000_ema_mail_productivity.sql`. Fünf zusätzliche Tabellen bleiben serverseitig mit RLS und ohne Browserrechte. Die bestehenden Projekt-Dokumente berücksichtigen Mail-/DMS-Verknüpfungen nur bei aktiviertem EMA Mail; der bisherige Ablauf bleibt bei deaktiviertem Modul unverändert.

Geplante Nachrichten werden im getrennten Endpunkt `/api/cron/ema-mail-dispatch` verarbeitet. Er erfordert zusätzlich `EMA_MAIL_SCHEDULED_SEND_ENABLED=true`, die vorhandene Modulfreigabe und das bestehende Cron-Secret. Ein Aufruf übernimmt höchstens eine fällige Nachricht und eine Antwortbeobachtung; ein unterbrochener Versand wird nicht erneut beansprucht. Versand erfolgt beim nächsten freien Scheduler-Lauf, nicht sekundengenau. Mehr als 24 Stunden verspätete Versandaufträge werden zur manuellen Prüfung blockiert. Der Termin darf maximal 30 Tage entfernt liegen.

Antwortbeobachtung gilt für eigene ausgehende Nachrichten und prüft spätere Mails der ursprünglichen An-/Cc-Empfänger im selben Conversation-Verlauf. Alias-Abweichungen, automatische Antworten und sehr große Verläufe können eine manuelle Prüfung erfordern. Bei unvollständigem Verlauf wird keine Behauptung „keine Antwort“ abgeleitet. Erinnerungen werden im bestehenden EMA-Erinnerungssystem angelegt; Push benötigt die vorhandene Gerätefreigabe.

71 Mail-/Sicherheits-/API-/Worker-Tests und SQL-Prüfung mit 12 RLS-Tabellen bestanden. Geprüft: HTML-Bereinigung, Reply-all ohne Bcc/Own-Adresse, private Vorlagen und Signaturen, fremde Projekte, Conversation-Cursor, explizite Terminfreigabe, unveränderliche Versanddaten, Rechteentzug, unklarer Versand ohne Wiederholung, Ablauf/Abbruch und Antwortbeobachtung. Vorhandene SQL-Tests für Budgets, Leases und parallele Claims bleiben enthalten.

Keine Migration, kein Cron und keine Versandfreigabe in Produktion aktiviert. Die Vorschau verwendet ausschließlich Demo-Aufträge. End-to-End-Abnahme mit echten Testpostfächern, isolierter Datenbank und physischem iPhone bleibt vor Live-Betrieb erforderlich.

Browserprüfung: Vorlage eingesetzt, Text fett/groß formatiert, Tabelle eingefügt und persönliche Vorlage wieder geladen. Demo-Terminfreigabe geprüft, Auftrag eingeplant und anschließend abgebrochen. Ein Überlappen von großem Text und Signatur wurde durch normalen Inhaltsfluss im Editor korrigiert. Der Datei-Uploadtest wurde unterbrochen und bleibt separat offen.
