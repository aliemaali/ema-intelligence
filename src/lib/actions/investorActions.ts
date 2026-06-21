// src/lib/actions/investorActions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  Investor,
  InvestorWithStats,
  InvestorFormInput,
  InvestorFilters,
  InvestorDashboardKpis,
  InvestorFocus,
  InvestorStatus,
} from "@/types/investors";

const INVESTORS_PATH = "/investors";

// -----------------------------------------------------------------------------
// Validierung
// Bewusst ohne externe Lib (zod o.ä.), um keine zusätzliche Dependency
// vorauszusetzen, die du evtl. nicht installiert hast. Wenn zod bereits in
// deinem Projekt verwendet wird, ersetze diesen Block 1:1 durch ein Schema.
// -----------------------------------------------------------------------------

const VALID_FOCUS: InvestorFocus[] = ["PV", "BESS", "PV_BESS"];
const VALID_STATUS: InvestorStatus[] = [
  "Neu",
  "Kontaktiert",
  "DD_laeuft",
  "Angebot_gesendet",
  "Investiert",
  "Inaktiv",
];

function validateInvestorInput(input: InvestorFormInput): string | null {
  if (!input.company_name?.trim()) return "Firmenname ist erforderlich.";
  if (!input.contact_person?.trim()) return "Ansprechpartner ist erforderlich.";
  if (!input.email?.trim()) return "E-Mail ist erforderlich.";

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(input.email.trim())) return "E-Mail-Format ist ungültig.";

  if (!VALID_FOCUS.includes(input.focus)) return "Ungültiger Fokus.";
  if (!VALID_STATUS.includes(input.status)) return "Ungültiger Status.";

  if (
    input.ticket_size_min_eur != null &&
    input.ticket_size_max_eur != null &&
    input.ticket_size_min_eur > input.ticket_size_max_eur
  ) {
    return "Mindest-Ticketgröße darf nicht größer als Maximal-Ticketgröße sein.";
  }

  return null;
}

function sanitize(input: InvestorFormInput): InvestorFormInput {
  return {
    ...input,
    company_name: input.company_name.trim(),
    contact_person: input.contact_person.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    ticket_size_min_eur: input.ticket_size_min_eur ?? null,
    ticket_size_max_eur: input.ticket_size_max_eur ?? null,
    last_contact_at: input.last_contact_at || null,
    next_contact_at: input.next_contact_at || null,
  };
}

// -----------------------------------------------------------------------------
// createInvestor
// -----------------------------------------------------------------------------

export async function createInvestor(
  input: InvestorFormInput
): Promise<ActionResult<Investor>> {
  const validationError = validateInvestorInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  }

  const payload = sanitize(input);

  const { data, error } = await supabase
    .from("investors")
    .insert({ ...payload, created_by: user.id })
    .select()
    .single();

  if (error) {
    console.error("[createInvestor]", error);
    if (error.code === "23505") {
      return { success: false, error: "Ein Investor mit dieser E-Mail existiert bereits." };
    }
    return { success: false, error: "Investor konnte nicht angelegt werden." };
  }

  revalidatePath(INVESTORS_PATH);
  return { success: true, data: data as Investor };
}

// -----------------------------------------------------------------------------
// updateInvestor
// -----------------------------------------------------------------------------

export async function updateInvestor(
  id: string,
  input: InvestorFormInput
): Promise<ActionResult<Investor>> {
  if (!id) {
    return { success: false, error: "Investor-ID fehlt." };
  }

  const validationError = validateInvestorInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  }

  const payload = sanitize(input);

  const { data, error } = await supabase
    .from("investors")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateInvestor]", error);
    if (error.code === "23505") {
      return { success: false, error: "Ein Investor mit dieser E-Mail existiert bereits." };
    }
    return { success: false, error: "Investor konnte nicht aktualisiert werden." };
  }

  if (!data) {
    return { success: false, error: "Investor wurde nicht gefunden." };
  }

  revalidatePath(INVESTORS_PATH);
  return { success: true, data: data as Investor };
}

// -----------------------------------------------------------------------------
// deleteInvestor
// -----------------------------------------------------------------------------

export async function deleteInvestor(id: string): Promise<ActionResult<{ id: string }>> {
  if (!id) {
    return { success: false, error: "Investor-ID fehlt." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  }

  // Hinweis: investor_contacts, investor_notes und investor_project_links
  // werden per ON DELETE CASCADE im Schema automatisch mitgelöscht.
  const { error } = await supabase.from("investors").delete().eq("id", id);

  if (error) {
    console.error("[deleteInvestor]", error);
    return { success: false, error: "Investor konnte nicht gelöscht werden." };
  }

  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id } };
}

// -----------------------------------------------------------------------------
// getInvestors — mit Suche, Filtern, Sortierung
// Liest aus der `investors_with_stats` View (siehe SQL-Schema).
// -----------------------------------------------------------------------------

