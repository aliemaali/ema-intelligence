-- ============================================================
-- EMA Intelligence – Initial Schema Migration
-- Version: 1.0.0
-- ============================================================
-- Run this in your Supabase SQL Editor or via Supabase CLI:
-- supabase db push
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE project_type AS ENUM (
  'pv_freiflaeche',
  'pv_dach',
  'bess',
  'hybrid',
  'wind'
);

CREATE TYPE project_status AS ENUM (
  'lead',
  'vorpruefung',
  'investorensuche',
  'dd',
  'loi',
  'spa',
  'closing',
  'verkauft',
  'abgelehnt'
);

CREATE TYPE project_priority AS ENUM (
  'hoch',
  'mittel',
  'niedrig'
);

CREATE TYPE marketing_status AS ENUM (
  'nicht_gestartet',
  'in_vermarktung',
  'an_investoren_versendet',
  'dd_laeuft',
  'loi_erhalten',
  'exklusiv_reserviert',
  'verkauft'
);

CREATE TYPE margin_type AS ENUM (
  'percent',
  'per_kwp',
  'per_mwh'
);

CREATE TYPE deal_status AS ENUM (
  'open',
  'negotiating',
  'closed_won',
  'closed_lost'
);

CREATE TYPE document_type AS ENUM (
  'expose',
  'lageplan',
  'netzanschluss',
  'pachtvertrag',
  'genehmigung',
  'gutachten',
  'bild',
  'nda',
  'loi',
  'spa',
  'sonstiges'
);

CREATE TYPE task_priority AS ENUM (
  'hoch',
  'mittel',
  'niedrig'
);

CREATE TYPE task_status AS ENUM (
  'offen',
  'in_bearbeitung',
  'erledigt'
);

CREATE TYPE activity_type AS ENUM (
  'status_change',
  'document_upload',
  'investor_contact',
  'note_added',
  'email_sent',
  'deal_update',
  'task_created',
  'partner_linked',
  'investor_linked',
  'manual'
);

CREATE TYPE commission_status AS ENUM (
  'offen',
  'faellig',
  'bezahlt'
);

CREATE TYPE investor_size_preference AS ENUM (
  'size_1_10mw',
  'size_10_50mw',
  'size_50_250mw',
  'size_250plus'
);


-- ============================================================
-- TABLE: profiles
-- Extends Supabase Auth users
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT 'Ali Ünlü',
  company       TEXT NOT NULL DEFAULT 'EMA Enterprise GmbH',
  role          TEXT NOT NULL DEFAULT 'admin',
  avatar_url    TEXT,
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'Extended user profile linked to Supabase Auth. Single-user setup for EMA Enterprise.';


-- ============================================================
-- TABLE: partners
-- Project partners / Lieferanten
-- ============================================================
CREATE TABLE partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Contact
  full_name       TEXT NOT NULL,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  location_city   TEXT,
  location_state  TEXT,
  notes           TEXT,

  -- Statistics (auto-calculated via triggers)
  project_count   INTEGER NOT NULL DEFAULT 0,
  deal_count      INTEGER NOT NULL DEFAULT 0,
  close_rate      NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_volume    NUMERIC(14,2) NOT NULL DEFAULT 0,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE partners IS 'Project partners who source or co-develop projects.';


-- ============================================================
-- TABLE: investors
-- ============================================================
CREATE TABLE investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Contact
  full_name       TEXT NOT NULL,
  company         TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  location_city   TEXT,
  location_country TEXT DEFAULT 'Deutschland',

  -- Investment Profile
  interest_pv     BOOLEAN NOT NULL DEFAULT FALSE,
  interest_bess   BOOLEAN NOT NULL DEFAULT FALSE,
  interest_hybrid BOOLEAN NOT NULL DEFAULT FALSE,
  interest_wind   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Size preferences (stored as JSONB for flexibility)
  size_preferences JSONB DEFAULT '[]'::JSONB,

  -- Investment type
  investment_type TEXT, -- 'equity' | 'debt' | 'both'

  -- Minimum / Maximum ticket size
  min_ticket_eur  NUMERIC(14,2),
  max_ticket_eur  NUMERIC(14,2),

  dd_ready        BOOLEAN NOT NULL DEFAULT FALSE,
  last_contact    TIMESTAMPTZ,
  notes           TEXT,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE investors IS 'Investor contacts with investment profiles and size preferences.';


