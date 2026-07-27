"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, Eye, FolderKanban, X } from "lucide-react";
import { createInvestor, updateInvestor } from "@/lib/actions/investorActions";
import { getTemplateDocumentUrl } from "@/lib/actions/template-document.actions";
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
    if (!initial) return;
    setLoadingAssignments(true);
    getInvestorProjectAssignments(initial.id).then((result) => {
      if (result.success) {
        setAssignments(result.data);
        setSelectedProjects(new Set(result.data.map((item) => item.projectId)));
      } else setError(result.error);
      setLoadingAssignments(false);
    });
  }, [initial]);

  const assignmentMap = useMemo(() => new Map(assignments.map((item) => [item.projectId, item])), [assignments]);
  const update = <K extends keyof InvestorFormInput>(field: K, value: InvestorFormInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const toggleProject = (id: string) => setSelectedProjects((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const openExpose = async (filePath: string) => {
    const opened = window.open("about:blank", "_blank");
    const result = await getTemplateDocumentUrl(filePath);
    if (result.error || !result.url) { opened?.close(); setError(result.error ?? "Exposé konnte nicht geöffnet werden."); return; }
    if (opened) { opened.opener = null; opened.location.href = result.url; } else window.location.assign(result.url);
  };

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = isNew ? await createInvestor(form) : await updateInvestor(initial!.id, form);
      if (!result.success) { setError(result.error); return; }
      const investorId = result.data.id;
      const assignmentResult = await saveInvestorProjectAssignments(investorId, Array.from(selectedProjects));
      if (!assignmentResult.success) { setError(assignmentResult.error); return; }
      onSaved();
    });
  }

  const canSave = form.company_name.trim() && form.contact_person.trim() && form.email.trim();

  return <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-800">{isNew ? "Neuer Investor" : "Investor bearbeiten"}</h2>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"><X size={17} className="text-slate-500" /></button>
      </div>

      <div className="space-y-5 p-5">
        {error && <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5"><AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" /><span className="text-[12.5px] text-red-700">{error}</span></div>}

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

        <Field label="Notizen" full><textarea value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={3} className="input resize-none" /></Field>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F2A44] text-white"><FolderKanban size={19} /></span><div><h3 className="font-extrabold text-[#1F2A44]">Zugeordnete Projekte & Exposés</h3><p className="text-xs text-slate-500">Projekt auswählen; vorhandene Exposés werden automatisch angezeigt.</p></div></div>
          <div className="mt-4 space-y-2">
            {projects.map((project) => {
              const assignment = assignmentMap.get(project.id);
              const checked = selectedProjects.has(project.id);
              return <div key={project.id} className={`rounded-xl border bg-white p-3 ${checked ? "border-[#5CB800]" : "border-slate-200"}`}>
                <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={checked} onChange={() => toggleProject(project.id)} className="h-4 w-4 accent-[#5CB800]" /><span className="flex-1 font-bold text-slate-800">{project.name}</span><span className="text-xs font-semibold text-slate-400">{assignment?.exposes.length ?? 0} Exposé{(assignment?.exposes.length ?? 0) === 1 ? "" : "s"}</span></label>
                {checked && assignment?.exposes?.length ? <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{assignment.exposes.map((doc) => <button key={doc.id} type="button" onClick={() => openExpose(doc.filePath)} className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs font-bold text-[#1F2A44]"><Eye size={14} /> <span className="min-w-0 flex-1 break-words">{doc.displayName}</span></button>)}</div> : checked ? <p className="mt-2 pl-7 text-xs text-slate-400">Noch kein Exposé am Projekt hinterlegt.</p> : null}
              </div>;
            })}
            {!projects.length && <p className="py-3 text-center text-xs text-slate-500">Keine Projekte vorhanden.</p>}
            {loadingAssignments && <p className="py-2 text-center text-xs text-slate-500">Zuordnungen werden geladen…</p>}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white p-4">
        <button onClick={onClose} disabled={isPending} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-[13px] font-medium text-slate-600">Abbrechen</button>
        <button onClick={handleSubmit} disabled={!canSave || isPending} className="flex-1 rounded-lg bg-[#5CB800] py-2.5 text-[13px] font-medium text-white disabled:opacity-40">{isPending ? "Speichert…" : isNew ? "Investor anlegen" : "Änderungen speichern"}</button>
      </div>
    </div>
    <style>{`.input{width:100%;padding:.55rem .7rem;border-radius:.5rem;border:1px solid #E2E8F0;font-size:13px;outline:none;color:#334155;background:white}.input:focus{border-color:#5CB800;box-shadow:0 0 0 3px rgba(92,184,0,.15)}`}</style>
  </div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? "col-span-2" : ""}><label className="mb-1.5 block text-[11.5px] font-medium text-slate-500">{label}</label>{children}</div>;
}
