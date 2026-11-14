# EMA Mail: eigenes Home-Bildschirm-Symbol und Ungelesen-Kennzeichen

Stand: 14.11.2026. Nur Entwicklungsbranch und Vorschau; keine Freischaltung oder Änderung der produktiven Umgebung.

## Umsetzung

- Das vom Nutzer hochgeladene eMail-Logo ist als PNG in 180, 192 und 512 Pixeln eingebunden. Das Originalmotiv einschließlich weißem Rand bleibt erhalten.
- Eigenes Manifest mit ID `/mail`, Start `/mail`, Name EMA Mail, Kurzname eMail und eigenen Apple-Touch-Icons. Das Manifest und die Symbole der übrigen EMA-Plattform bleiben unverändert.
- Eigener Service Worker `/mail/sw.js` mit Scope `/mail/`; kein Offline-Cache für Postfachinhalte. Vorhandener globaler Erinnerungs-Worker bleibt unverändert.
- App-Einstellungen erklären die Installation und bieten eine ausdrücklich vom Benutzer auszulösende Push-Registrierung. Die Vorschau registriert kein Gerät, fordert keine Berechtigung an und setzt keine Demo-Kennzeichen.
- `/api/mail/badge` ermittelt die Summe ungelesener Nachrichten in den Posteingängen des eigenen und aller intern freigegebenen gemeinsamen Postfächer. Kein Zählen der gerade geladenen Nachrichtenseite. Eigene Adresse als zusätzliche Mitgliedschaft wird nicht doppelt gezählt. Gelöschte Elemente/Junk und andere Ordner zählen nicht mit.
- Vollständige Mail-Sitzungs-, Mitarbeiter-, MFA- und Postfachprüfung; private no-store-Antworten. Bei nicht vollständig ermittelbarem Zähler kein Ersatz durch eine Teilsumme. Mehr als 50 Postfächer werden als nicht verfügbar gemeldet.
- Vordergrundabgleich alle 60 Sekunden, bei Rückkehr in die App sowie Änderungen der geladenen Nachrichten. Null entfernt das Kennzeichen. Netzwerkfehler behalten den letzten bekannten Stand; abgelaufene/entzogene Sitzung entfernt das Kennzeichen.
- Push aktualisiert den absoluten serverseitigen Zähler statt pro Ereignis zu erhöhen. Jeder Push zeigt weiterhin eine sichtbare Mitteilung. Kein stiller Push; kein Betreff oder Absender in neuen Mail-Mitteilungen. Mitteilungsklicks bleiben auf dem eigenen Ursprung im Mail-Modul.
- Geräte werden in der vorhandenen Tabelle ema_push_subscriptions gespeichert. HTTPS-Push-Endpunkte werden gegen die bestehende Allowlist geprüft, Schreibzugriffe gegen Origin und aktive Sitzung. Keine neue kostenpflichtige Infrastruktur und keine neue Datenbankmigration.

## Installation und Betriebsbedingungen

Safari → Teilen → Zum Home-Bildschirm. App anschließend über eMail öffnen. Unter Einstellungen in EMA Mail Mitteilungen und App-Kennzeichen aktivieren; im iPhone unter Einstellungen → Mitteilungen → eMail Kennzeichen erlauben.

iOS/iPadOS ab 16.4 unterstützt diese Kennzeichen für Home-Screen-Web-Apps mit erlaubten Mitteilungen. Aussehen und rote Farbe zeichnet das Betriebssystem. Der Benutzer kann Kennzeichen separat ausschalten; die Website kann diese Systemeinstellung nicht auslesen.

Quelle: https://webkit.org/blog/14112/badging-for-home-screen-web-apps/

Hintergrundabgleich benötigt den bereits vorbereiteten Mail-Worker, einen autorisierten Microsoft-Zugang und aktiviertes Neue-Mail-Push pro Postfach. Keiner dieser Produktivschalter wurde aktiviert. Der Hintergrundaufruf benötigt eine gültige App-Sitzung. Ohne diese bleibt kein Live-Zähler verfügbar. Änderungen aus Outlook auf einem anderen Gerät erscheinen beim nächsten Vordergrundabgleich oder einem nachfolgenden sichtbaren Push. Eine sofortige geräteübergreifende Read-Change-Push-Synchronisierung ist nicht umgesetzt.

## Prüfung

74 Mail-Tests bestanden, darunter drei neue API-Tests zu autorisierten Summen, ungültigen Zählern/Preview-Sperre sowie Push-Endpunkten/Origin. Vier zusätzliche PWA-Tests prüfen absolute Zähler bei wiederholtem Push, Null-/Sitzungs-/Fehlerverhalten, externe Klickziele und Manifest-/Icon-Dimensionen. TypeScript-Prüfung bestanden.

Echter Badge-/Push-Test auf einem physischen iPhone und mit isoliertem Microsoft-Testpostfach steht aus. Eine Vorschau allein kann diesen Systemtest nicht ersetzen. Keine echten E-Mails oder Push-Mitteilungen wurden versendet.
