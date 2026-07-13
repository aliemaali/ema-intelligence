# EMA Intelligence

**Deal-Management-Plattform für PV-, BESS- und Hybridprojekte**  
EMA Enterprise GmbH – Ali Ünlüer

---

## Tech Stack

| Tool | Version |
|---|---|
| Next.js | 14.2.5 |
| React | 18.3 |
| TypeScript | 5.5 |
| Tailwind CSS | 3.4 |
| Supabase | 2.44 (Auth + DB + Storage) |
| Deployment | Vercel |

---

## EMA Scout

EMA Scout ist der digitale Akquise-Arbeitsbereich von EMA Intelligence.

Aktueller Funktionsumfang:

- Aufträge für Projekt- und Dachflächenakquise anlegen
- Jobstatus, Fortschritt und Live-Protokoll verfolgen
- große Gewerbe- und Industriegebäude kostenfrei über OpenStreetMap/Nominatim/Overpass recherchieren
- Gebäudefläche und grobes PV-Potenzial schätzen
- Dubletten anhand der OSM-Quelle verhindern
- Treffer als Dachflächen-Leads im Akquise-Center speichern
- vorbereitete E-Mails separat freigeben

Wichtig: OSM-Daten sind eine Recherchegrundlage. Eigentümerstatus, Ansprechpartner, vorhandene PV-Anlage, Statik und technische Eignung müssen vor einer Kontaktaufnahme geprüft werden.

Vor der Aktivierung müssen folgende Migrationen im Supabase SQL Editor ausgeführt werden:

```text
supabase/migrations/010_acquisition_agent.sql
supabase/migrations/011_agent_job_engine.sql
```

---

## Schnellstart

### 1. Voraussetzungen

- Node.js 20+
- npm 10+
- Supabase Account

### 2. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://DEIN_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EMA Intelligence
```

### 3. Starten

```bash
npm install
npm run dev
```

---

## Branding

- Primärfarbe: `#1F2A44`
- Sekundärfarbe: `#5CB800`
- Font: Inter

---

Privat – EMA Enterprise GmbH © 2026