"use client";

import { Mail, Landmark, Pencil, Trash2, Link2, Sun, Battery, FileText } from "lucide-react";
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function relationshipDot(lastContact: string | null): string {
  if (!lastContact) return "#CBD5E1";
  const days = Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000);
  if (days <= 14) return "#5CB800";
  if (days <= 45) return "#B8860B";
  return "#C2410C";
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
  const dot = relationshipDot(investor.last_contact_at);
  const ticketRange = investor.ticket_size_min_eur != null || investor.ticket_size_max_eur != null
    ? `${formatEur(investor.ticket_size_min_eur)} – ${formatEur(investor.ticket_size_max_eur)}`
    : "Ticketgröße nicht erfasst";

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col" style={{ borderLeft: `3px solid ${statusColor}` }}>
      <div className="p-4 flex-1 cursor-pointer" onClick={() => onOpen(investor.id)}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#1B2C4E14" }}><FocusIcon size={16} color="#1B2C4E" strokeWidth={2} /></div>
            <div className="min-w-0"><div className="font-semibold text-[14px] text-slate-800 truncate leading-snug">{investor.company_name}</div><div className="text-[12px] text-slate-500 truncate">{investor.contact_person}</div></div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium shrink-0" style={{ background: `${statusColor}18`, color: statusColor }}>{INVESTOR_STATUS_LABELS[investor.status]}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} /><span className="text-[11.5px] text-slate-500">Letzter Kontakt: {formatDate(investor.last_contact_at)}</span></div>
        <div className="flex items-center gap-1.5 mb-3"><span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-600">{INVESTOR_FOCUS_LABELS[investor.focus]}</span><span className="text-[11.5px] text-slate-400">{ticketRange}</span></div>
        {investor.notes && <p className="text-[12px] text-slate-500 leading-snug line-clamp-2 mb-3">{investor.notes}</p>}
        <div className="flex items-center justify-between text-[11.5px] text-slate-400 pt-2 border-t border-slate-100"><span className="flex items-center gap-1"><Link2 size={12} />{investor.project_count} Projekt{investor.project_count === 1 ? "" : "e"}</span><span>Nächster Kontakt: {formatDate(investor.next_contact_at)}</span></div>
      </div>

      <div className="grid grid-cols-4 border-t border-slate-100">
        <a href={`mailto:${investor.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium hover:bg-slate-50" style={{ color: "#1B2C4E" }}><Mail size={13} /> Mail</a>
        <a href={`/investors/${investor.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 border-l border-slate-100"><FileText size={13} /> Dokumente</a>
        <button onClick={(e) => { e.stopPropagation(); onEdit(investor); }} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 border-l border-slate-100"><Pencil size={13} /> Bearbeiten</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(investor); }} className="flex items-center justify-center hover:bg-red-50 border-l border-slate-100"><Trash2 size={13} color="#C2410C" /></button>
      </div>
    </div>
  );
}
