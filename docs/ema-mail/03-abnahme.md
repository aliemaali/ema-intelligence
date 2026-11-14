# EMA Mail – aktueller Implementierungs- und Abnahmestand

Stand: 14.11.2026. Branch: `feature/ema-mail`, Fortsetzung auf Basis von 073f69f. Keine Produktionsmigration, kein Merge nach main, keine Änderung produktiver Variablen, kein neuer produktiver Zeitplan. Keine echte E-Mail oder Test-Push an Benutzer versendet.

## Umsetzung der zehn Anforderungen

| Anforderung | Im Branch vorhanden | Noch zu prüfen |
|---|---|---|
| EMA-Oberfläche | Dunkles Design, türkise/grüne Akzente, Suche, Ordner, Pagination, Lesen, Entwürfe, Anhänge, Desktop/Mobil | Physisches iPhone |
| Microsoft Graph | Mail lesen/bearbeiten/senden, native createReply-Antworten, Kalender und Kontakte anlegen/bearbeiten/entfernen | Eigene und gemeinsame echte Testpostfächer |
| Mitarbeiter | Bestehende Anmeldung, aktive interne Rollen, MFA, eigene Microsoft-Verbindung pro Mitarbeiter | Mehrbenutzer-Echttest |
| Gemeinsame Postfächer | Administratorzuordnung Lesen/Bearbeiten/Senden plus zusätzliche Exchange-Prüfung | Send-As/Send-on-Behalf und Rechteentzug in Exchange |
| KI-Agent | Opt-in-Hintergrundanalyse, Prioritäts- und Rechnungshinweise in der Mail-Liste, private Analyse, dauerhafter Antwortentwurf, gemeinsames atomar begrenztes Stundenbudget | Qualität und Kosten mit realen Testnachrichten |
| Rechnungseingang | Automatischer bestehender Office-Delta-Import bleibt verantwortlich, Rechnungshinweise und autorisierter Office-Abgleich in Mail | Reale Office-Sitzung, vorhandene Intake-Konfiguration und Dubletten |
| DMS | Private Originalablage, Hash-Dublettenprüfung und Prüfung echter PDF-/PNG-/JPEG-Dateisignaturen | Gesamter Storage-/RLS-Fluss in Test-Supabase |
| Aufgaben/Hintergrund | Erinnerungen anlegen/erledigen/wieder öffnen; persistente Inbox-Cursor, Warteschlange, Leases, Backoff, Wiederaufnahme, Opt-out | Scheduler und Lasttest in isolierter Umgebung |
| iPhone/Push | Responsives Layout und eigene mobile Demo; bestehende PWA-/Geräteabonnements, generischer Neue-Mail-Push, Nachrichten-Deep-Link | Home-Screen-Installation, Erlaubnis und Zustellung auf Gerät |
| Versandfreigabe | Gespeicherter Inhalt und Reply-Quelle gehasht, fünfminütiges Einmaltoken, atomarer Claim, erneute Postfachprüfung, kein automatisches Wiederholen bei unklarem Status | Echte Exchange-Zustellung/Threading und parallele Fremdclient-Änderungen |

## Schutzmaßnahmen

- Mail und Worker sind standardmäßig abgeschaltet. Neue APIs bleiben in Vercel-Previews unabhängig vom Schalter gesperrt; die Demo verwendet nur erfundene Daten.
- Jede interaktive API prüft verifizierten Benutzer, aktives internes Profil, MFA, Herkunft und Eingaben. Hintergrundzugriff benötigt zusätzlich Cron-Secret, gesonderten Worker-Schalter und Postfach-Opt-in.
- Der Worker besitzt keine Freigabe- oder Sendefunktion. Er kann nur lesen, analysieren, nicht freigegebene Antwortentwürfe speichern und generische Push-Hinweise auslösen.
- RLS/Tabellenrechte verweigern sämtliche direkten Browserzugriffe auf die sieben Mail-Tabellen. Der Server schränkt jeden Zugriff auf den aktuellen Benutzer und das zugeordnete Postfach ein.
- Delta-Links sind an Graph-Host, Postfach und Inbox-ID gebunden. Der Cursor wird erst nach dauerhafter, eindeutiger Jobanlage fortgeschrieben.
- Rechteentzug und Opt-out werden zwischen Verarbeitungsschritten erneut geprüft; laufende Leases werden beim Opt-out ungültig. Keine Zustellungswiederholung nach unklarem Push-Status.
- Kontaktänderungen erhalten zusätzliche Adressen/Telefonnummern. Kalenderänderungen erfordern Freigabe; bestehende Online-Meeting-Texte bleiben erhalten, um Einwahllinks nicht zu beschädigen.
- Fremdes aktives HTML und Trackingbilder werden nicht eingebettet. DMS-Dateisignaturen sind keine Virenprüfung.