-- ============================================================
-- SEQUENCE: project number counters per type per year
-- ============================================================
CREATE TABLE project_number_sequences (
  project_type  TEXT NOT NULL,
  year          INTEGER NOT NULL,
  last_number   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_type, year)
);

COMMENT ON TABLE project_number_sequences IS 'Tracks auto-increment counters for project numbers per type per year.';


-- ============================================================
-- FUNCTION: generate_project_number
-- Returns e.g. PV-2026-001, BESS-2026-014, HYB-2026-003
-- ============================================================
CREATE OR REPLACE FUNCTION generate_project_number(p_type project_type)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix    TEXT;
  v_year      INTEGER;
  v_next_num  INTEGER;
  v_number    TEXT;
BEGIN
  -- Determine prefix
  CASE p_type
    WHEN 'pv_freiflaeche' THEN v_prefix := 'PV';
    WHEN 'pv_dach'        THEN v_prefix := 'PV';
    WHEN 'bess'           THEN v_prefix := 'BESS';
    WHEN 'hybrid'         THEN v_prefix := 'HYB';
    WHEN 'wind'           THEN v_prefix := 'WIND';
    ELSE v_prefix := 'PROJ';
  END CASE;

  v_year := EXTRACT(YEAR FROM NOW())::INTEGER;

  -- Upsert the sequence counter (atomic)
  INSERT INTO project_number_sequences (project_type, year, last_number)
  VALUES (v_prefix, v_year, 1)
  ON CONFLICT (project_type, year)
  DO UPDATE SET last_number = project_number_sequences.last_number + 1
  RETURNING last_number INTO v_next_num;

  -- Format: PREFIX-YYYY-NNN
  v_number := v_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next_num::TEXT, 3, '0');

  RETURN v_number;
END;
$$;


-- ============================================================
-- TABLE: projects
-- Core project entity
-- ============================================================
CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id        UUID REFERENCES partners(id) ON DELETE SET NULL,

  -- Auto-generated on INSERT via trigger
  project_number    TEXT UNIQUE NOT NULL,
  project_name      TEXT NOT NULL,
  project_type      project_type NOT NULL,

  -- Status & Classification
  status            project_status NOT NULL DEFAULT 'lead',
  priority          project_priority NOT NULL DEFAULT 'mittel',
  marketing_status  marketing_status NOT NULL DEFAULT 'nicht_gestartet',

  -- Contact at Partner
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,

  -- Location
  location_address  TEXT,
  location_city     TEXT,
  location_state    TEXT,
  location_country  TEXT NOT NULL DEFAULT 'Deutschland',
  location_lat      NUMERIC(10,7),
  location_lng      NUMERIC(10,7),

  -- Technical Data: PV
  pv_mwp            NUMERIC(10,3),  -- MWp
  pv_ac_mw          NUMERIC(10,3),  -- AC Leistung MW

  -- Technical Data: BESS
  bess_mw           NUMERIC(10,3),  -- Power MW
  bess_mwh          NUMERIC(10,3),  -- Energy MWh
  bess_duration_h   NUMERIC(5,2),   -- Duration hours

  -- Hybrid config (flexible)
  hybrid_config     JSONB,

  -- Development Status Checklist (JSONB for flexibility)
  -- e.g. { "netzanschluss": true, "baugenehmigung": false, "pachtvertrag": true, "eeg": true, "gutachten": false }
  dev_status        JSONB NOT NULL DEFAULT '{
    "netzanschluss": null,
    "baugenehmigung": null,
    "pachtvertrag": null,
    "eeg_faehigkeit": null,
    "gutachten": null,
    "umweltpruefung": null
  }'::JSONB,

  -- AI fields (prepared for v1.1)
  ai_score          INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  ai_score_details  JSONB,
  ai_last_analyzed  TIMESTAMPTZ,

  -- Meta
  notes             TEXT,
  tags              TEXT[] DEFAULT '{}',
  last_activity_at  TIMESTAMPTZ DEFAULT NOW(),

  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE projects IS 'Core project entity. Project number is auto-generated on insert.';
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(project_type);
CREATE INDEX idx_projects_partner_id ON projects(partner_id);
CREATE INDEX idx_projects_last_activity ON projects(last_activity_at DESC);


