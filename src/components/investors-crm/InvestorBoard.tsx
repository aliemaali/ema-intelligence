"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { InvestorCard } from "./InvestorCard";
import { InvestorKpiBar } from "./InvestorKpiBar";
import { InvestorFilterBar } from "./InvestorFilterBar";
import { InvestorFormModal } from "./InvestorFormModal";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { getInvestors, getInvestorDashboardKpis } from "@/lib/actions/investorActions";
import type { Investor, InvestorDashboardKpis, InvestorFilters, InvestorWithStats } from "@/types/investors";

interface ProjectOption { id: string; name: string }
interface InvestorBoardProps {
  initialInvestors: InvestorWithStats[];
  initialKpis: InvestorDashboardKpis;
  projects: ProjectOption[];
}

export function InvestorBoard({ initialInvestors, initialKpis, projects }: InvestorBoardProps) {
  const [investors, setInvestors] = useState<InvestorWithStats[]>(initialInvestors);
  const [kpis, setKpis] = useState(initialKpis);
  const [filters, setFilters] = useState<InvestorFilters>({ search: "", status: "Alle", focus: "Alle", projectId: "Alle", sortBy: "company_name", sortDirection: "asc" });
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
    <div className="mb-5 flex items-start justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">CRM</p><h1 className="mt-1 text-[24px] font-extrabold tracking-tight text-[#1B2C4E] md:text-[30px]">Investoren</h1><p className="mt-1 text-[13px] text-slate-500">Suchprofile, Projektzuordnungen und Dokumente zentral verwalten.</p></div>
      <button onClick={() => setEditing("new")} className="hidden items-center gap-2 rounded-xl bg-[#5CB800] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm md:flex"><Plus size={16} /> Neuer Investor</button>
    </div>

    <InvestorKpiBar kpis={kpis} />
    <InvestorFilterBar filters={filters} onChange={setFilters} projects={projects} />

    <div className="mb-3 flex items-center justify-between">
      <div className="text-[12.5px] text-slate-400">{isPending ? "Wird aktualisiert…" : `${investors.length} Investor${investors.length === 1 ? "" : "en"}`}</div>
    </div>

    <button aria-label="Neuen Investor anlegen" onClick={() => setEditing("new")} className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#5CB800] shadow-lg md:hidden"><Plus size={20} color="white" /></button>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {investors.map((investor) => <InvestorCard key={investor.id} investor={investor} onOpen={() => setEditing(investor)} onEdit={() => setEditing(investor)} onDelete={() => setDeleting(investor)} />)}
      {!investors.length && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-[13px] text-slate-500">Keine Investoren für diese Auswahl gefunden.</div>}
    </div>

    {editing && <InvestorFormModal initial={editing === "new" ? null : editing} projects={projects} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    {deleting && <ConfirmDeleteDialog investor={deleting} onCancel={() => setDeleting(null)} onDeleted={() => { setDeleting(null); refresh(); }} />}
  </div>;
}