export async function getInvestors(
  filters: InvestorFilters = {}
): Promise<ActionResult<InvestorWithStats[]>> {
  const supabase = await createClient();

  let query = supabase.from("investors_with_stats").select("*");

  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `company_name.ilike.%${term}%,contact_person.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  if (filters.focus && filters.focus !== "Alle") {
    query = query.eq("focus", filters.focus);
  }

  if (filters.status && filters.status !== "Alle") {
    query = query.eq("status", filters.status);
  }

  if (filters.projectId && filters.projectId !== "Alle") {
    // Investoren, die mit dem gewählten Projekt verknüpft sind
    const { data: linkRows, error: linkError } = await supabase
      .from("investor_project_links")
      .select("investor_id")
      .eq("project_id", filters.projectId);

    if (linkError) {
      console.error("[getInvestors:projectFilter]", linkError);
      return { success: false, error: "Projektfilter konnte nicht angewendet werden." };
    }

    const investorIds = (linkRows ?? []).map((r) => r.investor_id);
    if (investorIds.length === 0) {
      return { success: true, data: [] };
    }
    query = query.in("id", investorIds);
  }

  const sortBy = filters.sortBy ?? "last_contact_at";
  const sortDirection = filters.sortDirection ?? "desc";
  query = query.order(sortBy, { ascending: sortDirection === "asc", nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    console.error("[getInvestors]", error);
    return { success: false, error: "Investoren konnten nicht geladen werden." };
  }

  return { success: true, data: (data ?? []) as InvestorWithStats[] };
}

// -----------------------------------------------------------------------------
// getInvestorDashboardKpis — aggregierte Kennzahlen fürs Dashboard
// -----------------------------------------------------------------------------

export async function getInvestorDashboardKpis(): Promise<
  ActionResult<InvestorDashboardKpis>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investors")
    .select("status, ticket_size_max_eur, ticket_size_min_eur, last_contact_at");

  if (error) {
    console.error("[getInvestorDashboardKpis]", error);
    return { success: false, error: "KPIs konnten nicht geladen werden." };
  }

  const rows = data ?? [];
  const totalInvestors = rows.length;
  const activeInvestors = rows.filter((r) => r.status !== "Inaktiv").length;

  // Konservative Schätzung des Ticketvolumens: nutzt die obere Grenze,
  // fällt auf die untere Grenze zurück, wenn keine Obergrenze gesetzt ist.
  const totalTicketVolumeEur = rows.reduce((sum, r) => {
    const value = r.ticket_size_max_eur ?? r.ticket_size_min_eur ?? 0;
    return sum + Number(value);
  }, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const contactedLast30Days = rows.filter(
    (r) => r.last_contact_at && new Date(r.last_contact_at) >= thirtyDaysAgo
  ).length;

  const mostRecentContactAt = rows
    .map((r) => r.last_contact_at)
    .filter((d): d is string => !!d)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return {
    success: true,
    data: {
      totalInvestors,
      activeInvestors,
      totalTicketVolumeEur,
      contactedLast30Days,
      mostRecentContactAt,
    },
  };
}

// -----------------------------------------------------------------------------
// Kontakt protokollieren (für "Kontaktieren"-Aktion / Kontakthistorie)
// -----------------------------------------------------------------------------

export async function logInvestorContact(
  investorId: string,
  channel: "Telefon" | "E-Mail" | "Meeting" | "Video-Call" | "Sonstige",
  summary: string
): Promise<ActionResult<{ id: string }>> {
  if (!investorId || !summary?.trim()) {
    return { success: false, error: "Investor-ID und Zusammenfassung sind erforderlich." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  }

  const { data, error } = await supabase
    .from("investor_contacts")
    .insert({
      investor_id: investorId,
      channel,
      summary: summary.trim(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[logInvestorContact]", error);
    return { success: false, error: "Kontakt konnte nicht protokolliert werden." };
  }

  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id: data.id } };
}

// -----------------------------------------------------------------------------
// Projekt-Verknüpfung
// -----------------------------------------------------------------------------

export async function linkInvestorToProject(
  investorId: string,
  projectId: string
): Promise<ActionResult<{ id: string }>> {
  if (!investorId || !projectId) {
    return { success: false, error: "Investor- und Projekt-ID sind erforderlich." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  }

  const { data, error } = await supabase
    .from("investor_project_links")
    .insert({ investor_id: investorId, project_id: projectId, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    console.error("[linkInvestorToProject]", error);
    if (error.code === "23505") {
      return { success: false, error: "Investor ist bereits mit diesem Projekt verknüpft." };
    }
    return { success: false, error: "Verknüpfung konnte nicht erstellt werden." };
  }

  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id: data.id } };
}

export async function unlinkInvestorFromProject(
  linkId: string
): Promise<ActionResult<{ id: string }>> {
  if (!linkId) {
    return { success: false, error: "Verknüpfungs-ID fehlt." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("investor_project_links").delete().eq("id", linkId);

  if (error) {
    console.error("[unlinkInvestorFromProject]", error);
    return { success: false, error: "Verknüpfung konnte nicht entfernt werden." };
  }

  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id: linkId } };
}
