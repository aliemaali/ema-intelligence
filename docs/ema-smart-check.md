# EMA Smart Check – Architektur und Vorschau

Stand: 26.10.2026. Grundworkflow auf Benutzerfreigabe produktiv. Neue Bedienung im Entwicklungszweig `codex/smart-check-photo-first`, zunächst als Vorschau. Keine automatischen KI-Aufträge.

## Geprüfter Bestand

| System | Tatsächlicher Stand | Wiederverwendung |
| --- | --- | --- |
| EMA Intelligence | Next.js 15, React 18, Supabase SSR | Startkachel, Arbeitsbereich und API |
| Datenbank | Supabase-Projekt `sbtwyfuxwzsudxcucyyv`, EU West | Projekte, Benutzerprofile, Dokumente und Ordner |
| DMS | Privater Bucket `ema-dms`, 50 MB Bucketlimit, Benutzerpfade und RLS | Originale und versionierte PDF-Berichte; zusätzlich 3 MB je Prüfdatei |
| EMA Office | Next.js 16, Auth.js, Prisma, eigenes Vercel-Projekt | Bestehende Berechtigungen, Kunden, Angebotsentwürfe und AuditEvent |
| Office Preview DB | Separates Supabase-Projekt in Frankfurt | Keine produktive Schemaänderung erforderlich |
| KI | Bestehende OpenAI-Integration | Bestehenden API-Schlüssel verwenden; ausdrückliche Zustimmung je Analyse. `SMART_CHECK_AI_ENABLED=false` sperrt die KI administrativ |

Die Startseite von Intelligence ist `/apps`, Smart Check liegt unter `/smart-check`. Office liegt auf `office.ema-enterprise.de`; Intelligence auf `app.ema-enterprise.de`. Die bestehenden `/office`-Rewrites ersetzen keine gemeinsame Anmeldung. In der Vercel-Vorschau führt die Angebotsübergabe explizit zur geprüften Office-Vorschau desselben Entwicklungszweigs; die bestehenden produktiven Rewrites bleiben unverändert. Office erfordert weiterhin seine eigene Anmeldung.

## Datenmodell und Schnittstellen

Keine neuen Tabellen und keine Datenmigration. Jeder Datensatz gehört dem angemeldeten Benutzer; ein vorhandenes Projekt darf nur nach expliziter Eigentümerprüfung zugeordnet werden. Firmenrollen in Office bleiben getrennt von Supabase-Profilrollen in Intelligence.

- Original: `documents`, `source_record_id=smart-check-asset:<uuid>`, SHA-256, privater Pfad `<user>/smart-check/assets/...`.
- Bericht: `documents`, `source_record_id=smart-check:...`, `parent_id` zur Vorversion, `version`, `analysis_status` und strukturierte `ai_extracted_data` mit Eingaben, Befunden, Quellen und Originalreferenzen.
- `GET /api/smart-check`: eigene Projekte, Ordner, Berichte; mit `id` einen gespeicherten Bericht lesen.
- `POST /api/smart-check/upload`: Anmeldung, MFA, interner Zugang, Origin, Projekt/Ordner, Inhaltssignatur und Größenlimit prüfen.
- `POST /api/smart-check/analyze`: expliziter Prüfauftrag, Eingabevalidierung, Originalrechte/Hashprüfung, optional freigegebene Bildanalyse, Regelprüfung und PDF-Ablage.
- Öffnen erfolgt über den vorhandenen DMS-Endpunkt mit Eigentümerprüfung und befristeter signierter URL.
- Office `/vertrieb/smart-check`: Maßnahmen als unvertrauten Eingabeentwurf validieren, Kundenrechte und Preise prüfen; erst bei Speichern DRAFT samt AuditEvent erstellen. Keine automatische Freigabe oder Versendung.

## Fachliche Grenzen dieser Vorschau

