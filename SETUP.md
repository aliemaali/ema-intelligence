# EMA Intelligence – Setup-Anleitung

## Voraussetzungen

| Tool | Version | Download |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | (kommt mit Node.js) |
| Git | aktuell | https://git-scm.com |
| Supabase CLI | aktuell | `npm i -g supabase` |

---

## Schritt 1 – Supabase Projekt erstellen

1. Gehe zu **https://supabase.com** → "New Project"
2. Name: `ema-intelligence`
3. Password: sicheres Passwort (speichern!)
4. Region: **Frankfurt (eu-central-1)** ← wichtig für DSGVO
5. Plan: Free (reicht für Start)

### API Keys kopieren
Supabase Dashboard → **Settings → API**:
- `Project URL` → später als `NEXT_PUBLIC_SUPABASE_URL`
- `anon / public` Key → später als `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Schritt 2 – Projekt lokal aufsetzen

```bash
# 1. In den Projektordner wechseln
cd ema-intelligence

# 2. Dependencies installieren
npm install

# 3. Environment-Datei erstellen
cp .env.example .env.local
```

### .env.local befüllen:
```env
NEXT_PUBLIC_SUPABASE_URL=https://DEIN_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=DEIN_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=EMA Intelligence
```

---

## Schritt 3 – Datenbank-Migrations ausführen

**Option A: Direkt im Supabase Dashboard (einfachster Weg)**

1. Supabase Dashboard → **SQL Editor**
2. Datei öffnen: `supabase/migrations/001_initial_schema.sql`
3. Gesamten Inhalt kopieren → in SQL Editor einfügen → **Run**
4. Datei öffnen: `supabase/migrations/003_storage_buckets.sql`
5. Gesamten Inhalt kopieren → in SQL Editor einfügen → **Run**

**Option B: Supabase CLI (für Entwickler)**
```bash
# CLI mit deinem Projekt verknüpfen
supabase login
supabase link --project-ref DEIN_PROJECT_ID

# Migrations ausführen
supabase db push
```

### Seed-Daten (optional, für Tests)
Nur wenn du Demo-Daten sehen willst:
1. Zuerst Schritt 4 abschließen (User anlegen)
2. Dann `supabase/migrations/002_seed_data.sql` im SQL Editor ausführen

---

## Schritt 4 – Ersten User anlegen

Da `enable_signup = false` gesetzt ist, muss der User manuell angelegt werden:

1. Supabase Dashboard → **Authentication → Users**
2. Klick: **"Invite user"** oder **"Add user"**
3. E-Mail: `ali@ema-enterprise.de` (oder deine E-Mail)
4. Passwort: sicheres Passwort setzen
5. **"Create user"** klicken

Das Profil (Tabelle `profiles`) wird automatisch via Trigger angelegt.

---

## Schritt 5 – Lokalen Dev-Server starten

```bash
npm run dev
```

→ App läuft auf: **http://localhost:3000**

Der Browser leitet automatisch auf `/login` weiter.
Melde dich mit den Daten aus Schritt 4 an.

---

## Schritt 6 – TypeScript-Typen aus Supabase generieren (optional)

Wenn du die Typen direkt aus der Live-Datenbank generieren möchtest:

```bash
# Supabase CLI muss installiert und eingeloggt sein
npm run db:types
```

Das überschreibt `src/lib/types/supabase.types.ts` mit den aktuellen DB-Typen.
Die manuell erstellte `database.types.ts` bleibt bestehen und ist für den Start ausreichend.

---

## Schritt 7 – Deployment auf Vercel

```bash
# 1. Vercel CLI installieren
npm i -g vercel

# 2. Deployment starten
vercel

# 3. Environment Variables in Vercel setzen:
# vercel env add NEXT_PUBLIC_SUPABASE_URL
# vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# vercel env add NEXT_PUBLIC_APP_URL
```

**Oder via Vercel Dashboard:**
1. https://vercel.com → New Project → Git Repository verbinden
2. Settings → Environment Variables → alle 3 Variablen eintragen
3. Redeploy

---

## Supabase RLS – Kurze Erklärung

Row Level Security ist aktiviert auf **allen Tabellen**.

```sql
-- Beispiel: projects Tabelle
-- User sieht NUR seine eigenen Projekte
CREATE POLICY "projects_owner_all" ON projects
  FOR ALL USING (auth.uid() = user_id);
```

Das bedeutet: Selbst wenn jemand deinen Anon-Key kennt,
kann er keine Daten anderer User sehen. ✓

---

## Häufige Fehler

### "relation 'profiles' does not exist"
→ Migration 001 wurde noch nicht ausgeführt. Schritt 3 wiederholen.

### "Invalid login credentials"
→ User wurde nicht korrekt in Supabase Auth angelegt. Schritt 4 prüfen.

### "NEXT_PUBLIC_SUPABASE_URL is not defined"
→ `.env.local` fehlt oder wurde nicht befüllt. Schritt 2 prüfen.
→ Danach `npm run dev` neu starten (Env-Variablen werden beim Start eingelesen).

### Storage-Bucket fehlt
→ Migration 003 wurde nicht ausgeführt. Im SQL Editor nachholen.

---

## Projektstruktur auf einen Blick

```
ema-intelligence/
├── src/
│   ├── app/                    Next.js App Router
│   │   ├── layout.tsx          Root Layout (Fonts, Themes, Auth)
│   │   ├── login/page.tsx      Login-Seite
│   │   ├── dashboard/          Dashboard + Layout
│   │   ├── projects/           Projekte + Layout (nächster Schritt)
│   │   ├── deals/              Deals
│   │   ├── partners/           Partner
│   │   ├── investors/          Investoren
│   │   ├── tasks/              Aufgaben
│   │   └── settings/           Einstellungen
│   ├── components/
│   │   └── layout/             AppShell, Sidebar, BottomNav, TopHeader
│   ├── lib/
│   │   ├── supabase/           client.ts + server.ts
│   │   ├── types/              database.types.ts + constants.ts
│   │   ├── utils/              formatCurrency, calculateDeal, etc.
│   │   ├── hooks/              useAuth.ts
│   │   └── actions/            auth.actions.ts (Server Actions)
│   ├── middleware.ts            Route Guard + Session Refresh
│   └── styles/globals.css      Design Tokens + Tailwind
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_initial_schema.sql    ← Kern-Schema
│       ├── 002_seed_data.sql         ← Demo-Daten
│       └── 003_storage_buckets.sql   ← Storage
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Nächste Schritte nach Setup

Nach deiner Freigabe implementiere ich:

**Schritt 3 – Projekt CRUD:**
- Neue Projekte anlegen (Wizard)
- Projektliste mit Filter & Suche
- Projektdetail-Seite mit allen Tabs
- Automatische Projektnummer via DB-Funktion

**Schritt 4 – Deal Economics:**
- DealForm mit Live-Berechnung
- Sensitivitätstabelle
- Kosten-Eingabe

**Schritt 5 – Partner & Investoren**

**Schritt 6 – Dokumente & Aktivitäts-Log**
