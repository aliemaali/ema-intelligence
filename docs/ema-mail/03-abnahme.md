# EMA Mail – Implementierungs- und Abnahmestand

Stand: 14.11.2026. Branch: feature/ema-mail. Kein Merge, keine Produktionsmigration, kein produktives Environment geändert, keine echte E-Mail gesendet.

## Umgesetzt im Feature-Branch

- Eigenes Modul mit dunklem EMA-Design, Desktop-Dreispaltenansicht, responsiver Liste/Lesen-Ansicht, Postfachwechsel, Suchfeld, Ordnern und Pagination.
- Graph-Adapter für Nachrichten/Textinhalt, Lesen/Ungelesen, Markierung, Archiv/Papierkorb, Anhänge. Kein fremdes HTML oder Trackingbild eingebettet.
- Verfassen/Antwortentwurf/Weiterleiten als Text, An/CC/BCC, kleine Anhänge (zusammen maximal ca. 2,25 MB), gespeicherte EMA-Entwürfe. Antwort derzeit neue Mail mit Re-Betreff, kein nativer Graph-Reply mit Conversation-Zuordnung; Weiterleitung übernimmt Text, Anhänge müssen bewusst ergänzt werden.
- Serverseitige einmalige Freigabe des gespeicherten Inhalts: SHA-256, kurzlebiges Token, Eigentümerprüfung, atomarer Claim, keine Wiederholung bei unklarem Versand.
- Aktive interne Mitarbeiter, MFA-Prüfung in der API, je Nutzer persönliche Microsoft-Verbindung; Shared-Mail zusätzlich nach Lesen/Bearbeiten/Senden zugeordnet. Administrationsoberfläche für bestehende Teammitglieder, keine neue Benutzerverwaltung parallel zum Bestand.
- Eigener Microsoft-Mail-Consent-Einstieg. Zusätzliche Scopes werden nur dort angefragt. Keine Entra-Einstellungen geändert.
- Optionale strukturierte KI-Analyse mit Antwort- und Aufgabenvorschlag, zwischengespeichert, begrenzte Eingabe/Ausgabe; ohne Tools oder Versandrecht. Atomarer DB-Claim begrenzt neue Analysen auf 20 pro Nutzer/Stunde, auch bei parallelen Anfragen.
- Regelbasierter Rechnungshinweis und Anstoß des bestehenden autorisierten Office-Abgleichs. Kein neuer Buchungsautomat und keine automatische Zahlung.
- Private DMS-Übernahme von PDF/JPEG/PNG-Anhängen mit Hash-Dublettenprüfung; bestehendes Dokumentmodell und Storage-RLS.
- Kalender-/Kontakt-Leseansicht, persönliche Erinnerungen über bestehenden EMA-Reminder-Dispatcher.
- Sichere Demo mit erfundenen Personen und example.com-Adressen. Mail-APIs ohne Aktivierungsflag gesperrt; in Vercel-Previews unabhängig vom Flag gesperrt.

## Nachweis

- 24 Unit-/Route-Tests bestanden. Tatsächliche Session-Prüfung, Rollen/MFA, Shared-Rechte, CSRF, fremde Graph-Pagination, Entwurfsänderung, Freigabe/Parallelversand/Replay, unklarer Versand und Textausgabe.
- Bestandsregressionen: 16 Push-Status-Tests und 44 Smart-Check-Tests bestanden.
- TypeScript-Prüfung bestanden.
- Vollständiger Next.js-Produktionsbuild erfolgreich; vorhandene Warnungen bleiben. Neue Mail-Komponenten lint-geprüft.
- Neue Migration lokal mit PGlite/Postgres geprüft: vier Tabellen mit RLS, direkte Lesezugriffe für anon/authenticated auf allen vier Tabellen verweigert, Servicezugriff erlaubt, ungültige Freigabezustände verworfen, paralleler Versand-Claim nur einmal erfolgreich; 25 gleichzeitige KI-Budget-Anfragen lassen genau 20 Aufrufe zu. Keine Live-Datenbank verändert. Reproduzierbarer Test: tools/test-mail-schema.cjs mit separat installiertem @electric-sql/pglite (EMA_MAIL_PGLITE_PATH); keine zusätzliche App-Abhängigkeit. Das ersetzt keine Migration gegen einen kompletten isolierten Supabase-Klon.
- Vercel-Preview-Deployment erstellt. HTTP-Vorschau hinter Vercel-Schutz erfolgreich abgerufen. Desktop-Sichtprüfung und interaktiver Ablauf Analyse → Antwortentwurf → Inhaltsprüfung → Demo-Freigabe erfolgreich im Browser beobachtet. Mobile Geräte-/Viewport-Prüfung und physisches iPhone noch offen.

## Noch offen – deshalb noch kein vollständiger Outlook-Ersatz

1. Vollständige Graph-Echttests mit isolierten eigenen und gemeinsamen Testpostfächern; erneuter Consent, Exchange Send-As/Send-on-Behalf, Rechteentzug und Tokenrotation.
2. Allgemeiner dauerhafter Mail-Hintergrundabgleich, automatische KI-Analyse nach Opt-in, Delta-Cursor/Queue/Webhook-Lifecycle und Neue-Mail-Push. Der bestehende Office-Rechnungsabgleich und Erinnerungs-Push werden wiederverwendet; sie sind kein allgemeiner Mail-Push.
3. Kalender-/Kontakt-CRUD direkt in EMA Mail, Terminserien/Einladungen und Delegation. Aktuell Leseansichten; vorhandene Kalender-/Kontaktmodule bleiben erhalten.
4. Vollständige Thread-/Reply-Semantik, beliebige Unterordner, Regeln, Signaturen, große Anhänge/Upload-Sessions, S/MIME/Offline-Sync. Der sichere Text-Client deckt diese Outlook-Funktionen noch nicht ab.
5. Test echter Office-Sitzung/Berechtigungen, Import/Dubletten/DMS und iPhone-Web-Push auf einem physischen Gerät.
6. Sicherheitsabnahme der Bestands-Sender: Der neue Versandpfad erzwingt Freigabe; ältere Microsoft-/Acquisition-/Office-Sender wurden nicht stillschweigend umgestellt. Plattformweiter Ausschließlichkeitsnachweis erfordert gesonderte Migration.
7. Datenhaltungs-/Löschkonzept für gespeicherte Entwürfe, KI-Cache und Audit vor Live-Betrieb festlegen; keine pauschale Compliance-Zusage.

## Freigabegrenze

Vorschau kann ohne Echtdaten geprüft werden. Ein produktionsnaher Test braucht getrennte Datenbank und Testpostfächer; diese sind noch nicht für EMA Mail eingerichtet. Vor produktiver Aktivierung sind die obigen Abnahmen sowie ausdrückliche Live-Freigabe erforderlich. Keine Aufforderung zur Live-Freigabe allein aufgrund dieser Demo.
