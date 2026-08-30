"use client";

import { Landmark, Users, Wallet } from "lucide-react";
import type { InvestorDashboardKpis } from "@/types/investors";

function formatEurCompact(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: typeof Landmark;
  accent: string;
}

function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 md:p-4">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
        style={{ background: `${accent}18`, boxShadow: `0 0 22px ${accent}24` }}
      >
        <Icon size={17} color={accent} strokeWidth={2.3} />
      </div>
      <div>
        <div className="truncate text-[20px] font-semibold leading-none tabular-nums text-[#1B2C4E] md:text-[22px]">{value}</div>
        <div className="mt-1 text-[11px] leading-tight text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function InvestorKpiBar({ kpis }: { kpis: InvestorDashboardKpis }) {
  return (
    <div className="mb-5 grid grid-cols-3 gap-2.5 md:gap-3">
      <KpiCard label="Investoren" value={kpis.totalInvestors} icon={Users} accent="#75EE35" />
      <KpiCard label="Aktiv" value={kpis.activeInvestors} icon={Landmark} accent="#5CB800" />
      <KpiCard label="Investitionsvolumen" value={formatEurCompact(kpis.totalTicketVolumeEur)} icon={Wallet} accent="#0E7C86" />
    </div>
  );
}