-- ============================================================
-- TRIGGER: auto-generate project_number on INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_project_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.project_number := generate_project_number(NEW.project_type);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_project_number
  BEFORE INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.project_number IS NULL OR NEW.project_number = '')
  EXECUTE FUNCTION trigger_set_project_number();


-- ============================================================
-- TABLE: deals
-- Financial layer - separated from project entity
-- ============================================================
CREATE TABLE deals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Which investor this deal is with (optional)
  investor_id       UUID REFERENCES investors(id) ON DELETE SET NULL,

  -- Deal tracking
  deal_number       TEXT UNIQUE NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE, -- Only 1 active deal per project at a time
  deal_status       deal_status NOT NULL DEFAULT 'open',

  -- Purchase price
  purchase_price    NUMERIC(14,2),     -- € total
  purchase_per_kwp  NUMERIC(10,2),     -- €/kWp (entered OR auto-calc from total/mwp)
  purchase_per_mwh  NUMERIC(10,2),     -- €/MWh (for BESS)

  -- Margin configuration
  margin_type       margin_type NOT NULL DEFAULT 'percent',
  margin_value      NUMERIC(10,4),     -- % or €/kWp or €/MWh
  margin_eur        NUMERIC(14,2),     -- Calculated

  -- Calculated sale price
  sales_price       NUMERIC(14,2),     -- Calculated

  -- Results (all calculated, stored for performance)
  gross_margin      NUMERIC(14,2),     -- = margin_eur
  gross_margin_pct  NUMERIC(7,4),      -- % of purchase_price
  net_profit        NUMERIC(14,2),     -- gross_margin - total_costs
  net_profit_pct    NUMERIC(7,4),      -- % of purchase_price

  -- Key dates
  offer_date        DATE,
  loi_date          DATE,
  spa_date          DATE,
  closing_date      DATE,

  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deals IS 'Financial deal layer. One project can have multiple deal attempts (only one active at a time).';
CREATE INDEX idx_deals_project_id ON deals(project_id);
CREATE INDEX idx_deals_investor_id ON deals(investor_id);
CREATE INDEX idx_deals_status ON deals(deal_status);

-- Enforce only 1 active deal per project
CREATE UNIQUE INDEX idx_deals_one_active_per_project
  ON deals(project_id)
  WHERE is_active = TRUE;


-- ============================================================
-- TABLE: expenses
-- Costs linked to a deal
-- ============================================================
CREATE TABLE expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  category          TEXT NOT NULL, -- 'aussenprovision' | 'reise' | 'beratung' | 'sonstiges'
  description       TEXT,
  amount_eur        NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_incurred     DATE,
  is_confirmed      BOOLEAN NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expenses IS 'Deal-related costs (commissions, travel, consulting, misc).';
CREATE INDEX idx_expenses_deal_id ON expenses(deal_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);


