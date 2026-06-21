# EMA Intelligence

**Deal-Management-Plattform für PV-, BESS- und Hybridprojekte**
EMA Enterprise GmbH – Ali Ünlü

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

## Schnellstart

### 1. Voraussetzungen

- Node.js 20+ (`node -v`)
- npm 10+ (`npm -v`)
- Supabase Account (kostenlos): https://supabase.com

### 2. Supabase Projekt anlegen

1. https://supabase.com → New Project
2. Name: `ema-intelligence`
3. Region: **Frankfurt (eu-central-1)** ← DSGVO
4. Nach Erstellung: **Settings → API** → URLs und Keys kopieren

### 3. Datenbank einrichten

Supabase Dashboard → **SQL Editor** → nacheinander ausführen:

```
supabase/migrations/001_initial_schema.sql   ← Kern-Schema (zuerst)
supabase/migrations/003_storage_buckets.sql  ← Storage (danach)
```

Optional für Demo-Daten (erst nach Schritt 5):
```
supabase/migrations/002_seed_data.sql
```

### 4. Environment Variables

```bash
cp .env.example .env.local
```

Dann `.env.local` öffnen und ausfüllen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://DEIN_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EMA Intelligence
```

### 5. User anlegen

Supabase Dashboard → **Authentication → Users → Add user**
- E-Mail: deine E-Mail
- Passwort: sicheres Passwort
- "Create user" klicken

Das Profil wird automatisch via Trigger angelegt.

### 6. Starten

```bash
npm install
npm run dev
```

→ http://localhost:3000 (leitet automatisch auf /login weiter)

---

## Projektstruktur

```
ema-intelligence/
├── src/
│   ├── app/                        Next.js App Router
│   │   ├── layout.tsx              Root Layout
│   │   ├── login/                  Login-Seite
│   │   ├── dashboard/              Dashboard
│   │   ├── projects/               Projektmodul
│   │   │   ├── page.tsx            Projektliste
│   │   │   ├── new/                Neues Projekt (Wizard)
│   │   │   └── [id]/               Projektdetail
│   │   │       ├── layout.tsx      Tab-Navigation
│   │   │       ├── overview/       Übersicht-Tab
│   │   │       ├── deal/           Deal Economics-Tab
│   │   │       ├── documents/      Dokumente-Tab
│   │   │       ├── investors/      Investoren-Tab
│   │   │       ├── activity/       Aktivitäts-Log-Tab
│   │   │       └── edit/           Bearbeiten
│   │   ├── deals/                  Deal-Übersicht
│   │   ├── partners/               Partner
│   │   ├── investors/              Investoren
│   │   ├── tasks/                  Aufgaben
│   │   └── settings/               Einstellungen
│   ├── components/
│   │   ├── layout/                 AppShell, Sidebar, BottomNav, TopHeader
│   │   ├── projects/                ProjectForm, ProjectCard, ActivityFeed, ...
│   │   ├── deals/                  DealForm
│   │   └── ui/                     Badge, EmptyState, ConfirmDialog, ...
│   ├── lib/
│   │   ├── actions/                Server Actions (project, deal, document, auth)
│   │   ├── hooks/                  useAuth
│   │   ├── supabase/               client.ts + server.ts
│   │   ├── types/                  database.types.ts + constants.ts
│   │   └── utils/                  formatCurrency, calculateDeal, cn, ...
│   ├── middleware.ts                Route-Schutz + Session-Refresh
│   └── styles/globals.css          Design Tokens + Tailwind
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_initial_schema.sql  Kern-Schema + Trigger + RLS + Views
│       ├── 002_seed_data.sql       Demo-Daten
│       └── 003_storage_buckets.sql Storage-Konfiguration
├── public/
│   └── manifest.json               PWA-Manifest
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── README.md
└── START.md                        Detaillierte Testanleitung
```

---

## Funktionsumfang (v1.0)

### ✅ Implementiert

- **Auth**: Login/Logout via Supabase Auth, Session-Refresh, Route-Schutz
- **Projekte**: Vollständiges CRUD, 5-Schritt-Wizard, Soft Delete (Archivierung)
- **Projektnummern**: Automatisch generiert (PV-2026-001, BESS-2026-001, HYB-2026-001)
- **Deal Economics**: EK-Preis, Margentypen (% / €/kWp / €/MWh), Live-Berechnung, Sensitivitätstabelle
- **Kosten**: 4 Kategorien (Außenprovision, Reise, Beratung, Sonstiges)
- **Entwicklungsstand**: Tri-State-Checkliste (Ja / Nein / Offen)
- **Dokumente**: Upload via Supabase Storage, Kategorisierung, Download, Soft Delete
- **Activity Log**: Automatisch (Status, Dokumente, Deals) + manuell (Notizen)
- **Navigation**: Desktop Sidebar + Mobile Bottom Nav + FAB
- **Dark Mode**: Vollständig implementiert
- **Mobile First**: iPhone-optimiert mit Safe Area Support
- **PWA-ready**: Manifest vorbereitet
- **UI-Komponenten**: Vollständig handgeschrieben, keine externen UI-Libraries (kein Radix UI) – minimale, kontrollierte Dependency-Liste

### ⏸️ Vorbereitet (v1.1)

- KI-Dokumentenanalyse (Anthropic API)
- Exposé-Generator mit Freigabe-Workflow
- Investoren E-Mail-Generator
- Dashboard Intelligence (NL-Abfragen)

### 🔜 Phase 4 (nach Freigabe)

- Partner-Modul (vollständig)
- Investoren-Modul mit Matching-Score
- Dashboard mit Live-KPIs
- Aufgaben-Modul

---

## Datenbank-Architektur

### Tabellen

| Tabelle | Beschreibung |
|---|---|
| `profiles` | User-Profil (linked zu Supabase Auth) |
| `projects` | Kern-Projektentität |
| `deals` | Financial Layer (EK, Marge, Kosten, Ergebnis) |
| `expenses` | Kostenpositionen pro Deal |
| `external_commissions` | Partnerprovisionen |
| `partners` | Projektpartner |
| `investors` | Investoren mit Suchprofil |
| `project_investors` | Junction: Projekt ↔ Investor |
| `documents` | Datei-Uploads |
| `tasks` | Aufgaben |
| `activity_log` | Immutabler Audit-Trail |
| `ai_outputs` | KI-Outputs (v1.1) |

### Automatische Trigger

- `set_project_number` – Projektnummer beim INSERT
- `trigger_set_updated_at` – updated_at auf allen Tabellen
- `log_project_status_change` – Activity Log bei Statusänderung
- `log_document_upload` – Activity Log bei Dokument-Upload
- `log_investor_linked` – Activity Log bei Investor-Verknüpfung
- `create_profile_on_signup` – Profil bei Auth-Registrierung

### Views

- `v_dashboard_kpis` – Aggregierte KPIs für Dashboard
- `v_projects_with_deals` – Projekte mit aktivem Deal

---

## Deployment (Vercel)

```bash
# Vercel CLI installieren
npm i -g vercel

# Deployen
vercel

# Environment Variables setzen
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_APP_URL
```

Oder via Vercel Dashboard: Settings → Environment Variables

---

## Branding

- **Primärfarbe**: `#1F2A44` (EMA Navy)
- **Sekundärfarbe**: `#5CB800` (Signal Green)
- **Font**: Inter
- **Dark Mode**: Standard (konfigurierbar)

---

## Lizenz

Privat – EMA Enterprise GmbH © 2026
