// src/components/investors/InvestorBoard.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, LayoutGrid, Table as TableIcon } from "lucide-react";
import { InvestorCard } from "./InvestorCard";
import { InvestorKpiBar } from "./InvestorKpiBar";
import { InvestorFilterBar } from "./InvestorFilterBar";
import { InvestorFormModal } from "./InvestorFormModal";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { getInvestors, getInvestorDashboardKpis } from "@/lib/actions/investorActions";
import type {
  Investor,
  InvestorWithStats,
  InvestorFilters,
  InvestorDashboardKpis,
} from "@/types/investors";
import { INVESTOR_STATUS_LABELS, INVESTOR_FOCUS_LABELS } from "@/types/investors";

interface ProjectOption {
  id: string;
  name: string;
}

interface InvestorBoardProps {
  initialInvestors: InvestorWithStats[];
  initialKpis: InvestorDashboardKpis;
  projects: ProjectOption[];
}

export function InvestorBoard({
  initialInvestors,
  initialKpis,
  projects,
}: InvestorBoardProps) {
  const [investors, setInvestors] = useState<InvestorWithStats[]>(initialInvestors);
  const [kpis, setKpis] = useState<InvestorDashboardKpis>(initialKpis);
  const [filters, setFilters] = useState<InvestorFilters>({
    search: "",
    status: "Alle",
    focus: "Alle",
    projectId: "Alle",
    sortBy: "last_contact_at",
    sortDirection: "desc",
  });
  const [view, setView] = useState<"cards" | "table">("cards");
  const [editing, setEditing] = useState<Investor | "new" | null>(null);
  const [deleting, setDeleting] = useState<Investor | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    startTransition(async () => {
      const [investorsResult, kpisResult] = await Promise.all([
        getInvestors(filters),
        getInvestorDashboardKpis(),
      ]);
      if (investorsResult.success) setInvestors(investorsResult.data);
      if (kpisResult.success) setKpis(kpisResult.data);
    });
  }

  // Re-fetch bei Filteränderung (debounced für die Textsuche)
  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await getInvestors(filters);
        if (result.success) setInvestors(result.data);
      });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const filteredCount = investors.length;

  function handleSaved() {
    setEditing(null);
    refresh();
  }

  function handleDeleted() {
    setDeleting(null);
    refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold tracking-tight" style={{ color: "#1B2C4E" }}>
            Investoren
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Investoren-Pipeline für PV- und BESS-Projekte
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13.5px] font-medium shadow-sm transition-transform hover:scale-[1.02]"
          style={{ background: "#5CB800" }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Neuer Investor
        </button>
      </div>

      <InvestorKpiBar kpis={kpis} />

      <InvestorFilterBar filters={filters} onChange={setFilters} projects={projects} />

      <div className="flex items-center justify-between mb-3">
        <div className="text-[12.5px] text-slate-400">
          {isPending ? "Aktualisiert…" : `${filteredCount} Investor${filteredCount === 1 ? "" : "en"} gefunden`}
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            onClick={() => setView("cards")}
            className="p-2 rounded-md transition-colors"
            style={{ background: view === "cards" ? "#1B2C4E" : "transparent" }}
          >
            <LayoutGrid size={15} color={view === "cards" ? "white" : "#64748B"} />
          </button>
          <button
            onClick={() => setView("table")}
            className="p-2 rounded-md transition-colors"
            style={{ background: view === "table" ? "#1B2C4E" : "transparent" }}
          >
            <TableIcon size={15} color={view === "table" ? "white" : "#64748B"} />
          </button>
        </div>
      </div>

      {/* Mobile: floating add button */}
      <button
        onClick={() => setEditing("new")}
        className="md:hidden fixed bottom-5 right-5 z-30 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: "#5CB800" }}
      >
        <Plus size={20} color="white" strokeWidth={2.5} />
      </button>

      {view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {investors.map((investor) => (
            <InvestorCard
              key={investor.id}
              investor={investor}
              onOpen={() => setEditing(investor)}
              onEdit={() => setEditing(investor)}
              onDelete={() => setDeleting(investor)}
            />
          ))}
          {investors.length === 0 && (
            <div className="col-span-full text-center py-14 text-[13px] text-slate-500">
              Keine Investoren gefunden. Passe die Filter an oder lege einen neuen Investor an.
            </div>
          )}
        </div>
      ) : (
        <InvestorTable
          investors={investors}
          onEdit={(inv) => setEditing(inv)}
          onDelete={(inv) => setDeleting(inv)}
        />
      )}

      {editing && (
        <InvestorFormModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ConfirmDeleteDialog
          investor={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function InvestorTable({
  investors,
  onEdit,
  onDelete,
}: {
  investors: InvestorWithStats[];
  onEdit: (investor: InvestorWithStats) => void;
  onDelete: (investor: InvestorWithStats) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: "#F8FAFC" }} className="text-left text-slate-500 text-[11.5px] uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Firma</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Ansprechpartner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Fokus</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Letzter Kontakt</th>
              <th className="px-4 py-3 font-medium hidden xl:table-cell">Projekte</th>
              <th className="px-4 py-3 font-medium text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {investors.map((investor) => (
              <tr
                key={investor.id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onEdit(investor)}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{investor.company_name}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{investor.contact_person}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                    {INVESTOR_STATUS_LABELS[investor.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                  {INVESTOR_FOCUS_LABELS[investor.focus]}
                </td>
                <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                  {formatDate(investor.last_contact_at)}
                </td>
                <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">
                  {investor.project_count} zugeordnet
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit(investor)}
                    className="text-[12px] font-medium mr-3"
                    style={{ color: "#1B2C4E" }}
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => onDelete(investor)}
                    className="text-[12px] font-medium"
                    style={{ color: "#C2410C" }}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {investors.length === 0 && (
          <div className="text-center py-14 text-[13px] text-slate-500">
            Keine Investoren gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