-- ============================================================
-- TABLE: external_commissions
-- Partner commissions separate from general expenses
-- ============================================================
CREATE TABLE external_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  partner_id        UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  commission_type   TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  commission_value  NUMERIC(10,4) NOT NULL,           -- % or €
  commission_eur    NUMERIC(12,2),                    -- Calculated/confirmed amount

  status            commission_status NOT NULL DEFAULT 'offen',
  due_date          DATE,
  paid_date         DATE,
  invoice_number    TEXT,
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE external_commissions IS 'Partner commission agreements and payment tracking.';
CREATE INDEX idx_commissions_project_id ON external_commissions(project_id);
CREATE INDEX idx_commissions_partner_id ON external_commissions(partner_id);
CREATE INDEX idx_commissions_status ON external_commissions(status);


-- ============================================================
-- JUNCTION: project_investors
-- Which investors are contacted/interested in which projects
-- ============================================================
CREATE TABLE project_investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  investor_id     UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  status          TEXT NOT NULL DEFAULT 'kontaktiert',
  -- 'kontaktiert' | 'interesse' | 'dd' | 'loi' | 'abgelehnt' | 'reserviert'

  teaser_sent_at  TIMESTAMPTZ,
  expose_sent_at  TIMESTAMPTZ,
  dd_started_at   TIMESTAMPTZ,
  loi_received_at TIMESTAMPTZ,

  match_score     INTEGER CHECK (match_score BETWEEN 0 AND 100),
  notes           TEXT,

  contacted_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(project_id, investor_id)
);

COMMENT ON TABLE project_investors IS 'Junction: tracks which investors are engaged with which projects.';
CREATE INDEX idx_project_investors_project_id ON project_investors(project_id);
CREATE INDEX idx_project_investors_investor_id ON project_investors(investor_id);


-- ============================================================
-- TABLE: documents
-- File uploads per project
-- ============================================================
CREATE TABLE documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  document_type     document_type NOT NULL DEFAULT 'sonstiges',
  display_name      TEXT NOT NULL,       -- User-facing label
  file_name         TEXT NOT NULL,       -- Original filename
  file_path         TEXT NOT NULL,       -- Supabase Storage path
  file_size_bytes   BIGINT,
  mime_type         TEXT,

  -- External link (Google Drive, etc.)
  external_url      TEXT,
  external_provider TEXT,               -- 'google_drive' | 'dropbox' | etc.

  -- Version control
  version           INTEGER NOT NULL DEFAULT 1,
  parent_id         UUID REFERENCES documents(id) ON DELETE SET NULL,

  -- AI Analysis (prepared for v1.1, not active in v1.0)
  ai_analyzed       BOOLEAN NOT NULL DEFAULT FALSE,
  ai_extracted_data JSONB,
  ai_analyzed_at    TIMESTAMPTZ,

  notes             TEXT,
  is_archived       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Project documents. Supports Supabase Storage and external URLs.';
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_type ON documents(document_type);


-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL, -- Optional link

  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  priority        task_priority NOT NULL DEFAULT 'mittel',
  status          task_status NOT NULL DEFAULT 'offen',

  -- Optional: link to investor or partner
  investor_id     UUID REFERENCES investors(id) ON DELETE SET NULL,
  partner_id      UUID REFERENCES partners(id) ON DELETE SET NULL,

  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tasks IS 'Tasks with optional project, investor, or partner linkage.';
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);


-- ============================================================
-- TABLE: activity_log
-- Immutable audit trail for all project events
-- ============================================================
CREATE TABLE activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  activity_type   activity_type NOT NULL,
  title           TEXT NOT NULL,           -- Short human-readable summary
  description     TEXT,                    -- Detailed description

  -- For status changes
  old_value       TEXT,
  new_value       TEXT,

  -- Optional links
  investor_id     UUID REFERENCES investors(id) ON DELETE SET NULL,
  partner_id      UUID REFERENCES partners(id) ON DELETE SET NULL,
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Metadata (e.g. email subject, file name)
  metadata        JSONB DEFAULT '{}'::JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- activity_log is IMMUTABLE: no updated_at, no UPDATE allowed
);