Die fünf Prüfbereiche und der vollständige Grundablauf sind angelegt. Unbekannte Daten bleiben unbekannt; Heizleistung, elektrische Aufnahme, Zusatzheizung, Speicherkapazität und Ladeleistung sind getrennt. Konkreter Sicherheitsverdacht erhält Rot; fehlende Nachweise Grau, einzelne Anpassungsprüfungen Gelb. Grün wird derzeit nicht automatisch vergeben, weil eine unabhängige projektbezogene Regelwerks- und Nachweisprüfung noch fehlt.

**Noch keine vollständige Netzbetreiber-Engine:** keine adressgenaue automatische VNB-Zuordnung, keine vollständige Gültigkeitskontrolle sämtlicher TAB, keine lizenzierte DIN-VDE-Datenbank, keine automatisch belastbare Kompatibilitätsberechnung. Bei jedem ausdrücklichen Prüfauftrag wird die offizielle Einstiegsseite aus einer festen Betreiberliste mit Zeit-/Größenlimit und ohne Weiterleitungen abgerufen. Passende Links werden nur auf derselben HTTPS-Domain übernommen; Zeitstempel, Seitenhash und Links werden im Bericht festgehalten, der Seitentext wird nicht gespeichert. Ein fehlgeschlagener Abruf wird ausdrücklich dokumentiert. Dies ist Quellenrecherche, keine inhaltliche Gültigkeitsbestätigung. Die UI erlaubt VNB-Bestätigung mit Beleg, dokumentiert öffentliche Quellen und manuelle Fassungs-/Fundstellenangaben, weist aber jede lokale Prüfung als eingeschränkt aus. Andere Betreiber erhalten keine erfundenen lokalen Anforderungen.

Die EWR-Veröffentlichungsseite und ihre TAB 2023 v2.0 inklusive Ergänzungen (Stand 01.09.2025) wurden am 26.10.2026 eingesehen. Die VDE-FNN-Seite nennt VDE-AR-N 4100:2026-04; daraus folgt keine automatische Anwendbarkeit aller Einzelanforderungen auf den Bestand. Quellen werden als bibliografischer Einstieg gespeichert, keine vollständigen geschützten Normtexte.

Die neue Oberfläche zeigt erkannte Komponenten, fehlende Nachweise, nächste Schritte und Quellen direkt. Der frühere einfache Berichtsfrage-Button wurde entfernt; ein freier Fachdialog und globale Suche sind noch nicht implementiert. DMS-Historie und erneute Prüfung sind vorhanden. Vor einer allgemeinen Elektrofachplaner-Aussage sind verifizierte Regelpakete und Fachabnahme nötig.

## Sicherheit und Datenschutz

Anmeldung, aktives internes Profil, eingeschriebene MFA, benutzergebundene RLS, private Ablage, keine Service-Role für Benutzeraktionen. Bilder werden im Browser verkleinert und neu als JPEG kodiert; Server prüft MIME, Signatur, Pixel- und Dateigröße. PDFs mit erkennbaren aktiven Inhalten werden abgewiesen. Diese Inhaltsprüfung ersetzt keinen professionellen Malware-Scanner; komprimierte/verschleierte aktive PDF-Inhalte und Parser-Schwachstellen bleiben ein Produktionsprüfpunkt.

Uploads sind ausschließlich Daten für die KI; ihre Anweisungen erhalten keine Systemrechte. Keine Werkzeuge oder Codeausführung durch die Bildanalyse. Keine Anleitung für Arbeiten unter Spannung. Berichte sind mit Eingaben und Zeitständen versioniert; ein manipulationsgeschütztes Audit aller Intelligence-Änderungen fehlt noch. Vor Kundendatenbetrieb sind Auftragsverarbeitung, Rechtsgrundlage, Datenminimierung, Löschfristen und Drittlandübertragung anhand der tatsächlichen Verträge zu prüfen; der Code allein belegt keine DSGVO-Konformität.

## Kosten und Freigaben

