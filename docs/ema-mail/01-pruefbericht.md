# EMA Mail – technischer Prüfbericht

Stand: 14.11.2026. Geprüfter Hauptzweig: 772901361e317d67c23949d02068313ad0fd0c52.
Prüfung: Quellcode, produktive Datenbank-Metadaten/RLS (nur lesend), Vercel-Projekt und Variablennamen. Keine produktiven Daten oder Einstellungen geändert. Keine E-Mail versendet.

## Bestand und Wiederverwendung

| Bereich | Befund | Konsequenz |
|---|---|---|
| Frontend | Next.js 15.5.24, React 18, CSS Modules, Lucide, dunkles EMA-Design | Neues Modul /mail, keine neue UI-Bibliothek |
| Auth | Supabase SSR-Cookies, profiles, is_active, MFA; Partnerrollen | Jede Mail-API prüft Sitzung, aktives internes Profil und MFA selbst |
| Microsoft | Delegiertes OAuth, zwei gespeicherte Verbindungen; AES-256-GCM-Token und Cache; serverseitiger Service-Schlüssel | Bestehende Verbindung je Mitarbeiter nutzen, niemals fremde Tokens übernehmen |
| Graph-Rechte | Mail.Read, Mail.Read.Shared, Mail.Send, Kalender/Kontakte ReadWrite | Lesen möglich; für Mail-Änderungen/Shared-Versand fehlen zusätzliche Scopes; erneute Zustimmung vor Aktivierung erforderlich |
| Mail-Funktionen | Dashboard-Vorschauen und regelbasierte Priorisierung, bestehender Dokumentenversand | Vollständiger Mail-Client und einmalige Entwurfsfreigabe fehlen |
| DMS | documents, ema-dms-Bucket, SHA-256-Dubletten, eigene Nutzer-RLS | Originalanhänge in bestehende Ablage übernehmen |
| Office | Eigenes privates Repo aliemaali/ema-office, Next-Rewrite /office; Prisma statt Intelligence-Datenmodell | Keine direkte Kopie in vermeintliche Supabase-Rechnungstabelle |
| Rechnungen | Office besitzt Delta-Sync, Subscriptions, Anhänge, Klassifizierung und Ingest/Dubletten | Bestehendes POST /office/api/intelligence/invoice-sync verwenden; Office prüft eigene Sitzung und drei Berechtigungen |
| Hintergrund/Push | ema_reminders, atomarer Claim, web-push und sw.js vorhanden | Erinnerungen wiederverwenden; allgemeine neue-Mail-Push noch gesondert umzusetzen |
| Hosting | Vercel ema-intelligence; Hauptzweig entspricht letzter geprüfter Produktion; Schutz für Preview-URLs | Nur Feature-Branch und Preview, kein Merge/Promote |

## Sicherheits- und Betriebsbefunde

