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
const VALID_FOCUS: InvestorFocus[] = ["PV", "BESS", "PV_BESS"];
const VALID_STATUS: InvestorStatus[] = ["Neu", "Kontaktiert", "DD_laeuft", "Angebot_gesendet", "Investiert", "Inaktiv"];

function normalizeWebsite(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}

function validateInvestorInput(input: InvestorFormInput): string | null {
  if (!input.company_name?.trim()) return "Firmenname ist erforderlich.";
  if (!input.contact_person?.trim()) return "Ansprechpartner ist erforderlich.";
  if (!input.email?.trim()) return "E-Mail ist erforderlich.";
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(input.email.trim())) return "E-Mail-Format ist ungültig.";
  if (!VALID_FOCUS.includes(input.focus)) return "Ungültiger Fokus.";
  if (!VALID_STATUS.includes(input.status)) return "Ungültiger Status.";
  if (input.website?.trim() && !normalizeWebsite(input.website)) return "Website-Adresse ist ungültig.";
  if (input.ticket_size_min_eur != null && input.ticket_size_max_eur != null && input.ticket_size_min_eur > input.ticket_size_max_eur) {
    return "Mindest-Investitionsvolumen darf nicht größer als das maximale Investitionsvolumen sein.";
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
    website: normalizeWebsite(input.website),
    country: input.country?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
    notes: input.notes?.trim() || null,
    ticket_size_min_eur: input.ticket_size_min_eur ?? null,
    ticket_size_max_eur: input.ticket_size_max_eur ?? null,
  };
}

function databasePayload(input: InvestorFormInput) {
  const clean = sanitize(input);
  return {
    ...clean,
    company: clean.company_name,
    full_name: clean.contact_person,
    location_country: clean.country || "Deutschland",
    min_ticket_eur: clean.ticket_size_min_eur,
    max_ticket_eur: clean.ticket_size_max_eur,
    is_active: clean.status !== "Inaktiv",
  };
}

export async function createInvestor(input: InvestorFormInput): Promise<ActionResult<Investor>> {
  const validationError = validateInvestorInput(input);
  if (validationError) return { success: false, error: validationError };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  const { data, error } = await supabase
    .from("investors")
    .insert({ ...databasePayload(input), user_id: user.id, created_by: user.id, updated_by: user.id })
    .select()
    .single();
  if (error) {
    console.error("[createInvestor]", error);
    if (error.code === "23505") return { success: false, error: "Ein Investor mit dieser E-Mail existiert bereits." };
    return { success: false, error: "Investor konnte nicht angelegt werden." };
  }
  revalidatePath(INVESTORS_PATH);
  return { success: true, data: data as Investor };
}

export async function updateInvestor(id: string, input: InvestorFormInput): Promise<ActionResult<Investor>> {
  if (!id) return { success: false, error: "Investor-ID fehlt." };
  const validationError = validateInvestorInput(input);
  if (validationError) return { success: false, error: validationError };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  const { data, error } = await supabase
    .from("investors")
    .update({ ...databasePayload(input), updated_by: user.id })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[updateInvestor]", error);
    if (error.code === "23505") return { success: false, error: "Ein Investor mit dieser E-Mail existiert bereits." };
    return { success: false, error: "Investor konnte nicht aktualisiert werden." };
  }
  if (!data) return { success: false, error: "Investor wurde nicht gefunden." };
  revalidatePath(INVESTORS_PATH);
  revalidatePath(`/investors/${id}`);
  return { success: true, data: data as Investor };
}

export async function deleteInvestor(id: string): Promise<ActionResult<{ id: string }>> {
  if (!id) return { success: false, error: "Investor-ID fehlt." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  const { error } = await supabase.from("investors").delete().eq("id", id);
  if (error) {
    console.error("[deleteInvestor]", error);
    return { success: false, error: "Investor konnte nicht gelöscht werden." };
  }
  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id } };
}

