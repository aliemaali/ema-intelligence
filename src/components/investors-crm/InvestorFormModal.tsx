"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, ExternalLink, FileDown, FolderKanban, UserRound, X } from "lucide-react";
import { createInvestor, updateInvestor } from "@/lib/actions/investorActions";
import {
  getInvestorProjectAssignments,
  saveInvestorProjectAssignments,
  type InvestorProjectAssignment,
} from "@/lib/actions/investorProjectActions";
import type { Investor, InvestorFocus, InvestorFormInput, InvestorStatus } from "@/types/investors";
import { INVESTOR_FOCUS_LABELS, INVESTOR_STATUS_LABELS } from "@/types/investors";

interface ProjectOption { id: string; name: string }
interface InvestorFormModalProps {
  initial: Investor | null;
  projects: ProjectOption[];
  onClose: () => void;
  onSaved: () => void;
}

type Tab = "details" | "projects";

const EMPTY_FORM: InvestorFormInput = {
  company_name: "", contact_person: "", email: "", phone: "",
  ticket_size_min_eur: null, ticket_size_max_eur: null,
  focus: "PV", status: "Neu", last_contact_at: null, next_contact_at: null, notes: "",
};

function formatInteger(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "" : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}
function parseInteger(value: string) { const digits = value.replace(/\D/g, ""); return digits ? Number(digits) : null; }

