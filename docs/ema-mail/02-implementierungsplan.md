# EMA Mail – Implementierungsplan und Abnahmekriterien

## 1. Isoliertes Fundament

Branch feature/ema-mail, neue Pfade /mail und /api/mail. Produktivschalter EMA_MAIL_ENABLED standardmäßig aus; Preview-APIs immer gesperrt. Demo /mail/preview ohne Mail-API und ohne echte Daten. Bestehende Module und Altrouten bleiben bestehen. Migrationen nur als Dateien, niemals automatisch gegen Produktion ausführen.

## 2. Mail-Oberfläche und Graph

Drei Spalten auf Desktop, Liste/Lesen-Wechsel auf iPhone; Ordner, Suche, Pagination, Priorisierung, Mail öffnen, Antworten/Weiterleiten/Neu, Anhänge, Entwürfe, Archiv/Papierkorb/Lesestatus/Markierung. Textdarstellung statt fremdem aktivem HTML und Trackingbildern. Kalender und Kontakte im Modul anzeigen und vorhandene Graph-Struktur nutzen.

## 3. Identität, Shared-Mail und Freigabe

Verifizierte Supabase-Sitzung, aktive interne Rolle, MFA; eigene Verbindung für jeden Mitarbeiter. Shared-Zuordnungen serverseitig verwalten, Exchange erzwingt zusätzliche Rechte. Persistente Entwürfe mit Versions-Hash; Freigabe an Nutzer, Postfach, Empfänger, Betreff, Text und Anhänge gebunden, fünf Minuten gültig. Einmaliger atomarer Versand-Claim; Status submitted/uncertain; kein automatisches Retry nach Netzwerkfehler.

## 4. Analyse, Office, DMS, Aufgaben

Regelbasierte Priorisierung ohne Kosten; optionale strukturierte KI-Analyse und Antwortentwurf mit bestehendem OPENAI_API_KEY, begrenztem Input/Output, ohne Tools/Versandrecht, ohne automatische Zahlungen. Mailinhalt als nicht vertrauenswürdige Daten behandeln. Rechnungshinweis ist keine Buchungsbestätigung. Office-Sync über vorhandenen autorisierten Endpunkt, DMS mit Dublettenprüfung und privater Ablage; Aufgaben/Push-Erinnerungen über bestehende Datenmodelle.

## 5. Hintergrund und iPhone

Bestehenden Office-Rechnungsabgleich und Reminder-Dispatcher weiterverwenden. Allgemeine Mail-Synchronisation braucht dauerhafte Delta-Cursor, Queue, Dedup/Leases, Webhook-Validierung, Erneuerung und getrennte Tests. Shared-Push nicht als mit delegiertem Mail.Read.Shared lösbar darstellen. Dafür nachgelagerter, auf Postfächer beschränkter Application-Zugang oder bewusster Pollingbetrieb. Keine neue kostenpflichtige Plattform zwingend nötig. iPhone-PWA/Home-Screen und Erlaubnis sind für Web Push erforderlich.

## 6. Prüfungen und Freigabe

- Unit-/Route-Tests für Feature-Sperre, fremde Postfächer, URL-Injection, CSRF, Rollen/MFA, Validierung, Freigabeablauf, Replay/Parallelversand, unklaren Versand und XSS-Textdarstellung.
- TypeScript und Next-Produktionsbuild, Bestandsregressionen; Desktop/Mobil-Vorschau.
- Separat erforderlich: Testdatenbank-Migration samt RLS-Negativtests, echte Graph-Testpostfächer (eigene/shared), Rechteentzug, Office-SSO/Import/Dubletten, Netzfehler und iPhone-Push auf Gerät.
- Fertigstellungsstatus pro Funktion dokumentieren. Erst nach diesen Abnahmen vollständigen Outlook-Ersatz freigeben.
- Live-Freigabe durch Ali erforderlich vor Migration, Entra-Consent-Änderung, Environment-Aktivierung, Merge oder Promotion. Rollback: Mail-Schalter aus; Branch-Deployment zurücknehmen; keine Bestandsdaten löschen.

## Kosten

Bestehende Next/Vercel/Supabase/Microsoft/Web-Push-Systeme verwenden. Keine neuen Abonnements angelegt. KI-Aufrufe sind verbrauchsabhängig; keine pauschale Kostenfreiheit versprechen. Lizenz- und Hostinggrenzen vor echter Hintergrundaktivierung anhand des vorhandenen Tarifs prüfen.
