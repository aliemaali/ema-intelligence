// src/components/investors/InvestorKpiBar.tsx
"use client";

import { Landmark, Users, Wallet, Clock } from "lucide-react";
import type { InvestorDashboardKpis } from "@/types/investors";

function formatEurCompact(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: typeof Landmark;
  accent: string;
}

function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 md:p-4 flex flex-col gap-2">
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center"
        style={{ background: `${accent}14` }}
      >
        <Icon size={14} color={accent} strokeWidth={2.2} />
      </div>
      <div>
        <div
          className="text-[20px] md:text-[22px] font-semibold tabular-nums leading-none"
          style={{ color: "#1B2C4E" }}
        >
          {value}
        </div>
        <div className="text-[11px] text-slate-500 mt-1 leading-tight">{label}</div>
      </div>
    </div>
  );
}

export function InvestorKpiBar({ kpis }: { kpis: InvestorDashboardKpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <KpiCard
        label="Investoren gesamt"
        value={kpis.totalInvestors}
        icon={Users}
        accent="#1B2C4E"
      />
      <KpiCard
        label="Aktive Investoren"
        value={kpis.activeInvestors}
        icon={Landmark}
        accent="#5CB800"
      />
      <KpiCard
        label="Investitionsvolumen gesamt"
        value={formatEurCompact(kpis.totalTicketVolumeEur)}
        icon={Wallet}
        accent="#0E7C86"
      />
      <KpiCard
        label="Letzter Kontakt"
        value={formatDate(kpis.mostRecentContactAt)}
        icon={Clock}
        accent="#B8860B"
      />
    </div>
  );
}
