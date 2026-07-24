// src/components/investors/InvestorFilterBar.tsx
"use client";

import { Search, Filter, ChevronDown, Link2 } from "lucide-react";
import type { InvestorFilters } from "@/types/investors";
import { INVESTOR_STATUS_LABELS, INVESTOR_FOCUS_LABELS } from "@/types/investors";

interface ProjectOption {
  id: string;
  name: string;
}

interface InvestorFilterBarProps {
  filters: InvestorFilters;
  onChange: (filters: InvestorFilters) => void;
  projects: ProjectOption[];
}

function SelectPill({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: typeof Search;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative shrink-0">
      <Icon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <select value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none pl-7 pr-7 py-2.5 rounded-lg border border-slate-200 bg-white text-[12.5px] font-medium text-slate-600 outline-none cursor-pointer">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

export function InvestorFilterBar({ filters, onChange, projects }: InvestorFilterBarProps) {
  const statusOptions = [
    { value: "Alle", label: "Alle Status" },
    ...Object.entries(INVESTOR_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  ];
  const focusOptions = [
    { value: "Alle", label: "Alle Fokus" },
    ...Object.entries(INVESTOR_FOCUS_LABELS).map(([value, label]) => ({ value, label })),
  ];
  const projectOptions = [
    { value: "Alle", label: "Alle Projekte" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  const sortOptions = [
    { value: "company_name:asc", label: "Name A–Z" },
    { value: "company_name:desc", label: "Name Z–A" },
    { value: "created_at:desc", label: "Zuletzt angelegt" },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={filters.search ?? ""}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Firma, Ansprechpartner, Website oder Land suchen…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13.5px] outline-none focus:ring-2 transition-shadow"
          onFocus={(event) => (event.target.style.boxShadow = "0 0 0 3px rgba(92,184,0,0.25)")}
          onBlur={(event) => (event.target.style.boxShadow = "none")}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto md:overflow-visible">
        <SelectPill icon={Filter} value={filters.status ?? "Alle"} onChange={(value) => onChange({ ...filters, status: value as InvestorFilters["status"] })} options={statusOptions} />
        <SelectPill icon={Filter} value={filters.focus ?? "Alle"} onChange={(value) => onChange({ ...filters, focus: value as InvestorFilters["focus"] })} options={focusOptions} />
        <SelectPill icon={Link2} value={filters.projectId ?? "Alle"} onChange={(value) => onChange({ ...filters, projectId: value })} options={projectOptions} />
        <SelectPill
          icon={ChevronDown}
          value={`${filters.sortBy ?? "company_name"}:${filters.sortDirection ?? "asc"}`}
          onChange={(value) => {
            const [sortBy, sortDirection] = value.split(":") as [InvestorFilters["sortBy"], InvestorFilters["sortDirection"]];
            onChange({ ...filters, sortBy, sortDirection });
          }}
          options={sortOptions}
        />
      </div>
    </div>
  );
}
