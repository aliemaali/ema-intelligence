# EMA Mail – Hintergrundbetrieb und Testfreigabe

## Implementierter Ablauf

Ein persönliches Opt-in unter Einstellungen legt für das gewählte Postfach eine serverseitige Sync-Konfiguration an. Ein Cron-Aufruf von `/api/cron/ema-mail` übernimmt höchstens einen Postfach-Abgleich und einen Verarbeitungsjob. Microsoft liefert nur Inbox-Änderungen; Delta-Links werden auf Host, Postfach und aufgelösten Inbox-Ordner gebunden. Zeitfilter und dauerhaft eindeutige Jobs verhindern die Benachrichtigung historischer Nachrichten und Mehrfachverarbeitung. Eine Seite wird erst nach dauerhaftem Enqueue bestätigt.

Der Worker prüft aktive Mitarbeiter und Shared-Mail-Rechte erneut, nutzt die persönliche gespeicherte Microsoft-Verbindung und kann weder Entwürfe freigeben noch E-Mails versenden. KI-Ausgaben werden privat gespeichert; ein Antwortentwurf besitzt immer `status=draft`. Ein begrenztes KI-Budget gilt gemeinsam für manuelle und automatische Analysen. Bei Opt-out werden offene Jobs abgebrochen und laufende Leases ungültig.

Neue-Mail-Push verwendet vorhandene `ema_push_subscriptions`, einen allgemeinen Sperrbildschirmtext und einen relativen Deep-Link auf die Nachricht. Vor Push wird der Job atomar beansprucht. Unklare Zustellung wird nicht automatisch wiederholt. Keine Geräte und unklarer Push bleiben im Jobstatus sichtbar. Höchstens fünf Geräte pro Job werden angesprochen; zusätzliche Geräte benötigen eine Erweiterung der Zustellungswarteschlange. Es gibt keine garantierte Push-Zustellung. Endpunkte außerhalb bekannter Browser-Push-Anbieter sind gesperrt.

Die Abfrage ist Polling, kein Echtzeit-Webhook. Bei einem vorgesehenen minütlichen Aufruf wird ein Postfach frühestens nach fünf Minuten erneut abgefragt; Zwischen-Seiten können beim nächsten Aufruf folgen. Jeder Lauf ist begrenzt. Mehr Mitarbeiter, viele E-Mails oder lange KI-Antworten erhöhen die Warteschlangenlatenz. Durchsatz und Tarifgrenzen müssen im Lasttest gemessen werden. Ein Ablauf mit über 5.000 Nachrichten seit dem Zeitfilter muss gesondert geprüft werden; Microsoft begrenzt gefilterte Delta-Abfragen.

## Office und DMS

Der bereits bestehende Office-Worker `/api/cron/invoice-mail` bleibt alleiniger automatischer Rechnungsimport. Er prüft die eingerichteten und autorisierten Postfächer, klassifiziert Rechnungsanhänge und übergibt sie mit Dublettenprüfung an Office/DMS. EMA Mail zeigt Rechnungshinweise und kann den vorhandenen autorisierten Abgleich auslösen. Es werden keine Office-Sitzungen oder Geheimnisse aus der Mail-Warteschlange an einen frei wählbaren Server weitergereicht. Weitere Mitarbeiter-Postfächer sind erst dann automatisch in Office erfasst, wenn sie dort als Rechnungseingang unterstützt und eingerichtet sind.

Manuelle DMS-Ablage aus EMA Mail überprüft zusätzlich den tatsächlichen PDF-/PNG-/JPEG-Dateianfang. Das ist keine Virenprüfung.

## Ausdrücklich noch nicht aktiviert

Keine der nachfolgenden Maßnahmen wurde auf Produktion ausgeführt:

1. Beide Migrationen in eine isolierte Supabase-Testdatenbank übernehmen, Rollen/RLS samt vorhandenen Tabellen prüfen und Sicherheitsadvisor ausführen.
2. Microsoft-Testbenutzer und Shared-Testpostfach mit Lesen/Bearbeiten/Senden zuordnen. OAuth-Redirect für die isolierte Testinstanz korrekt registrieren; zusätzlichen Mail-Consent nur dort bestätigen.
3. Eine separate Testinstanz mit den Testzugangsdaten betreiben. Vercel-Previews des bestehenden Projekts bleiben gesperrt. Ein separat angebundener Testbetrieb darf `EMA_MAIL_ENABLED=true` und `EMA_MAIL_WORKER_ENABLED=true` verwenden, nachdem die Datenbank-/Postfachisolation geprüft ist.
4. Bestehendes `CRON_SECRET` der Testinstanz als Bearer authentifizieren. Einen kostenlosen bzw. tariflich gedeckten bestehenden Scheduler dort auf die exakte Test-URL einrichten; kein Zeitplan wurde angelegt. Das Beispiel ist eine Betriebsanleitung und kein bereits laufender Dienst.
5. Als Benutzer in Mail die gewünschten Optionen pro Postfach aktivieren; auf iPhone EMA als Home-Screen-App installieren und in der vorhandenen Assistenz Push erlauben.
6. Eigene/shared Testnachrichten, Rechteentzug, 429/410, Prozessabbruch, Budgetlimit, Office-Dubletten, native Antwortthreads und iPhone-Benachrichtigungen prüfen. Modellantworten und Zustellungsstatus inhaltlich prüfen.
7. Erst nach Abnahme und ausdrücklicher Live-Freigabe Migration, Consent, Zeitplan und Produktivschalter übernehmen. Bei Rücknahme beide Mail-Schalter ausschalten; keine Bestandsdaten löschen.

## Quellen

- https://learn.microsoft.com/en-us/graph/delta-query-messages
- https://learn.microsoft.com/en-us/graph/api/message-createreply?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/event-update?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/contact-update?view=graph-rest-1.0

## Ergänzung: ausdrücklich freigegebener Terminversand

Der bestehende KI-/Inbox-Worker bleibt ohne Sendefunktion. Der neue getrennte Endpunkt `/api/cron/ema-mail-dispatch` benötigt `EMA_MAIL_SCHEDULED_SEND_ENABLED=true` und `EMA_MAIL_ENABLED=true` außerhalb von Vercel Preview sowie das bestehende Cron-Secret. Er verwendet ausschließlich dauerhaft freigegebene, gehashte Versand-Snapshots und prüft Mitarbeiter-/Postfachrechte erneut. Die SQL-Vorlage `scheduler-test-approved-send-example.sql` richtet nur nach ausdrücklicher Auswahl einer isolierten Testumgebung einen Test-Cron ein und wurde nicht ausgeführt. Details und Grenzen in 05-alltag-erweiterungen.md.
