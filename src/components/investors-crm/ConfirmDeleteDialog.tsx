// src/components/investors/ConfirmDeleteDialog.tsx
"use client";

import { useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { deleteInvestor } from "@/lib/actions/investorActions";
import type { Investor } from "@/types/investors";

interface ConfirmDeleteDialogProps {
  investor: Investor;
  onCancel: () => void;
  onDeleted: () => void;
}

export function ConfirmDeleteDialog({
  investor,
  onCancel,
  onDeleted,
}: ConfirmDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteInvestor(investor.id);
      if (result.success) {
        onDeleted();
      }
      // Bei Fehler bleibt der Dialog offen; ein Toast-System kann hier
      // result.error anzeigen, falls in deinem Projekt vorhanden.
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
          style={{ background: "#C2410C14" }}
        >
          <AlertCircle size={18} color="#C2410C" />
        </div>
        <h3 className="font-semibold text-[15px] text-slate-800 mb-1.5">
          Investor löschen?
        </h3>
        <p className="text-[12.5px] text-slate-500 leading-relaxed mb-5">
          „{investor.company_name}" wird dauerhaft entfernt, inklusive
          Kontakthistorie, Notizen und Projektverknüpfungen. Diese Aktion kann
          nicht rückgängig gemacht werden.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium border border-slate-200 text-slate-600 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60"
            style={{ background: "#C2410C" }}
          >
            {isPending ? "Löscht…" : "Endgültig löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}