## Durchgeführte Prüfungen

- **53 Unit-/API-/Worker-Tests bestanden:** tatsächliche Session-/Rollen-/MFA-Prüfung, CSRF, Postfachrechte, Replay/Parallelversand, native Antwortfreigabe, Kalender-/Kontaktänderungen, fremde Erinnerungen, Worker-Schalter, Cursor-Bindung, historische Nachrichten, Teilfehler, Rechteentzug, Wiederaufnahme, Budgets und sichere Push-Endpunkte.
- **SQL lokal mit PGlite/Postgres bestanden:** beide Migrationen, sieben RLS-Tabellen; anon/authenticated verweigert; nur Service-Rolle auf neue Mailtabellen/Funktionen; einmaliger Versand-Claim; genau 20 von 25 parallelen Budget-Claims; nur ein Sync-/Job-Claim; doppelte Jobs abgewiesen; verlassene Leases wieder aufgenommen; ausgeschöpfte Jobs als fehlgeschlagen markiert.
- **Bestandsregressionen erneut bestanden:** 16 Push-Status- und 44 Smart-Check-Tests.
- **TypeScript und Next.js-Produktionsbuild bestanden**, Mail-Komponenten ohne neue Lint-Fehler. Keine Runtime-Abhängigkeit hinzugefügt; Quellcode für Prüfung lesbar formatiert.
- Desktop-Demo inkl. Analyse/Entwurf/Freigabe im Browser geprüft. Kalenderänderung mit Freigabe, Kontaktformular und mobile Liste-/Leseansicht bei 390 × 844 geprüft; Aufgaben erledigt und über den Filter wieder angezeigt. Dabei doppelte Überschriften, Beschriftungen im Freigabedialog und mobile Icon-Namen korrigiert. Physische Geräte- und Graph-Echttests bleiben getrennt.

## Bewusste Grenzen vor vollständigem Outlook-Ersatz

1. Die neue Datenbank und der Worker sind in Produktion **nicht** eingerichtet. Vercel Preview und Produktion teilen im Bestand Variableneinträge; daher fehlt eine sicher isolierte, produktionsnahe Testinstanz mit eigenen Microsoft-Testpostfächern.
2. Polling ist kein Echtzeit-Webhook. Durchsatz, Warteschlangenlatenz und Runtime-/Tarifgrenzen sind zu messen. Der Worker ist zunächst für kleine Teams begrenzt; Details in `04-hintergrundbetrieb.md`.
3. Der bestehende Office-Import unterstützt die dort eingerichteten autorisierten Rechnungspostfächer, derzeit die beiden EMA-Adressen. Weitere Mitarbeiterpostfächer werden nicht automatisch zu Office-Rechnungspostfächern.
4. Native Antworten sind umgesetzt. Weiterleitung übernimmt bislang Text; Originalanhänge müssen bewusst ergänzt werden. Anhänge beim Verfassen zusammen ca. 2,25 MB. Große Upload-Sessions, beliebige Unterordner/Regeln, Signaturen, Serien-/delegierte Kalender und Offline-/S/MIME-Unterstützung sind noch keine vollständige Outlook-Parität.
5. Der neue Mail-Versand verlangt Freigabe. Ältere Versandwege anderer EMA-Module bleiben bestehen; für einen plattformweiten Ausschließlichkeitsnachweis müssen diese separat migriert werden.
6. Datenaufbewahrung/Löschung für Entwürfe, Audit und KI-Cache sowie Belastungs-/Sicherheitsabnahme sind vor Live-Betrieb festzulegen. Eine Demo ersetzt diese Abnahmen nicht.

## Nächster notwendiger Abnahmeschritt

Isolierte Supabase-Testdatenbank und eigenes/shared Microsoft-Testpostfach anbinden, beide Migrationen dort testen, den vorbereiteten Worker nur dort aktivieren und Office-/Exchange-/iPhone-Flüsse Ende zu Ende prüfen. Erst danach eine konkrete Live-Freigabe vorbereiten. Die Betriebsanleitung enthält keine bereits ausgeführte Produktivänderung.

