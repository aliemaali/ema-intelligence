"use client";

import { useEffect, useState, useTransition } from "react";
import { LayoutGrid, Plus, Table as TableIcon } from "lucide-react";
import { InvestorCard } from "./InvestorCard";
import { InvestorKpiBar } from "./InvestorKpiBar";
import { InvestorFilterBar } from "./InvestorFilterBar";
import { InvestorFormModal } from "./InvestorFormModal";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { getInvestors, getInvestorDashboardKpis } from "@/lib/actions/investorActions";
import type { Investor, InvestorDashboardKpis, InvestorFilters, InvestorWithStats } from "@/types/investors";
import { INVESTOR_FOCUS_LABELS, INVESTOR_STATUS_LABELS } from "@/types/investors";

interface ProjectOption { id: string; name: string }
interface InvestorBoardProps {
  initialInvestors: InvestorWithStats[];
  initialKpis: InvestorDashboardKpis;
  projects: ProjectOption[];
}

export function InvestorBoard({ initialInvestors, initialKpis, projects }: InvestorBoardProps) {
  const [investors, setInvestors] = useState<InvestorWithStats[]>(initialInvestors);
  const [kpis, setKpis] = useState(initialKpis);
  const [filters, setFilters] = useState<InvestorFilters>({ search: "", status: "Alle", focus: "Alle", projectId: "Alle", sortBy: "last_contact_at", sortDirection: "desc" });
  const [view, setView] = useState<"cards" | "table">("cards");
  const [editing, setEditing] = useState<Investor | "new" | null>(null);
  const [deleting, setDeleting] = useState<Investor | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    startTransition(async () => {
      const [investorsResult, kpisResult] = await Promise.all([getInvestors(filters), getInvestorDashboardKpis()]);
      if (investorsResult.success) setInvestors(investorsResult.data);
      if (kpisResult.success) setKpis(kpisResult.data);
    });
  }

  useEffect(() => {
    const handle = setTimeout(() => startTransition(async () => {
      const result = await getInvestors(filters);
      if (result.success) setInvestors(result.data);
    }), 250);
    return () => clearTimeout(handle);
  }, [filters]);

  return <div>
    <div className="mb-6 flex items-center justify-between">
      <div><h1 className="text-[20px] font-semibold tracking-tight text-[#1B2C4E] md:text-[24px]">Investoren</h1><p className="mt-0.5 text-[13px] text-slate-500">Investoren-Pipeline für PV- und BESS-Projekte</p></div>
      <button onClick={() => setEditing("new")} className="hidden items-center gap-2 rounded-lg bg-[#5CB800] px-4 py-2.5 text-[13.5px] font-medium text-white shadow-sm md:flex"><Plus size={16} /> Neuer Investor</button>
    </div>

    <InvestorKpiBar kpis={kpis} />
    <InvestorFilterBar filters={filters} onChange={setFilters} projects={projects} />

    <div className="mb-3 flex items-center justify-between">
      <div className="text-[12.5px] text-slate-400">{isPending ? "Aktualisiert…" : `${investors.length} Investor${investors.length === 1 ? "" : "en"} gefunden`}</div>
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
        <button onClick={() => setView("cards")} className={`rounded-md p-2 ${view === "cards" ? "bg-[#1B2C4E]" : ""}`}><LayoutGrid size={15} color={view === "cards" ? "white" : "#64748B"} /></button>
        <button onClick={() => setView("table")} className={`rounded-md p-2 ${view === "table" ? "bg-[#1B2C4E]" : ""}`}><TableIcon size={15} color={view === "table" ? "white" : "#64748B"} /></button>
      </div>
    </div>

    <button onClick={() => setEditing("new")} className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#5CB800] shadow-lg md:hidden"><Plus size={20} color="white" /></button>

    {view === "cards" ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {investors.map((investor) => <InvestorCard key={investor.id} investor={investor} onOpen={() => setEditing(investor)} onEdit={() => setEditing(investor)} onDelete={() => setDeleting(investor)} />)}
      {!investors.length && <div className="col-span-full py-14 text-center text-[13px] text-slate-500">Keine Investoren gefunden.</div>}
    </div> : <InvestorTable investors={investors} onEdit={setEditing} onDelete={setDeleting} />}

    {editing && <InvestorFormModal initial={editing === "new" ? null : editing} projects={projects} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    {deleting && <ConfirmDeleteDialog investor={deleting} onCancel={() => setDeleting(null)} onDeleted={() => { setDeleting(null); refresh(); }} />}
  </div>;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

function InvestorTable({ investors, onEdit, onDelete }: { investors: InvestorWithStats[]; onEdit: (investor: InvestorWithStats) => void; onDelete: (investor: InvestorWithStats) => void }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-[13px]">
    <thead><tr className="bg-slate-50 text-left text-[11.5px] uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Firma</th><th className="hidden px-4 py-3 md:table-cell">Ansprechpartner</th><th className="px-4 py-3">Status</th><th className="hidden px-4 py-3 lg:table-cell">Fokus</th><th className="hidden px-4 py-3 lg:table-cell">Letzter Kontakt</th><th className="hidden px-4 py-3 xl:table-cell">Projekte</th><th className="px-4 py-3 text-right">Aktionen</th></tr></thead>
    <tbody>{investors.map((investor) => <tr key={investor.id} onClick={() => onEdit(investor)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">{investor.company_name}</td><td className="hidden px-4 py-3 text-slate-500 md:table-cell">{investor.contact_person}</td>
      <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{INVESTOR_STATUS_LABELS[investor.status]}</span></td>
      <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{INVESTOR_FOCUS_LABELS[investor.focus]}</td><td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDate(investor.last_contact_at)}</td><td className="hidden px-4 py-3 text-slate-500 xl:table-cell">{investor.project_count} zugeordnet</td>
      <td onClick={(e) => e.stopPropagation()} className="px-4 py-3 text-right"><button onClick={() => onEdit(investor)} className="mr-3 text-[12px] font-medium text-[#1B2C4E]">Bearbeiten</button><button onClick={() => onDelete(investor)} className="text-[12px] font-medium text-[#C2410C]">Löschen</button></td>
    </tr>)}</tbody>
  </table></div></div>;
}