COMMENT ON TABLE activity_log IS 'Immutable append-only audit log. One row per event, never updated.';
CREATE INDEX idx_activity_project_id ON activity_log(project_id);
CREATE INDEX idx_activity_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_type ON activity_log(activity_type);
CREATE INDEX idx_activity_created_at ON activity_log(created_at DESC);


-- ============================================================
-- TABLE: ai_outputs
-- Prepared for v1.1 KI features - schema only, not active
-- ============================================================
CREATE TABLE ai_outputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  output_type     TEXT NOT NULL,
  -- 'expose_teaser' | 'expose_short' | 'expose_full' | 'investor_email' | 'project_score' | 'dd_analysis'

  content         TEXT,                -- Generated text content
  content_html    TEXT,                -- Formatted HTML version
  metadata        JSONB DEFAULT '{}'::JSONB,

  -- Approval workflow (always manual review before use)
  status          TEXT NOT NULL DEFAULT 'draft',
  -- 'draft' | 'approved' | 'rejected' | 'published'
  approved_at     TIMESTAMPTZ,
  approved_by     UUID REFERENCES profiles(id),
  rejection_note  TEXT,

  -- Version
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES ai_outputs(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_outputs IS 'KI-generated outputs (exposés, emails, scores). Always requires manual approval. Active in v1.1.';


-- ============================================================
-- TRIGGERS: updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_partners
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_investors
  BEFORE UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_deals
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_expenses
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_commissions
  BEFORE UPDATE ON external_commissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_project_investors
  BEFORE UPDATE ON project_investors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_documents
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_ai_outputs
  BEFORE UPDATE ON ai_outputs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- TRIGGER: update projects.last_activity_at when activity logged
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_update_project_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    UPDATE projects
    SET last_activity_at = NOW()
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_project_last_activity
  AFTER INSERT ON activity_log
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_project_last_activity();


-- ============================================================
-- TRIGGER: auto-create profile when user signs up via Supabase Auth
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_create_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Ali Ünlü')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_profile_on_signup();


-- ============================================================
-- TRIGGER: log status changes in activity_log automatically
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_log_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_log (
      project_id, user_id, activity_type,
      title, description, old_value, new_value
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'status_change',
      'Status geändert',
      'Projektstatus wurde geändert von ' || OLD.status || ' zu ' || NEW.status,
      OLD.status::TEXT,
      NEW.status::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_project_status_change
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_project_status_change();


-- ============================================================
-- TRIGGER: log document uploads
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_log_document_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO activity_log (
    project_id, user_id, activity_type,
    title, description, document_id, metadata
  ) VALUES (
    NEW.project_id,
    NEW.user_id,
    'document_upload',
    'Dokument hochgeladen',
    NEW.display_name || ' (' || NEW.document_type || ')',
    NEW.id,
    jsonb_build_object('file_name', NEW.file_name, 'document_type', NEW.document_type)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_document_upload
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_document_upload();


-- ============================================================
-- TRIGGER: log investor contact
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_log_investor_linked()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_investor_name TEXT;
BEGIN
  SELECT COALESCE(full_name, company, 'Investor') INTO v_investor_name
  FROM investors WHERE id = NEW.investor_id;

  INSERT INTO activity_log (
    project_id, user_id, activity_type,
    title, description, investor_id
  ) VALUES (
    NEW.project_id,
    NEW.user_id,
    'investor_linked',
    'Investor verknüpft',
    v_investor_name || ' wurde dem Projekt zugeordnet',
    NEW.investor_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_investor_linked
  AFTER INSERT ON project_investors
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_investor_linked();


-- ============================================================
-- COMPUTED VIEWS
-- ============================================================

-- Dashboard KPI View
CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
  p.user_id,
  COUNT(DISTINCT p.id) FILTER (WHERE p.is_archived = FALSE)                           AS total_active_projects,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'lead')                               AS projects_lead,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'vorpruefung')                        AS projects_vorpruefung,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'investorensuche')                    AS projects_investorensuche,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'dd')                                 AS projects_dd,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'loi')                                AS projects_loi,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'spa')                                AS projects_spa,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'closing')                            AS projects_closing,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'verkauft')                           AS projects_sold,
  COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days')      AS projects_new_30d,
  COALESCE(SUM(d.sales_price) FILTER (WHERE d.is_active = TRUE), 0)                   AS total_volume_eur,
  COALESCE(SUM(d.gross_margin) FILTER (WHERE d.is_active = TRUE), 0)                  AS total_gross_margin_eur,
  COALESCE(SUM(d.net_profit) FILTER (WHERE d.is_active = TRUE), 0)                    AS total_net_profit_eur,
  COUNT(DISTINCT d.id) FILTER (WHERE d.deal_status = 'closed_won')                    AS deals_closed_won_ytd
