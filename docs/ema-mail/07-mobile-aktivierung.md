# Mobile Ansicht und Aktivierung – 14.11.2026

Der Nutzer hat die Korrektur der iPhone-Proportionen sowie die Aktivierung der bislang gesperrten Mail-Funktionen ausdrücklich beauftragt.

## Mobile Ansicht

Nur unter 650 CSS-Pixeln: dynamische Bildschirmhöhe mit Safe-Area-Abständen, kompakter Kopfbereich und Befehlsleiste, kompaktere Nachrichtenzeilen, getrennt scrollende Mail-Liste/Leseansicht/Einstellungen. Suchfeld mit 16px-Schrift gegen automatisches iOS-Eingabezoom. Kein starres Bildseitenverhältnis; verfügbare Bildschirmfläche wird verwendet. Desktop bleibt unverändert.

## Aktivierung

Produktionsschalter EMA_MAIL_WORKER_ENABLED und EMA_MAIL_SCHEDULED_SEND_ENABLED werden eingeschaltet. Preview bleibt durch isMailEnabled unabhängig von diesen Schaltern gesperrt. Zwei minütliche Jobs im vorhandenen Supabase pg_cron/pg_net rufen ausschließlich app.ema-enterprise.de auf; das bestehende Cron-Secret bleibt im Vault. Die Vorlage scheduler-production.sql ist ein ausdrücklich auszuführendes Betriebsartefakt und keine automatische Migration. Vor dem Einrichten vorhandene gleichnamige Jobs prüfen.

Die persönliche Mail-Automatisierung wird über die angemeldete App-Sitzung aktiviert. Keine pauschale Aktivierung für andere Mitarbeiter. Opt-in setzt den Startzeitpunkt; historische Nachrichten werden nicht nachträglich analysiert oder als neue Mail gemeldet. KI bleibt auf 20 Analysen pro Benutzer/Stunde begrenzt. Ein Worker-Lauf verarbeitet höchstens einen Postfach-Abgleich und einen Job; ein Postfach wird frühestens nach fünf Minuten erneut abgefragt.

Terminversand benötigt weiterhin eine ausdrückliche Freigabe für den unveränderten Entwurf mit Empfängern, Anhängen und Termin. Leases/atomare Claims verhindern parallelen Versand; unklare Zustellungen werden nicht automatisch wiederholt. Keine Test-Mail ohne konkreten Empfängerauftrag. Antwortbeobachtung erzeugt bei ausbleibender Antwort eine private Erinnerung.

Push ist serverseitig und pro persönlichem Postfach aktivierbar. Auf dem physischen iPhone muss eMail über das eigene Home-Bildschirm-Symbol geöffnet und die Erlaubnis über „Mitteilungen und App-Kennzeichen aktivieren“ erteilt werden. Geräte- und Betriebssystemerlaubnis lässt sich nicht vom Server erteilen. Ohne diese kann kein rotes App-Kennzeichen und keine Zustellung auf diesem Gerät garantiert werden. Der physische iPhone-Test und ein echter Terminversandtest bleiben offen.

Prüfung vor Release: 74 Mail-Tests, 5 PWA-Tests und TypeScript bestanden. Zusätzlich mobile Demo und echte Produktions-Laufantworten prüfen. Keine Geheimnisse in Quellcode, URL oder Prüfprotokoll ausgeben.
