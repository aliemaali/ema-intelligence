// src/components/investors/InvestorFormModal.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Building2, ImagePlus, Loader2, X } from "lucide-react";
import { createInvestor, updateInvestor } from "@/lib/actions/investorActions";
import { createClient } from "@/lib/supabase/client";
import {
  INVESTOR_COUNTRIES,
  getAutomaticInvestorLogoUrl,
  getInvestorFlagUrl,
  getInvestorInitials,
} from "@/lib/investors/identity";
import type {
  Investor,
  InvestorFormInput,
  InvestorFocus,
  InvestorStatus,
} from "@/types/investors";
import { INVESTOR_STATUS_LABELS, INVESTOR_FOCUS_LABELS } from "@/types/investors";

interface InvestorFormModalProps {
  initial: Investor | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM: InvestorFormInput = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  website: "",
  country: "Deutschland",
  logo_url: "",
  ticket_size_min_eur: null,
  ticket_size_max_eur: null,
  focus: "PV",
  status: "Neu",
  notes: "",
};

function formatInteger(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

function parseInteger(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

function fileExtension(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && ["png", "jpg", "jpeg", "webp", "svg"].includes(extension)) return extension;
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  return "jpg";
}

export function InvestorFormModal({ initial, onClose, onSaved }: InvestorFormModalProps) {
  const isNew = !initial;
  const [form, setForm] = useState<InvestorFormInput>(
    initial
      ? {
          company_name: initial.company_name,
          contact_person: initial.contact_person,
          email: initial.email,
          phone: initial.phone,
          website: initial.website ?? "",
          country: initial.country ?? "Deutschland",
          logo_url: initial.logo_url ?? "",
          ticket_size_min_eur: initial.ticket_size_min_eur,
          ticket_size_max_eur: initial.ticket_size_max_eur,
          focus: initial.focus,
          status: initial.status,
          notes: initial.notes,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof InvestorFormInput>(field: K, value: InvestorFormInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "website" || field === "logo_url") setLogoFailed(false);
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei auswählen.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Das Logo darf maximal 2 MB groß sein.");
      return;
    }

    setError(null);
    setIsUploadingLogo(true);
    try {
      const supabase = createClient();
      const owner = initial?.id ?? crypto.randomUUID();
      const path = `${owner}/logo-${Date.now()}.${fileExtension(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("investor-logos")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) {
        setError("Logo konnte nicht hochgeladen werden.");
        return;
      }

      const { data } = supabase.storage.from("investor-logos").getPublicUrl(path);
      update("logo_url", data.publicUrl);
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = isNew
        ? await createInvestor(form)
        : await updateInvestor(initial!.id, form);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  const canSave = form.company_name.trim() && form.contact_person.trim() && form.email.trim();
  const automaticLogo = getAutomaticInvestorLogoUrl(form.website);
  const displayedLogo = form.logo_url || automaticLogo;
  const flagUrl = getInvestorFlagUrl(form.country);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-semibold text-[15px] text-slate-800">
            {isNew ? "Neuer Investor" : "Investor bearbeiten"}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <span className="text-[12.5px] text-red-700">{error}</span>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-sm font-bold text-[#1B2C4E]">
                {displayedLogo && !logoFailed ? (
                  <img src={displayedLogo} alt="Firmenlogo" className="h-full w-full object-contain p-1.5" onError={() => setLogoFailed(true)} />
                ) : form.company_name ? (
                  getInvestorInitials(form.company_name)
                ) : (
                  <Building2 size={22} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-slate-700">Firmenlogo</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                  Wird automatisch über die Website versucht. Ein manuelles Logo hat Vorrang.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-medium text-slate-700 disabled:opacity-50">
                    {isUploadingLogo ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                    Logo hochladen
                  </button>
                  {form.logo_url && (
                    <button type="button" onClick={() => update("logo_url", "")} className="rounded-lg px-3 py-2 text-[11.5px] font-medium text-red-600 hover:bg-red-50">
                      Manuelles Logo entfernen
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => uploadLogo(event.target.files?.[0])} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Firmenname *" full>
              <input value={form.company_name} onChange={(event) => update("company_name", event.target.value)} className="input" placeholder="z. B. Rheinland Capital GmbH" />
            </Field>

            <Field label="Ansprechpartner *" full>
              <input value={form.contact_person} onChange={(event) => update("contact_person", event.target.value)} className="input" placeholder="Vor- und Nachname" />
            </Field>

            <Field label="E-Mail *">
              <input value={form.email} onChange={(event) => update("email", event.target.value)} className="input" placeholder="name@firma.de" />
            </Field>

            <Field label="Telefon">
              <input value={form.phone ?? ""} onChange={(event) => update("phone", event.target.value)} className="input" placeholder="+49 …" />
            </Field>

            <Field label="Website" full>
              <input value={form.website ?? ""} onChange={(event) => update("website", event.target.value)} className="input" placeholder="www.firma.de" inputMode="url" />
            </Field>

            <Field label="Land" full>
              <div className="relative">
                {flagUrl && <img src={flagUrl} alt="" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-5 -translate-y-1/2 rounded-sm object-cover shadow-sm" />}
                <select value={form.country ?? ""} onChange={(event) => update("country", event.target.value)} className="input pl-11">
                  <option value="">Land auswählen</option>
                  {INVESTOR_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                </select>
              </div>
            </Field>

            <Field label="Investitionsvolumen min. (EUR)">
              <input type="text" inputMode="numeric" value={formatInteger(form.ticket_size_min_eur)} onChange={(event) => update("ticket_size_min_eur", parseInteger(event.target.value))} className="input tabular-nums" placeholder="z. B. 500.000" />
            </Field>

            <Field label="Investitionsvolumen max. (EUR)">
              <input type="text" inputMode="numeric" value={formatInteger(form.ticket_size_max_eur)} onChange={(event) => update("ticket_size_max_eur", parseInteger(event.target.value))} className="input tabular-nums" placeholder="z. B. 5.000.000" />
            </Field>

            <Field label="Fokus">
              <select value={form.focus} onChange={(event) => update("focus", event.target.value as InvestorFocus)} className="input">
                {Object.entries(INVESTOR_FOCUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>

            <Field label="Status">
              <select value={form.status} onChange={(event) => update("status", event.target.value as InvestorStatus)} className="input">
                {Object.entries(INVESTOR_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Notizen" full>
            <textarea value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value)} rows={3} className="input resize-none" placeholder="Konditionen, Präferenzen, Hinweise…" />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-2">
          <button onClick={onClose} disabled={isPending || isUploadingLogo} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-600 disabled:opacity-50">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!canSave || isPending || isUploadingLogo} className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-40 transition-opacity" style={{ background: "#5CB800" }}>
            {isPending ? "Speichert…" : isNew ? "Investor anlegen" : "Änderungen speichern"}
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.55rem 0.7rem;
          border-radius: 0.5rem;
          border: 1px solid #E2E8F0;
          font-size: 13px;
          outline: none;
          color: #334155;
          background: white;
        }
        .input:focus {
          border-color: #5CB800;
          box-shadow: 0 0 0 3px rgba(92,184,0,0.15);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[11.5px] font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
