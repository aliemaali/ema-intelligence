// src/components/investors/InvestorFormModal.tsx
"use client";

import { useState, useTransition } from "react";
import { X, AlertCircle } from "lucide-react";
import { createInvestor, updateInvestor } from "@/lib/actions/investorActions";
import type {
  Investor,
  InvestorFormInput,
  InvestorFocus,
  InvestorStatus,
} from "@/types/investors";
import { INVESTOR_STATUS_LABELS, INVESTOR_FOCUS_LABELS } from "@/types/investors";

interface InvestorFormModalProps {
  initial: Investor | null; // null = neuer Investor
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM: InvestorFormInput = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  ticket_size_min_eur: null,
  ticket_size_max_eur: null,
  focus: "PV",
  status: "Neu",
  last_contact_at: null,
  next_contact_at: null,
  notes: "",
};

export function InvestorFormModal({ initial, onClose, onSaved }: InvestorFormModalProps) {
  const isNew = !initial;
  const [form, setForm] = useState<InvestorFormInput>(
    initial
      ? {
          company_name: initial.company_name,
          contact_person: initial.contact_person,
          email: initial.email,
          phone: initial.phone,
          ticket_size_min_eur: initial.ticket_size_min_eur,
          ticket_size_max_eur: initial.ticket_size_max_eur,
          focus: initial.focus,
          status: initial.status,
          last_contact_at: initial.last_contact_at,
          next_contact_at: initial.next_contact_at,
          notes: initial.notes,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof InvestorFormInput>(field: K, value: InvestorFormInput[K]) {
    setForm((f) => ({ ...f, [field]: value }));
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-semibold text-[15px] text-slate-800">
            {isNew ? "Neuer Investor" : "Investor bearbeiten"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100"
          >
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Firmenname *" full>
              <input
                value={form.company_name}
                onChange={(e) => update("company_name", e.target.value)}
                className="input"
                placeholder="z. B. Rheinland Capital GmbH"
              />
            </Field>

            <Field label="Ansprechpartner *" full>
              <input
                value={form.contact_person}
                onChange={(e) => update("contact_person", e.target.value)}
                className="input"
                placeholder="Vor- und Nachname"
              />
            </Field>

            <Field label="E-Mail *">
              <input
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="input"
                placeholder="name@firma.de"
              />
            </Field>

            <Field label="Telefon">
              <input
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
                className="input"
                placeholder="+49 …"
              />
            </Field>

            <Field label="Ticketgröße min. (EUR)">
              <input
                type="number"
                value={form.ticket_size_min_eur ?? ""}
                onChange={(e) =>
                  update(
                    "ticket_size_min_eur",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="input"
                placeholder="z. B. 500000"
              />
            </Field>

            <Field label="Ticketgröße max. (EUR)">
              <input
                type="number"
                value={form.ticket_size_max_eur ?? ""}
                onChange={(e) =>
                  update(
                    "ticket_size_max_eur",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="input"
                placeholder="z. B. 5000000"
              />
            </Field>

            <Field label="Fokus">
              <select
                value={form.focus}
                onChange={(e) => update("focus", e.target.value as InvestorFocus)}
                className="input"
              >
                {Object.entries(INVESTOR_FOCUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value as InvestorStatus)}
                className="input"
              >
                {Object.entries(INVESTOR_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Letzter Kontakt">
              <input
                type="date"
                value={form.last_contact_at ?? ""}
                onChange={(e) => update("last_contact_at", e.target.value || null)}
                className="input"
              />
            </Field>

            <Field label="Nächster Kontakt">
              <input
                type="date"
                value={form.next_contact_at ?? ""}
                onChange={(e) => update("next_contact_at", e.target.value || null)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Notizen" full>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Gesprächsnotizen, Konditionen, Präferenzen…"
            />
          </Field>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-600 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave || isPending}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ background: "#5CB800" }}
          >
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

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[11.5px] font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
