# EMA Intelligence – Starten & Testen

## Voraussetzungen

- Node.js 20+ installiert
- Supabase Projekt angelegt (Frankfurt)
- `.env.local` befüllt (siehe `.env.example`)
- SQL Migrations ausgeführt (001 + 003)
- Ein User in Supabase Auth angelegt

---

## Schritt 1 – Dependencies installieren

```bash
cd ema-intelligence
npm install
```

---

## Schritt 2 – .env.local prüfen

```env
NEXT_PUBLIC_SUPABASE_URL=https://DEIN_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EMA Intelligence
```

---

## Schritt 3 – Dev-Server starten

```bash
npm run dev
```

Browser öffnet auf: http://localhost:3000
→ Redirect nach /login (Middleware greift)

---

## Checkliste: Was jetzt funktioniert

### ✅ 1. Login
- http://localhost:3000 → automatisch /login
- E-Mail + Passwort eingeben (Supabase Auth User)
- Bei Fehler: roter Hinweis "E-Mail oder Passwort ist falsch"
- Bei Erfolg: Redirect nach /dashboard

### ✅ 2. Geschützte Routen
- /dashboard ohne Login → Redirect nach /login
- /projects ohne Login  → Redirect nach /login
- Nach Login: alle Routen zugänglich

### ✅ 3. Projektliste (/projects)
- Zeigt "Keine Projekte" wenn leer
- Zeigt Projekte aus Supabase wenn Seed-Daten geladen
- Filter-Tabs (Alle / PV Freifläche / BESS / etc.)
- Suche funktioniert (GET-Parameter)
- Mobile: Cards / Desktop: Tabelle

### ✅ 4. Neues Projekt anlegen (/projects/new)
- 5-Schritt Wizard
- Schritt 1: Projekttyp wählen (PV / BESS / Hybrid / Wind)
- Schritt 2: Allgemeine Daten (Name, Partner, Kontakt, Standort)
- Schritt 3: Technische Daten + Entwicklungsstand (Tri-Toggle)
- Schritt 4: Status & Priorität
- Schritt 5: Speichern
- Nach Speichern: Redirect zur Projektdetailseite
- Projektnummer wird AUTOMATISCH vergeben (PV-2026-001 etc.)

### ✅ 5. Projektdetail (/projects/[id]/overview)
- Header mit Projektnummer, Typ-Badge, Status-Badge, Priorität
- Tab-Navigation: Übersicht / Deal / Dokumente / Investoren / Aktivität
- Bearbeiten-Button → /projects/[id]/edit
- Drei-Punkte-Menü → Archivieren (mit Confirm-Dialog)

### ✅ 6. Deal Economics (/projects/[id]/deal)
- EK-Preis eingeben
- Margentyp wählen (% / €/kWp / €/MWh)
- Kosten erfassen (4 Kategorien)
- Live-Berechnung: Bruttomarge + Nettogewinn
- Sensitivitätstabelle (±10%, ±20%)
- Deal speichern → Activity Log Eintrag

### ✅ 7. Activity Log (/projects/[id]/activity)
- Automatische Einträge bei:
  - Projekt erstellen
  - Status ändern (DB Trigger)
  - Dokument hochladen (DB Trigger)
  - Deal speichern
- Manueller Notiz-Eintrag möglich
- Gruppiert nach Datum (Heute / Gestern / Datum)

---

## Bekannte Einschränkungen (Phase 3)

- Dokument-Upload: Supabase Storage Bucket muss existieren (003_storage_buckets.sql)
- Investor-Tab: zeigt verknüpfte Investoren, Verknüpfung noch manuell via Supabase
- Dashboard KPIs: funktionieren nur wenn v_dashboard_kpis View existiert (aus 001)
- KI-Features: deaktiviert (v1.1)

---

## Häufige Fehler

### "TypeError: Cannot read properties of null"
→ Supabase View `v_projects_with_deals` fehlt → 001_initial_schema.sql ausführen

### "new Row violates row-level security policy"
→ RLS Policy greift → user_id stimmt nicht überein → User korrekt angemeldet?

### Projektnummer fehlt nach Anlage
→ DB Trigger `set_project_number` fehlt → 001_initial_schema.sql vollständig ausführen

### Storage Upload schlägt fehl
→ Bucket `project-documents` fehlt → 003_storage_buckets.sql ausführen

---

## Nächste Phase (nach Freigabe)

Phase 4 implementiert:
- Partner-Modul (CRUD)
- Investoren-Modul (CRUD + Matching)
- Dashboard mit Live-KPIs
- Aufgaben-Modul