export async function getInvestors(filters: InvestorFilters = {}): Promise<ActionResult<InvestorWithStats[]>> {
  const supabase = await createClient();
  let query = supabase.from("investors_with_stats").select("*");
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(`company_name.ilike.%${term}%,contact_person.ilike.%${term}%,email.ilike.%${term}%,website.ilike.%${term}%,country.ilike.%${term}%`);
  }
  if (filters.focus && filters.focus !== "Alle") query = query.eq("focus", filters.focus);
  if (filters.status && filters.status !== "Alle") query = query.eq("status", filters.status);
  if (filters.projectId && filters.projectId !== "Alle") {
    const { data: linkRows, error: linkError } = await supabase.from("project_investors").select("investor_id").eq("project_id", filters.projectId);
    if (linkError) return { success: false, error: "Projektfilter konnte nicht angewendet werden." };
    const investorIds = (linkRows ?? []).map((row) => row.investor_id);
    if (investorIds.length === 0) return { success: true, data: [] };
    query = query.in("id", investorIds);
  }
  const sortBy = filters.sortBy ?? "company_name";
  const sortDirection = filters.sortDirection ?? "asc";
  query = query.order(sortBy, { ascending: sortDirection === "asc", nullsFirst: false });
  const { data, error } = await query;
  if (error) {
    console.error("[getInvestors]", error);
    return { success: false, error: "Investoren konnten nicht geladen werden." };
  }
  return { success: true, data: (data ?? []) as InvestorWithStats[] };
}

export async function getInvestorDashboardKpis(): Promise<ActionResult<InvestorDashboardKpis>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("investors").select("status, ticket_size_max_eur, ticket_size_min_eur");
  if (error) return { success: false, error: "KPIs konnten nicht geladen werden." };
  const rows = data ?? [];
  const totalTicketVolumeEur = rows.reduce((sum, row) => sum + Number(row.ticket_size_max_eur ?? row.ticket_size_min_eur ?? 0), 0);
  return {
    success: true,
    data: {
      totalInvestors: rows.length,
      activeInvestors: rows.filter((row) => row.status !== "Inaktiv").length,
      totalTicketVolumeEur,
    },
  };
}

export async function logInvestorContact(
  investorId: string,
  channel: "Telefon" | "E-Mail" | "Meeting" | "Video-Call" | "Sonstige",
  summary: string
): Promise<ActionResult<{ id: string }>> {
  if (!investorId || !summary?.trim()) return { success: false, error: "Investor-ID und Zusammenfassung sind erforderlich." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  const { data, error } = await supabase.from("activity_log").insert({
    investor_id: investorId,
    user_id: user.id,
    activity_type: "investor_contact",
    title: `${channel} mit Investor`,
    description: summary.trim(),
  }).select("id").single();
  if (error) return { success: false, error: "Kontakt konnte nicht protokolliert werden." };
  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id: data.id } };
}

export async function linkInvestorToProject(investorId: string, projectId: string): Promise<ActionResult<{ id: string }>> {
  if (!investorId || !projectId) return { success: false, error: "Investor- und Projekt-ID sind erforderlich." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Nicht authentifiziert. Bitte erneut anmelden." };
  const { data, error } = await supabase.from("project_investors").insert({ investor_id: investorId, project_id: projectId, user_id: user.id }).select("id").single();
  if (error) {
    if (error.code === "23505") return { success: false, error: "Investor ist bereits mit diesem Projekt verknüpft." };
    return { success: false, error: "Verknüpfung konnte nicht erstellt werden." };
  }
  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id: data.id } };
}

export async function unlinkInvestorFromProject(linkId: string): Promise<ActionResult<{ id: string }>> {
  if (!linkId) return { success: false, error: "Verknüpfungs-ID fehlt." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_investors").delete().eq("id", linkId);
  if (error) return { success: false, error: "Verknüpfung konnte nicht entfernt werden." };
  revalidatePath(INVESTORS_PATH);
  return { success: true, data: { id: linkId } };
}
