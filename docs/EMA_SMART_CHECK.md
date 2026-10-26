# EMA Smart Check – Architektur und Betrieb

Stand: 26.10.2026. Produktivfreigabe durch Benutzer nach dem genehmigten Bildentwurf.

## Bestehende Infrastruktur

- Intelligence: Next.js 15.5, React 18, Vercel; Supabase Auth mit bestehendem MFA, Profilen und Projektbesitz. Interne Nutzer, keine Partnerkonten.
- DMS: private vorhandene `ema-dms`-Ablage, Eigentümerpfad, `documents` als zentrale Akte. Kein zusätzlicher Storage-Dienst und keine Schemaänderung erforderlich.
- PDF: vorhandenes jsPDF. Serverseitiger Bericht mit Schrift-/Seitenumbruch, Quellen und zugeordneten Aufnahmen.
- Office: eigenständige Next.js-/Prisma-/Neon-Anwendung. Nutzer und Firmenrechte bleiben getrennt. Übergabe enthält untrusted Maßnahmenentwurf; erst nach Firmen-/Kundenprüfung und Preiseingabe wird ein DRAFT gespeichert. Keine automatische Freigabe oder Versendung.
- KI: vorhandener OpenAI-Schlüssel ausschließlich serverseitig. Keine neuen SDKs, Gateways oder Abonnements. Es wurde für Entwicklungstests kein kostenpflichtiger Modellaufruf gestartet.

## Ablauf und Speicherung

1. Projekt/Adresse/Prüfbereich wählen, optional vorhandenes eigenes Projekt und DMS-Ordner.
2. Bis 8 Originale; einzelne Uploads maximal 3 MB. Kameraaufnahmen werden im Browser auf maximal 1800 Pixel lange Kante reduziert und ohne EXIF neu kodiert. Server prüft Eigentum, MIME, Signatur und Bildabmessungen. PDF-Aktivaktionen werden abgewiesen; dies ist kein vollständiger Virenscanner.
3. Netzbetreiber und Adressnachweis bestätigen. Es erfolgt keine sichere Netzbetreiberermittlung allein aus der PLZ. Offizielle Einstiegsquellen stehen für die vorgesehenen Betreiber zur Verfügung; für andere Betreiber können eigene Angaben erfasst werden.
4. Regelprüfung oder separat beauftragte KI. Keine automatische Analyse beim Hochladen/Öffnen. KI liest Bilder und maximal 5 PDF-Textseiten bzw. 6000 Zeichen je PDF; gescannte/unlesbare PDFs bleiben explizit unbeurteilt. Uploadinhalt ist niemals eine Systemanweisung. Das Modell hat keine Werkzeuge und keinen Netz-/Dateizugriff außerhalb der explizit bereitgestellten Daten.
5. Bericht wird privat in DMS registriert. `ai_extracted_data.kind=ema-smart-check` enthält input, result, attachment references, checkId und Modus. Eigener Dokumentdatensatz pro Revision mit `parent_id` und `version`. Zwischenzustände processing/completed/failed und Zeitstempel dokumentieren den Auftrag. Die DMS-Historie ist keine manipulationssichere qualifizierte Prüfakte.

## Sicherheitsgrenzen

Alle APIs prüfen Supabase getUser, aktive interne Profile, erforderliches MFA und RLS. Projekt- und Ordnerzuordnung werden explizit gegen user_id geprüft. Jede Anlage wird erneut aus eigenen DMS-Datensätzen geladen, Hash und Dateityp werden kontrolliert. POST verlangt gleiche Origin. Keine öffentlichen Kundenbilder, keine Service-Role im Browser. Datenübertragung an bestehende OpenAI-API erfolgt nur mit expliziter Zustimmung pro Auftrag; vorhandene AVV-/Kontoeinstellungen und Datenminimierung sind vor personenbezogener Nutzung zu prüfen. Es wird keine pauschale DSGVO-Zertifizierung behauptet.

## Bewertung und Quellen

Deterministische Regeln dürfen KI-Ausgaben nicht in eine Sicherheitsfreigabe umdeuten. Kein grüner Gesamtstatus ohne belastbare Norm-/Messprüfung; die erste Version erteilt keine grüne Gesamtfreigabe. Nicht sichtbare Komponenten sind unbekannt, nicht bewiesen fehlend. Sicherheitsverdachte werden als Verdacht mit Beleg gekennzeichnet. Heizleistung wird nicht als elektrische Aufnahme verwendet. Speicher-kWh sind nicht Lade-kW.

Öffentliche offizielle Quellen wurden am 26.10.2026 geprüft: VDE-AR-N 4100:2026-04, VDE-AR-N 4105:2026-03, BNetzA-Information zu §14a und Betreiberunterlagen (EWR TAB 2023 v2.0 Stand 01.09.2025). Die vollständigen Normtexte werden nicht gespeichert. Keine Live-Normdatenbank oder zugesicherte automatische Aktualitätskontrolle. Lokale Fassung, Übergänge, Messkonzept und konkrete Nachrüstung bleiben projektbezogen nachzuweisen. Eine Auswahl/Bestätigung ersetzt diese Prüfung nicht.

## Kosten

Regelprüfung: kein KI-API-Aufruf, bestehende Hosting-/Speicherquoten gelten. Keine neu bestellten monatlichen Fixkosten.

Optionale KI: GPT-5.4 mini Snapshot 2026-03-17, Listenpreis 0,75 USD je Mio. Input- und 4,50 USD je Mio. Output-Tokens, Stand 26.10.2026. Maximal 3500 Ausgabetokens, maximal 8 Dateien je Auftrag. Bilder zählen als Input. Ein Auftrag pro Benutzer/Minute, höchstens 20 pro UTC-Tag und 100 pro UTC-Monat. Verbrauch wird im Bericht angezeigt; die Rechnung des API-Anbieters ist maßgeblich. Ein festes monatliches Eurobudget oder kostenfreie dauerhafte Fotoanalyse wird nicht zugesagt. Nach fehlgeschlagenen KI-Aufrufen wird nicht automatisch kostenpflichtig wiederholt.

## Validierung / Erweiterungen

Deterministische Tests decken Foto-/Normgrenzen, Heizleistung, mehrere Energietechnologien, Operatornachweise, Gefahrenpriorität, Einwilligung, Authentifizierung/MFA, Projekt-/Ordnerrechte, Dateityp/Größe und Origin ab. PDF wird mit Testdaten gerendert. Vercel-Build prüft TypeScript und Paketverträglichkeit vor Produktion. Physische iPhone-Kamera, reale Benutzeranmeldung und bezahlte Modellaufrufe können nicht als erfolgreich getestet ausgegeben werden, solange kein tatsächlich erfolgreicher Gerätetest/Autorisierungsfluss vorliegt.

Nächste Fachausbaustufen: adressgenaue Betreiberabfrage mit verlässlicher Datenquelle, versioniertes Regelwerksregister mit automatischer Änderungsüberwachung, lizenzierter Normzugriff, Messwertimport und fachliche Freigabe durch benannte Elektrofachkraft. Keine automatische kostenpflichtige Einführung.