## Oberfläche nach Outlook-Vorbild (14.11.2026)

- Kompakte App-Leiste, Ordnernavigation, Nachrichtenliste, Lesebereich und zentrale Befehlsleiste; EMA-Farben bleiben erhalten.
- Neues Schreibfenster am unteren rechten Rand, vergrößerbar und minimierbar; auf schmalen Geräten bildschirmfüllend.
- Von/An/Betreff als kompakte Zeilen, Cc/Bcc zuschaltbar, Dateiablage, Entwurfsspeicherung und funktionale Textwerkzeuge für Listen/Einrückung.
- Editor bleibt bewusst als „Nur Text“ gekennzeichnet. Rich-Text-Schriftformatierung ist noch nicht implementiert. Keine inaktiven Fett-/Kursiv-Schaltflächen.
- „Senden“ öffnet weiterhin ausschließlich die Prüfung; der bestehende Freigabe-/Einmaltoken-Versandpfad wird unverändert verwendet.

## Helle und dunkle Ansicht (14.11.2026)

EMA Mail startet standardmäßig mit weißen Flächen. Der Hell-/Dunkel-Schalter im Kopfbereich ist auf Desktop und Mobil sichtbar. Die Präferenz wird ausschließlich für EMA Mail unter `ema-mail-theme-v1` gespeichert; bei gesperrtem Browser-Speicher bleibt der Schalter für die Sitzung funktionsfähig. Andere EMA-Module werden nicht umgestellt. Schreibfenster, Dialoge, Kalender, Kontakte, Aufgaben und Einstellungen verwenden dieselbe lokale Ansicht.

## Anhangvorschau und Logo (14.11.2026)

PDF-/PNG-/JPEG-Anhänge öffnen per Klick in einem Dialog. Echte Dateien werden über den bestehenden authentifizierten, postfachgebundenen Anhang-Endpunkt abgerufen. Dateityp und Signatur werden vor der Darstellung geprüft, HTML/SVG/Office-Dateien werden nicht eingebettet. Temporäre Blob-URLs werden beim Schließen verworfen; keine externen Viewer oder öffentlichen Storage-Links. Browser-PDF-Unterstützung vorausgesetzt; „Im Browser öffnen“ und Download bleiben als Ausweichmöglichkeiten. Die Demo erzeugt eine ausdrücklich markierte Beispieldatei. Der Kopfbereich verwendet das vorhandene EMA-Wort-/Bildlogo aus `/brand/ema-logo.png`.

## Absendersignatur und Bestätigungen (14.11.2026)

- Für `unluer@ema-enterprise.de` wird die vom Benutzer gelieferte Signaturdatei eingebunden. Beim Verfassen und vor der Freigabe ist sie sichtbar. Andere Absender erhalten diese Signatur nicht. Die eigene Adresse wird aus der gespeicherten Microsoft-Verbindung bezogen; gemeinsame Postfächer behalten die vorhandene Rechteprüfung.
- Der Server prüft die Zuordnung beim Speichern, Freigeben und Senden erneut. Die versionierte Signatur ist Teil des Freigabe-Hashes; die exakten Bildbytes werden vor dem Versand zusätzlich per SHA-256 geprüft. Ältere Entwürfe müssen bei abweichender Signatur erneut geöffnet und gespeichert werden.
- Das Bild wird als Inline-CID-Anhang versendet, ohne externen Bildabruf. Der Nachrichtentext bleibt im Editor Klartext und wird für die Signatur-Mail vor der HTML-Ausgabe escaped. Native Antworten erhalten denselben Inhalt und Inline-Anhang.
- Lesebestätigung und Empfangs-/Zustellbestätigung sind unabhängig wählbar und standardmäßig aus. `isReadReceiptRequested` und `isDeliveryReceiptRequested` werden an Graph übergeben und sind Teil der Freigabe. Eine Rückmeldung wird nur angefordert; Empfänger-/Serversysteme können sie unterdrücken.
- 56 Mailtests bestanden, darunter CID-Bild und Escaping, optionale Bestätigungen, Freigabe-Hash, falscher/geänderter Absender und der native Antwortpfad mit beiden Bestätigungen. Kein echter Versand ausgeführt. Exchange-Zustellung und reale Bestätigungsantworten bleiben Bestandteil der isolierten Abnahme.
