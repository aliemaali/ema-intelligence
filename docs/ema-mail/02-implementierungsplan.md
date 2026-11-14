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

## Fortsetzung: Automatisierung und täglicher Mailbetrieb

Auf Basis des geprüften Branchs 073f69f vom 14.11.2026:

1. Kalender und Kontakte im Modul anlegen, bearbeiten und entfernen; Kalenderänderungen mit Teilnehmern ausdrücklich im Dialog freigeben. Aufgaben abschließen/wieder öffnen.
2. Graph-Reply-Entwürfe für echte Konversationen; auch deren Versand bleibt hinter derselben Inhaltsfreigabe. Keine automatischen Sender im Worker.
3. Pro Nutzer und Postfach einzeln einschaltbarer Inbox-Delta-Abgleich. Anfangsbestand ohne historische Benachrichtigungsflut; Cursor nur nach dauerhafter Übernahme der Jobs fortschreiben. Leasing, Wiederaufnahme, begrenzte Versuche und Backoff, erneute Rechteprüfung vor jedem Zugriff.
4. KI-Analyse mit bestehendem Stundenbudget, Cache, dauerhaftem Antwortentwurf und Rechnungshinweis. Bestehender Office-Import bleibt Buchungsautorität; keine zweite Rechnungsdatenbank.
5. Neue-Mail-Push über vorhandene Geräteabonnements. Standardmäßig nur allgemeiner Hinweis, keine Betreff-/Absenderdaten auf dem Sperrbildschirm. Push-Claim vor Versand, damit Wiederholungen keine Benachrichtigungsflut auslösen. Fehlende Abonnements und unklare Zustellung sichtbar ausweisen.
6. Migration und Cron-Einstieg nur im Branch vorbereiten. Kein produktiver Zeitplan, Consent oder Schalter wird geändert. Vor Echttests fehlen weiterhin eine isolierte Datenbank und Microsoft-Testpostfächer.
7. Negativtests für Rollen, Fremdzugriff, Cursor-Bindung, Opt-out/Rechteentzug, Leasing, Duplikate, Budgets, Replay und Hintergrund-Versandsperre; SQL und Build erneut prüfen. Erweiterte Demo für die neuen Abläufe bereitstellen.
