-- ============================================================
-- EMA Intelligence – Seed Data (Development Only)
-- Run AFTER initial schema migration
-- ============================================================
-- NOTE: Replace 'YOUR_USER_ID' with your actual Supabase Auth UID
-- You can find it in: Supabase Dashboard → Auth → Users
-- ============================================================

-- This seed creates demo data for local development.
-- Do NOT run in production.

-- To use: Replace {{USER_ID}} with your actual auth.users.id
-- e.g. '550e8400-e29b-41d4-a716-446655440000'

DO $$
DECLARE
  v_user_id     UUID;
  v_partner1_id UUID;
  v_partner2_id UUID;
  v_partner3_id UUID;
  v_investor1_id UUID;
  v_investor2_id UUID;
  v_project1_id UUID;
  v_project2_id UUID;
  v_project3_id UUID;
  v_deal1_id UUID;
  v_deal2_id UUID;
BEGIN

  -- Get first user (assumes you've signed up once)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found. Please sign up first, then run seed.sql again.';
    RETURN;
  END IF;

  -- Update profile
  UPDATE profiles SET
    full_name = 'Ali Ünlü',
    company = 'EMA Enterprise GmbH',
    phone = '+49 170 000 0000'
  WHERE id = v_user_id;

  -- ─── PARTNERS ───────────────────────────────────────────────

  INSERT INTO partners (user_id, full_name, company, email, phone, location_city, location_state)
  VALUES (v_user_id, 'Thomas Müller', 'Müller Projektentwicklung GmbH', 'mueller@mp-solar.de', '+49 89 1234567', 'München', 'Bayern')
  RETURNING id INTO v_partner1_id;

  INSERT INTO partners (user_id, full_name, company, email, phone, location_city, location_state)
  VALUES (v_user_id, 'Sandra Brandt', 'EnCom Renewable AG', 'brandt@encom.de', '+49 341 9876543', 'Leipzig', 'Sachsen')
  RETURNING id INTO v_partner2_id;

  INSERT INTO partners (user_id, full_name, company, email, phone, location_city, location_state)
  VALUES (v_user_id, 'Marcus Weber', 'SunDev Partners', 'weber@sundev.com', '+49 36 5554321', 'Erfurt', 'Thüringen')
  RETURNING id INTO v_partner3_id;

  -- ─── INVESTORS ──────────────────────────────────────────────

  INSERT INTO investors (
    user_id, full_name, company, email, phone,
    interest_pv, interest_bess, interest_hybrid,
    size_preferences, investment_type, min_ticket_eur, max_ticket_eur
  ) VALUES (
    v_user_id, 'Klaus Braun', 'Meridian Capital GmbH', 'k.braun@meridian-cap.de', '+49 69 4440001',
    TRUE, TRUE, FALSE,
    '["size_10_50mw", "size_50_250mw"]', 'equity', 5000000, 50000000
  ) RETURNING id INTO v_investor1_id;

  INSERT INTO investors (
    user_id, full_name, company, email, phone,
    interest_pv, interest_bess, interest_hybrid,
    size_preferences, investment_type, min_ticket_eur, max_ticket_eur
  ) VALUES (
    v_user_id, 'Maria Fischer', 'Green Infrastructure Fund', 'm.fischer@greeninfra.de', '+49 40 8880002',
    TRUE, FALSE, TRUE,
    '["size_50_250mw"]', 'equity', 20000000, 200000000
  ) RETURNING id INTO v_investor2_id;

  -- ─── PROJECTS ───────────────────────────────────────────────

  INSERT INTO projects (
    user_id, partner_id,
    project_number,
    project_name, project_type, status, priority, marketing_status,
    contact_name, contact_email, contact_phone,
    location_city, location_state,
    pv_mwp, pv_ac_mw,
    dev_status, notes
  ) VALUES (
    v_user_id, v_partner1_id,
    'PV-2026-001',
    'Solarpark Erfurt Süd', 'pv_freiflaeche', 'dd', 'hoch', 'dd_laeuft',
    'Thomas Müller', 'mueller@mp-solar.de', '+49 89 1234567',
    'Erfurt', 'Thüringen',
    12.5, 11.0,
    '{"netzanschluss": true, "baugenehmigung": false, "pachtvertrag": true, "eeg_faehigkeit": true, "gutachten": false, "umweltpruefung": null}',
    'DD läuft seit 02.06.2026. Baugenehmigung noch ausstehend, erwartet August 2026.'
  ) RETURNING id INTO v_project1_id;

  INSERT INTO projects (
    user_id, partner_id,
    project_number,
    project_name, project_type, status, priority, marketing_status,
    contact_name, contact_email,
    location_city, location_state,
    bess_mw, bess_mwh, bess_duration_h,
    dev_status, notes
  ) VALUES (
    v_user_id, v_partner2_id,
    'BESS-2026-001',
    'Speicher Leipzig West', 'bess', 'loi', 'hoch', 'loi_erhalten',
    'Sandra Brandt', 'brandt@encom.de',
    'Leipzig', 'Sachsen',
    5.0, 20.0, 4.0,
    '{"netzanschluss": true, "baugenehmigung": true, "pachtvertrag": true, "eeg_faehigkeit": null, "gutachten": true, "umweltpruefung": true}',
    'LOI von Meridian Capital erhalten am 10.06.2026.'
  ) RETURNING id INTO v_project2_id;

  INSERT INTO projects (
    user_id, partner_id,
    project_number,
    project_name, project_type, status, priority, marketing_status,
    contact_name, contact_email,
    location_city, location_state,
    pv_mwp, bess_mwh,
    hybrid_config, dev_status, notes
  ) VALUES (
    v_user_id, v_partner3_id,
    'HYB-2026-001',
    'Hybrid Thüringen Mitte', 'hybrid', 'investorensuche', 'mittel', 'an_investoren_versendet',
    'Marcus Weber', 'weber@sundev.com',
    'Gotha', 'Thüringen',
    8.0, 4.0,
    '{"pv_mwp": 8.0, "bess_mwh": 4.0, "bess_mw": 2.0}',
    '{"netzanschluss": true, "baugenehmigung": null, "pachtvertrag": true, "eeg_faehigkeit": null, "gutachten": false, "umweltpruefung": null}',
    'Teaser an 3 Investoren versendet. Rückmeldung ausstehend.'
  ) RETURNING id INTO v_project3_id;

  -- ─── DEALS ──────────────────────────────────────────────────

  INSERT INTO deals (
    user_id, project_id, deal_number, is_active, deal_status,
    purchase_price, purchase_per_kwp,
    margin_type, margin_value, margin_eur,
    sales_price, gross_margin, gross_margin_pct,
    net_profit, net_profit_pct,
    offer_date
  ) VALUES (
    v_user_id, v_project1_id, 'DEAL-2026-001', TRUE, 'negotiating',
    1250000, 100.0,
    'percent', 15.0, 187500,
    1437500, 187500, 15.0,
    155500, 12.44,
    '2026-05-15'
  ) RETURNING id INTO v_deal1_id;

  INSERT INTO deals (
    user_id, project_id, deal_number, is_active, deal_status,
    purchase_price, purchase_per_mwh,
    margin_type, margin_value, margin_eur,
    sales_price, gross_margin, gross_margin_pct,
    net_profit, net_profit_pct,
    offer_date, loi_date
  ) VALUES (
    v_user_id, v_project2_id, 'DEAL-2026-002', TRUE, 'negotiating',
    960000, 48000.0,
    'percent', 10.0, 96000,
    1056000, 96000, 10.0,
    82000, 8.54,
    '2026-05-20', '2026-06-10'
  ) RETURNING id INTO v_deal2_id;

  -- ─── EXPENSES ───────────────────────────────────────────────

  INSERT INTO expenses (user_id, deal_id, project_id, category, description, amount_eur, is_confirmed)
  VALUES
    (v_user_id, v_deal1_id, v_project1_id, 'aussenprovision', 'Provision Müller GmbH', 25000, TRUE),
    (v_user_id, v_deal1_id, v_project1_id, 'reise', 'Reisekosten Erfurt 3x', 1200, TRUE),
    (v_user_id, v_deal1_id, v_project1_id, 'beratung', 'Rechtsberatung NDA/LOI', 5000, FALSE),
    (v_user_id, v_deal1_id, v_project1_id, 'sonstiges', 'Gutachten-Beitrag', 800, FALSE),
    (v_user_id, v_deal2_id, v_project2_id, 'aussenprovision', 'Provision EnCom AG', 10000, TRUE),
    (v_user_id, v_deal2_id, v_project2_id, 'beratung', 'Technische Due Diligence', 4000, FALSE);

  -- ─── EXTERNAL COMMISSIONS ───────────────────────────────────

  INSERT INTO external_commissions (user_id, project_id, deal_id, partner_id, commission_type, commission_value, commission_eur, status)
  VALUES
    (v_user_id, v_project1_id, v_deal1_id, v_partner1_id, 'fixed', 25000, 25000, 'offen'),
    (v_user_id, v_project2_id, v_deal2_id, v_partner2_id, 'percent', 1.0, 9600, 'offen');

  -- ─── PROJECT INVESTORS ──────────────────────────────────────

  INSERT INTO project_investors (user_id, project_id, investor_id, status, teaser_sent_at, match_score)
  VALUES
    (v_user_id, v_project1_id, v_investor1_id, 'dd', NOW() - INTERVAL '15 days', 92),
    (v_user_id, v_project2_id, v_investor1_id, 'loi', NOW() - INTERVAL '20 days', 88),
    (v_user_id, v_project3_id, v_investor2_id, 'interesse', NOW() - INTERVAL '5 days', 75);

  -- ─── TASKS ──────────────────────────────────────────────────

  INSERT INTO tasks (user_id, project_id, title, description, due_date, priority, status)
  VALUES
    (v_user_id, v_project1_id, 'NDA an Müller GmbH senden', 'NDA-Entwurf liegt bereit, finale Version absenden', CURRENT_DATE, 'hoch', 'offen'),
    (v_user_id, v_project1_id, 'DD-Unterlagen vollständig prüfen', 'Checkliste abarbeiten: Netzanschluss, Pachtvertrag, Baugenehmigung Status', CURRENT_DATE + 2, 'hoch', 'in_bearbeitung'),
    (v_user_id, v_project2_id, 'LOI von Meridian gegenzeichnen', 'Anwalt einschalten für finale Prüfung', CURRENT_DATE + 3, 'hoch', 'offen'),
    (v_user_id, v_project3_id, 'Exposé für Hybrid-Projekt finalisieren', 'Technische Daten noch einmal von Weber bestätigen lassen', CURRENT_DATE + 2, 'mittel', 'offen'),
    (v_user_id, NULL, 'Call Meridian Capital – Rückmeldung BESS', 'Rückruf zu LOI-Konditionen', CURRENT_DATE + 4, 'mittel', 'offen');

  -- ─── MANUAL ACTIVITY LOG ENTRIES ────────────────────────────

  INSERT INTO activity_log (user_id, project_id, activity_type, title, description)
  VALUES
    (v_user_id, v_project1_id, 'note_added', 'Notiz hinzugefügt', 'Rückruf mit Müller GmbH: Baugenehmigung kommt voraussichtlich August 2026.'),
    (v_user_id, v_project2_id, 'email_sent', 'E-Mail an Meridian Capital', 'BESS-Teaser und vollständiges Exposé versendet.'),
    (v_user_id, v_project3_id, 'note_added', 'Erstkontakt SunDev', 'Projekt ist grundsätzlich interessant. Weitere Unterlagen werden nachgereicht.');

  RAISE NOTICE 'Seed data created successfully for user: %', v_user_id;

END $$;
