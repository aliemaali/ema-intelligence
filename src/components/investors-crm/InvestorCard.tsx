"use client";

import { useState } from "react";
import { ExternalLink, Globe2, Mail, Pencil, Trash2, Link2, FileText } from "lucide-react";
import type { InvestorWithStats } from "@/types/investors";
import { INVESTOR_STATUS_LABELS, INVESTOR_FOCUS_LABELS } from "@/types/investors";
import {
  getAutomaticInvestorLogoUrl,
  getInvestorFlagUrl,
  getInvestorInitials,
  normalizeInvestorWebsite,
} from "@/lib/investors/identity";

const STATUS_COLORS: Record<string, string> = {
  Neu: "#64748B",
  Kontaktiert: "#0E7C86",
  DD_laeuft: "#B8860B",
  Angebot_gesendet: "#7A4FBF",
  Investiert: "#5CB800",
  Inaktiv: "#94A3B8",
};

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
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = investor.logo_url || getAutomaticInvestorLogoUrl(investor.website);
  const flagUrl = getInvestorFlagUrl(investor.country);
  const website = normalizeInvestorWebsite(investor.website);
  const investmentVolumeRange = investor.ticket_size_min_eur != null || investor.ticket_size_max_eur != null
    ? `${formatEur(investor.ticket_size_min_eur)} – ${formatEur(investor.ticket_size_max_eur)}`
    : "Investitionsvolumen nicht erfasst";

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col" style={{ borderLeft: `3px solid ${statusColor}` }}>
      <div className="p-4 flex-1 cursor-pointer" onClick={() => onOpen(investor.id)}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-100 bg-white text-[11px] font-bold text-[#1B2C4E]">
              {logoUrl && !logoFailed ? (
                <img src={logoUrl} alt={`${investor.company_name} Logo`} className="h-full w-full object-contain p-1" onError={() => setLogoFailed(true)} />
              ) : (
                getInvestorInitials(investor.company_name)
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[14px] text-slate-800 truncate leading-snug">{investor.company_name}</div>
              <div className="text-[12px] text-slate-500 truncate">{investor.contact_person}</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium shrink-0" style={{ background: `${statusColor}18`, color: statusColor }}>{INVESTOR_STATUS_LABELS[investor.status]}</span>
        </div>

        <div className="mb-2 flex items-center gap-2 text-[11.5px] text-slate-500">
          {flagUrl ? <img src={flagUrl} alt="" className="h-3.5 w-5 rounded-sm object-cover shadow-sm" /> : <Globe2 size={13} />}
          <span>{investor.country || "Land nicht erfasst"}</span>
        </div>

        {website ? (
          <a href={website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="mb-3 flex items-center gap-1.5 truncate text-[11.5px] font-medium text-[#0E7C86] hover:underline">
            <ExternalLink size={12} />
            {new URL(website).hostname.replace(/^www\./, "")}
          </a>
        ) : (
          <div className="mb-3 flex items-center gap-1.5 text-[11.5px] text-slate-400"><Globe2 size={12} />Website nicht erfasst</div>
        )}

        <div className="flex items-center gap-1.5 mb-3">
          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-600">{INVESTOR_FOCUS_LABELS[investor.focus]}</span>
          <span className="text-[11.5px] text-slate-400">{investmentVolumeRange}</span>
        </div>
        {investor.notes && <p className="text-[12px] text-slate-500 leading-snug line-clamp-2 mb-3">{investor.notes}</p>}
        <div className="flex items-center text-[11.5px] text-slate-400 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1"><Link2 size={12} />{investor.project_count} Projekt{investor.project_count === 1 ? "" : "e"}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-slate-100">
        <a href={`mailto:${investor.email}`} onClick={(event) => event.stopPropagation()} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium hover:bg-slate-50" style={{ color: "#1B2C4E" }}><Mail size={13} /> Mail</a>
        <a href={`/investors/${investor.id}`} onClick={(event) => event.stopPropagation()} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 border-l border-slate-100"><FileText size={13} /> Dokumente</a>
        <button onClick={(event) => { event.stopPropagation(); onEdit(investor); }} className="flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 border-l border-slate-100"><Pencil size={13} /> Bearbeiten</button>
        <button onClick={(event) => { event.stopPropagation(); onDelete(investor); }} className="flex items-center justify-center hover:bg-red-50 border-l border-slate-100"><Trash2 size={13} color="#C2410C" /></button>
      </div>
    </div>
  );
}