export function InvestorFormModal({ initial, projects, onClose, onSaved }: InvestorFormModalProps) {
  const isNew = !initial;
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [form, setForm] = useState<InvestorFormInput>(initial ? {
    company_name: initial.company_name, contact_person: initial.contact_person, email: initial.email,
    phone: initial.phone, ticket_size_min_eur: initial.ticket_size_min_eur,
    ticket_size_max_eur: initial.ticket_size_max_eur, focus: initial.focus, status: initial.status,
    last_contact_at: initial.last_contact_at, next_contact_at: initial.next_contact_at, notes: initial.notes,
  } : EMPTY_FORM);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<InvestorProjectAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!initial) return;
    setLoadingAssignments(true);
    getInvestorProjectAssignments(initial.id, projects.map((project) => project.id)).then((result) => {
      if (result.success) {
        setAssignments(result.data);
        setSelectedProjects(new Set(result.data.filter((item) => item.assigned).map((item) => item.projectId)));
      } else setError(result.error);
      setLoadingAssignments(false);
    });
  }, [initial, projects]);

  const assignmentMap = useMemo(() => new Map(assignments.map((item) => [item.projectId, item])), [assignments]);
  const update = <K extends keyof InvestorFormInput>(field: K, value: InvestorFormInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const toggleProject = (id: string) => setSelectedProjects((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  function openMemorandum(projectId: string) {
    const url = `/expose/${projectId}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = isNew ? await createInvestor(form) : await updateInvestor(initial!.id, form);
      if (!result.success) { setError(result.error); setActiveTab("details"); return; }
      const assignmentResult = await saveInvestorProjectAssignments(result.data.id, Array.from(selectedProjects));
      if (!assignmentResult.success) { setError(assignmentResult.error); setActiveTab("projects"); return; }
      onSaved();
    });
  }

  const canSave = form.company_name.trim() && form.contact_person.trim() && form.email.trim();

  return <div className="fixed inset-0 z-[250] flex h-[100dvh] w-full items-stretch justify-center bg-white sm:items-center sm:bg-black/40 sm:p-4">
    <button aria-label="Schließen" className="absolute inset-0 hidden sm:block" onClick={onClose} />
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl">
      <div className="shrink-0 border-b border-slate-100 bg-white px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-slate-800">{isNew ? "Neuer Investor" : "Investor bearbeiten"}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <TabButton active={activeTab === "details"} onClick={() => setActiveTab("details")} icon={<UserRound size={15} />} label="Stammdaten" />
          <TabButton active={activeTab === "projects"} onClick={() => setActiveTab("projects")} icon={<FolderKanban size={15} />} label={`Projekte (${selectedProjects.size})`} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" style={{ WebkitOverflowScrolling: "touch" }}>
        {error && <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-3"><AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" /><span className="text-[12.5px] text-red-700">{error}</span></div>}

        {activeTab === "details" ? <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Firmenname *" full><input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} className="input" /></Field>
            <Field label="Ansprechpartner *" full><input value={form.contact_person} onChange={(e) => update("contact_person", e.target.value)} className="input" /></Field>
            <Field label="E-Mail *"><input value={form.email} onChange={(e) => update("email", e.target.value)} className="input" /></Field>
            <Field label="Telefon"><input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} className="input" /></Field>
            <Field label="Investitionsvolumen min. (EUR)"><input inputMode="numeric" value={formatInteger(form.ticket_size_min_eur)} onChange={(e) => update("ticket_size_min_eur", parseInteger(e.target.value))} className="input tabular-nums" /></Field>
            <Field label="Investitionsvolumen max. (EUR)"><input inputMode="numeric" value={formatInteger(form.ticket_size_max_eur)} onChange={(e) => update("ticket_size_max_eur", parseInteger(e.target.value))} className="input tabular-nums" /></Field>
            <Field label="Fokus"><select value={form.focus} onChange={(e) => update("focus", e.target.value as InvestorFocus)} className="input">{Object.entries(INVESTOR_FOCUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={(e) => update("status", e.target.value as InvestorStatus)} className="input">{Object.entries(INVESTOR_STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          </div>
          <Field label="Notizen" full><textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={5} className="input resize-none" /></Field>
        </div> : <section>
          <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F2A44] text-white"><FileDown size={19} /></span><div><h3 className="font-extrabold text-[#1F2A44]">Projekte & Investment Memoranden</h3><p className="text-xs text-slate-500">Projekt auswählen und das zugehörige Investment Memorandum öffnen.</p></div></div>
          <div className="space-y-2 pb-4">
            {projects.map((project) => {
              const assignment = assignmentMap.get(project.id);
              const checked = selectedProjects.has(project.id);
              return <div key={project.id} className={`rounded-xl border bg-white p-3 ${checked ? "border-[#5CB800] shadow-sm" : "border-slate-200"}`}>
                <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={checked} onChange={() => toggleProject(project.id)} className="h-5 w-5 accent-[#5CB800]" /><span className="min-w-0 flex-1 break-words font-bold text-slate-800">{project.name}</span>{checked && <span className="shrink-0 rounded-full bg-[#5CB800]/10 px-2 py-1 text-[10px] font-extrabold text-[#3D9200]">Zugeordnet</span>}</label>
                {checked && <button type="button" onClick={() => openMemorandum(project.id)} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-[#07142F] px-3 py-3 text-left text-xs font-extrabold text-white"><FileDown size={15} /><span className="min-w-0 flex-1">Investment Memorandum</span><ExternalLink size={14} /></button>}
                {checked && !assignment && <p className="mt-2 text-[11px] text-slate-400">Das Memorandum wird direkt aus den aktuellen Projektdaten erzeugt.</p>}
              </div>;
            })}
            {!projects.length && <p className="py-8 text-center text-xs text-slate-500">Keine Projekte vorhanden.</p>}
            {loadingAssignments && <p className="py-2 text-center text-xs text-slate-500">Zuordnungen werden geladen…</p>}
          </div>
        </section>}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex gap-2">
          <button onClick={onClose} disabled={isPending} className="flex-1 rounded-xl border border-slate-200 py-3 text-[13px] font-medium text-slate-600">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!canSave || isPending} className="flex-1 rounded-xl bg-[#5CB800] py-3 text-[13px] font-medium text-white disabled:opacity-40">{isPending ? "Speichert…" : isNew ? "Investor anlegen" : "Änderungen speichern"}</button>
        </div>
      </div>
    </div>
    <style>{`.input{width:100%;padding:.65rem .75rem;border-radius:.65rem;border:1px solid #E2E8F0;font-size:13px;outline:none;color:#334155;background:white}.input:focus{border-color:#5CB800;box-shadow:0 0 0 3px rgba(92,184,0,.15)}`}</style>
  </div>;
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition ${active ? "bg-white text-[#1F2A44] shadow-sm" : "text-slate-500"}`}>{icon}{label}</button>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "col-span-2" : ""}><label className="mb-1.5 block text-[11.5px] font-medium text-slate-500">{label}</label>{children}</div>;
}