1. **Vorschau nicht datenisoliert:** Variablennamen und Zielbereiche zeigen dieselben Supabase-/Microsoft-Variablen für Preview und Production. Neue Mail-APIs bleiben in Vercel-Previews grundsätzlich gesperrt. /mail/preview verwendet ausschließlich erfundene lokale Daten. Ein produktionsnaher Integrationstest braucht getrennte Testdatenbank und Testpostfächer.
2. **Versandfreigabe:** Der bestehende /api/microsoft/send-mail-Endpunkt versendet Dokumente unmittelbar nach authentifiziertem POST. Keine gespeicherte einmalige Freigabe. Für EMA Mail neuer, isolierter Ablauf: Entwurf speichern → exakten Inhalt prüfen → kurzlebige Freigabe → atomarer Claim → Graph. Ändern invalidiert Freigaben. Unklarer Versandstatus wird nicht automatisch wiederholt. Der Alt-Endpunkt bleibt außerhalb des neuen Moduls unverändert; plattformweite Umstellung ist ein eigener Migrationsschritt.
3. **Postfachrechte:** Die Dashboard-Postfächer sind im Quellcode fest eingetragen. EMA Mail benötigt explizite Mitarbeiter-Zuordnung mit Lesen/Bearbeiten/Senden; Microsoft Exchange-Rechte gelten zusätzlich. Kein App-only-Generalschlüssel im interaktiven Client.
4. **Graph-URLs:** Bestandshelper akzeptiert beliebige absolute HTTPS-Adressen. Neues Modul erlaubt nur graph.microsoft.com/v1.0 und an das berechtigte Postfach gebundene Pagination; keine Tokenweitergabe bei Redirects.
5. **CI:** Bestehender Workflow checkt einen festen älteren PDF-Fix-Branch aus und ist kein zuverlässiger Hauptzweig-Test. Eigener lesender Mail-Workflow erforderlich.
6. **Build-Reproduzierbarkeit:** npm ci schlägt bereits im unveränderten Bestand fehl: package-lock.json ist veraltet. pnpm ist deklarierter Paketmanager; pnpm-Lock prüfen und verwenden. Keine unnötigen Paket-Upgrades.
7. **Datenbank:** microsoft_connections verbietet direkte Clientzugriffe; Dokumente/Erinnerungen sind nutzergebunden, MFA ist zusätzlich restriktiv. profiles besitzt einen Trigger gegen unberechtigte Rollenänderungen. Keine Tokeninhalte oder E-Mail-Inhalte aus der Produktion gelesen.
8. **Advisor:** Ein bestehender Hinweis: Schutz gegen kompromittierte Passwörter deaktiviert. Nicht geändert. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
9. **Token-Schlüsselrotation:** Verschlüsselung wird vom Microsoft Client Secret abgeleitet. Rotation muss mit Umschlüsselung oder erneuter Verbindung geplant werden.

## Grenzen der Prüfung

Keine Exchange-Admin-Konfiguration und keine tatsächlichen Entra-Consent-Grants geprüft; gespeicherte Verbindungen beweisen keine heute gültigen Rechte. Kein tatsächlicher Versand-, iPhone-Push- oder Office-Buchungstest mit Echtdaten. Noch keine Zusage eines vollständigen Outlook-Ersatzes oder einer Produktionsfreigabe.

## Referenzen

- https://learn.microsoft.com/en-us/graph/outlook-share-messages-folders – Shared-Mail benötigt delegierte Rechte; Shared-Change-Notifications benötigen Application-Rechte.
- https://learn.microsoft.com/en-us/graph/api/user-sendmail – 202 bedeutet angenommen, nicht zugestellt.
- https://supabase.com/changelog.md – geprüft; keine Bibliotheks-Upgrades vorgenommen.

## Nachprüfung für die Fortsetzung

Am 14.11.2026 erneut geprüft: Der Remote-Branch entspricht 073f69f; die Live-Domain verweist weiterhin auf das bisherige Deployment dpl_8YW939H5npyjJijnjLyp9Zx9uUze. Die produktive Datenbank besitzt Microsoft-Verbindungen, aber weder EMA-Mail-Entwurfs- noch Sync-/Jobtabellen. Die neuen Migrationen wurden dort nicht ausgeführt. Vercel nutzt weiterhin dieselben Variableneinträge für Produktion und Preview; beide neuen Mail-Schalter fehlen. Deshalb bleiben die geschützten Vorschauen strikt Demo und sämtliche neuen Mail-/Worker-APIs dort gesperrt.

Für die Fortsetzung wurden Microsofts aktuelle Graph-Dokumente zu Delta, createReply, Kalenderanlage/-änderung und Kontaktänderung geprüft. Der Hintergrundbetrieb verwendet delegierten Inbox-Delta-Abgleich statt neuer tenantweiter Application-Rechte. Kalender-Updates können Einladungen auslösen; der Bearbeitungsdialog verlangt deshalb eine eigene ausdrückliche Freigabe. Online-Meeting-Texte bleiben bei Updates erhalten.
