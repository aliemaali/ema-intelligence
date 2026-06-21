// src/app/investors/page.tsx
//
// Server Component: lädt initiale Investoren + KPIs + Projektliste serverseitig
// (für schnellen First Paint, kein Lade-Spinner beim ersten Render) und
// übergibt sie an die interaktive Client Component InvestorBoard.
//
// ANNAHME: Diese Datei ersetzt deine bestehende src/app/investors/page.tsx.
// Falls dort bereits Layout-Wrapper (z. B. ein Dashboard-Shell-Layout) aktiv
// sind, übernimm den <InvestorBoard /> Aufruf in deine bestehende Struktur
// statt die ganze Datei zu überschreiben.

import { createClient } from "@/lib/supabase/server";
import { getInvestors, getInvestorDashboardKpis } from "@/lib/actions/investorActions";
import { InvestorBoard } from "@/components/investors/InvestorBoard";

export const dynamic = "force-dynamic"; // CRM-Daten sollen nicht statisch gecacht werden

export default async function InvestorsPage() {
  const supabase = await createClient();

  // ANNAHME: bestehende projects-Tabelle hat Spalten `id` und `name`.
  // Passe die Spaltennamen an dein echtes Schema an, falls abweichend
  // (z. B. project_name statt name).
  const [investorsResult, kpisResult, projectsResult] = await Promise.all([
    getInvestors({ sortBy: "last_contact_at", sortDirection: "desc" }),
    getInvestorDashboardKpis(),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const initialInvestors = investorsResult.success ? investorsResult.data : [];
  const initialKpis = kpisResult.success
    ? kpisResult.data
    : {
        totalInvestors: 0,
        activeInvestors: 0,
        totalTicketVolumeEur: 0,
        contactedLast30Days: 0,
        mostRecentContactAt: null,
      };
  const projects = projectsResult.data ?? [];

  return (
    <div className="min-h-screen w-full" style={{ background: "#F4F6F9" }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        {!investorsResult.success && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-700">
            Investoren konnten nicht geladen werden: {investorsResult.error}
          </div>
        )}
        <InvestorBoard
          initialInvestors={initialInvestors}
          initialKpis={initialKpis}
          projects={projects}
        />
      </div>
    </div>
  );
}