| Funktion | Zusätzlicher Fixvertrag | Variable Kosten |
| --- | --- | --- |
| Strukturierte Regelprüfung | keiner | vorhandene Hosting-/DB-Kontingente |
| Originale und PDF-Berichte | keiner | bestehendes Storage-/Traffic-Kontingent, Mehrverbrauch möglich |
| KI-Bildanalyse | keiner neu vorgesehen | bestehende OpenAI-API, ausschließlich nach Einzelauftrags-Zustimmung |
| Vollständige Normprüfung | offen | gegebenenfalls notwendige Normlizenzen |

Kein neues SaaS und keine neue kostenpflichtige Buchung. Kein Versprechen dauerhaft kostenloser Fotoanalyse. Ein ChatGPT-Abonnement ist kein Nachweis bezahlter API-Nutzung. Der vorhandene KI-Pfad dokumentiert Input/Output und einen unverbindlichen Modelllistenpreis; Preis und Modellverfügbarkeit müssen bei Änderung erneut geprüft werden; Modell-Snapshot, Bildunterstützung und Listenpreise wurden am 26.10.2026 mit der offiziellen Modelldokumentation abgeglichen. Grenzen: maximal 8 Dateien, 3 MB je Datei, 20 KI-Aufträge/Tag und 100/Monat pro Benutzer. Diese Auftragslimits sind keine harte Euro-Budgetgrenze; vor Freigabe zusätzliche Provider-Budgetkontrolle vorsehen.

## Validierung und Einführung

Automatisierte Tests decken fehlende/mehrdeutige VNB, thermische gegen elektrische Leistung, PV/Speicher/Wallbox, unzureichende Nachweise, Sicherheitsverdacht, unzulässige Eingaben, gesperrte Benutzer, MFA, fremde Projekte und Dateigrenzen ab. PDF-Layout und Mehrseitenberichte zusätzlich rendern. Typprüfung und Vercel-Vorschaubuild getrennt nachweisen.

Nicht durch Unit-Tests belegt: echte iPhone-Kamera/HEIC auf Hardware, vollständiger angemeldeter DMS-Roundtrip, Mandantenübergang in Office und kostenpflichtige Fotoanalyse. Diese Tests bleiben ausdrücklich offen, solange keine passende Testsitzung bzw. Kostenfreigabe vorliegt. Produktiv-Merge, Produktionsbereitstellung, Schema-/Policyänderungen und KI-Aktivierung erfolgen erst nach Benutzerfreigabe.

## Neuer Fotoablauf

Start direkt mit Kamera oder Dateiauswahl; noch keine Projektdaten- oder Technikformulare. Aufnahmen werden lokal vorbereitet, verkleinert und als Vorschau angezeigt. Erst ein ausdrücklicher Prüfauftrag lädt sie ins private DMS. Danach folgen Prüfbereich, kurze Frage und Netzbetreiber; zusätzliche Leistungsangaben bleiben eingeklappt und optional. Eine fehlgeschlagene Teilübertragung behält bereits gespeicherte Datei-IDs, damit ein erneuter Versuch diese Originale nicht doppelt hochlädt.

Die vorhandene API wird ohne neuen Dienst genutzt. Das Backend validiert weiterhin `mode=ai` und `aiConsent=true`, Schlüsselverfügbarkeit, Anmeldung und Auftragslimits. Die Nutzeroberfläche verlangt für jeden KI-Auftrag eine neue Zustimmung; der neue Ablauf setzt sie nach einem Ergebnis zurück. Keine KI-Aufrufe beim Öffnen, bei der Fotoauswahl oder bei den automatisierten Tests. Der Unterlagen-Check ohne KI bleibt als klar benannte Alternative verfügbar.

Validierung: 16 automatisierte Tests inklusive simuliertem Provider-Ergebnis, fehlender Zustimmung, administrativer Deaktivierung, fehlendem Schlüssel und Providerfehler; keine reale kostenpflichtige Modellanfrage für diese Tests. Einstieg serverseitig gerendert; Typprüfung und Vercel-Vorschau separat. Echte Kamera und vollständige angemeldete Bildanalyse bleiben vom Benutzer zu testen.
