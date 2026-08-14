"use client";

import { Mail, Landmark, Pencil, Trash2, Link2, Sun, Battery, FileText, MapPin } from "lucide-react";
import type { InvestorWithStats } from "@/types/investors";
import { INVESTOR_STATUS_LABELS, INVESTOR_FOCUS_LABELS } from "@/types/investors";

const STATUS_COLORS: Record<string, string> = {
  Neu: "#64748B",
  Kontaktiert: "#0E7C86",
  DD_laeuft: "#B8860B",
  Angebot_gesendet: "#7A4FBF",
  Investiert: "#5CB800",
  Inaktiv: "#94A3B8",
};

const FOCUS_ICON: Record<string, typeof Sun> = { PV: Sun, BESS: Battery, PV_BESS: Landmark };

function formatEur(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

interface InvestorCardProps {
  investor: InvestorWithStats;
  onOpen: (id: string) => void;
  onEdit: (investor: InvestorWithStats) => void;
  onDelete: (investor: InvestorWithStats) => void;
}

export function InvestorCard({ investor, onOpen, onEdit, onDelete }: InvestorCardProps) {
  const statusColor = STATUS_COLORS[investor.status] ?? "#64748B";
  const FocusIcon = FOCUS_ICON[investor.focus] ?? Landmark;
  const investmentVolumeRange = investor.ticket_size_min_eur != null || investor.ticket_size_max_eur != null
    ? `${formatEur(investor.ticket_size_min_eur)} – ${formatEur(investor.ticket_size_max_eur)}`
    : "Investitionsvolumen offen";
  const address = [
    investor.street_address,
    [investor.postal_code, investor.location_city].filter(Boolean).join(" "),
    investor.location_country,
  ].filter(Boolean).join(", ");

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md" style={{ borderLeft: `3px solid ${statusColor}` }}>
      <button type="button" className="flex-1 p-4 text-left" onClick={() => onOpen(investor.id)}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B2C4E]/[0.08]"><FocusIcon size={16} color="#1B2C4E" strokeWidth={2} /></div>
            <div className="min-w-0"><div className="truncate text-[14px] font-semibold leading-snug text-slate-800">{investor.company_name}</div>{investor.contact_person && <div className="truncate text-[12px] text-slate-500">{investor.contact_person}</div>}</div>
          </div>
          <span className="shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-medium" style={{ background: `${statusColor}18`, color: statusColor }}>{INVESTOR_STATUS_LABELS[investor.status]}</span>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">{INVESTOR_FOCUS_LABELS[investor.focus]}</span><span className="text-[11.5px] text-slate-500">{investmentVolumeRange}</span></div>
        {investor.notes && <p className="mb-3 line-clamp-2 text-[12px] leading-snug text-slate-500">{investor.notes}</p>}
        {address && <p className="mb-3 flex items-start gap-1.5 text-[11.5px] leading-snug text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0 text-[#5CB800]" /><span className="line-clamp-2">{address}</span></p>}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11.5px] text-slate-400"><span className="flex items-center gap-1"><Link2 size={12} />{investor.project_count} Projekt{investor.project_count === 1 ? "" : "e"}</span><span>{investor.email || "E-Mail offen"}</span></div>
      </button>

      <div className="grid grid-cols-4 border-t border-slate-100">
        <a href={`mailto:${investor.email}`} onClick={(event) => event.stopPropagation()} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-[#1B2C4E] hover:bg-slate-50"><Mail size={13} /> Mail</a>
        <a href={`/investors/${investor.id}`} onClick={(event) => event.stopPropagation()} className="flex items-center justify-center gap-1 border-l border-slate-100 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"><FileText size={13} /> Akte</a>
        <button onClick={(event) => { event.stopPropagation(); onEdit(investor); }} className="flex items-center justify-center gap-1 border-l border-slate-100 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50"><Pencil size={13} /> Bearbeiten</button>
        <button aria-label="Investor löschen" onClick={(event) => { event.stopPropagation(); onDelete(investor); }} className="flex items-center justify-center border-l border-slate-100 hover:bg-red-50"><Trash2 size={13} color="#C2410C" /></button>
      </div>
    </article>
  );
}