FROM projects p
LEFT JOIN deals d ON d.project_id = p.id AND d.is_active = TRUE
WHERE p.is_archived = FALSE
GROUP BY p.user_id;

COMMENT ON VIEW v_dashboard_kpis IS 'Aggregated KPIs for the dashboard. Filter by user_id.';


-- Projects with deal summary view
CREATE OR REPLACE VIEW v_projects_with_deals AS
SELECT
  p.*,
  d.id              AS deal_id,
  d.deal_number     AS deal_number,
  d.deal_status     AS deal_status,
  d.purchase_price  AS deal_purchase_price,
  d.sales_price     AS deal_sales_price,
  d.gross_margin    AS deal_gross_margin,
  d.net_profit      AS deal_net_profit,
  d.margin_type     AS deal_margin_type,
  d.margin_value    AS deal_margin_value,
  pa.company        AS partner_company,
  pa.full_name      AS partner_name
FROM projects p
LEFT JOIN deals d ON d.project_id = p.id AND d.is_active = TRUE
LEFT JOIN partners pa ON pa.id = p.partner_id;

COMMENT ON VIEW v_projects_with_deals IS 'Projects with their active deal and partner info denormalized.';


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Single-user setup: user sees only their own data
-- Prepared for multi-user expansion
-- ============================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_commissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_investors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_outputs            ENABLE ROW LEVEL SECURITY;

-- Profiles: own row only
CREATE POLICY "profiles_own_row" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Partners
CREATE POLICY "partners_owner_all" ON partners
  FOR ALL USING (auth.uid() = user_id);

-- Investors
CREATE POLICY "investors_owner_all" ON investors
  FOR ALL USING (auth.uid() = user_id);

-- Projects
CREATE POLICY "projects_owner_all" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Deals
CREATE POLICY "deals_owner_all" ON deals
  FOR ALL USING (auth.uid() = user_id);

-- Expenses
CREATE POLICY "expenses_owner_all" ON expenses
  FOR ALL USING (auth.uid() = user_id);

-- Commissions
CREATE POLICY "commissions_owner_all" ON external_commissions
  FOR ALL USING (auth.uid() = user_id);

-- Project Investors
CREATE POLICY "project_investors_owner_all" ON project_investors
  FOR ALL USING (auth.uid() = user_id);

-- Documents
CREATE POLICY "documents_owner_all" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- Tasks
CREATE POLICY "tasks_owner_all" ON tasks
  FOR ALL USING (auth.uid() = user_id);

-- Activity Log (read own, insert own — no update/delete for immutability)
CREATE POLICY "activity_log_owner_read" ON activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "activity_log_owner_insert" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI Outputs
CREATE POLICY "ai_outputs_owner_all" ON ai_outputs
  FOR ALL USING (auth.uid() = user_id);

-- project_number_sequences: only via security definer functions
ALTER TABLE project_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences_deny_direct" ON project_number_sequences
  FOR ALL USING (FALSE);
