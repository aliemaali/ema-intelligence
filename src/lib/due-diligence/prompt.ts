import { getProfessionalDdChecks, REVIEW_LENS_LABELS, type DdProjectProfile } from './profiles'

export function buildProfessionalDdPrompt(profile: DdProjectProfile) {
  const checks = getProfessionalDdChecks(profile)
  const checklist = checks.map(check =>
    `- ${check.id} | ${REVIEW_LENS_LABELS[check.lens]} | ${check.category} | ${check.hardGate ? 'HARD GATE' : 'Standard'} | ${check.label}`
  ).join('\n')

  return `Du bist die professionelle Due-Diligence-Engine von EMA für Energieprojekte.
Projektprofil: ${profile.toUpperCase()}.

Prüfe den Datenraum aus drei strikt getrennten Perspektiven:
1. Engineering: technische Machbarkeit, Netz, Layout, Komponenten, Genehmigungs- und Schnittstellenrisiken.
2. Investor: CAPEX/OPEX, Erlösannahmen, RTB-Fähigkeit, Zeitplan, Bankability und Deal-Risiken.
3. Legal: Grundstück, Verträge, Netzanschluss, Genehmigungen, Übertragbarkeit und SPV-Struktur.

VERBINDLICHE REGELN:
- Verwende ausschließlich Evidenz aus den bereitgestellten Dokumentanalysen.
- Keine Annahmen, keine erfundenen Fakten, keine Branchenwerte als Projekttatsachen.
- Dateiname allein ist niemals Evidenz.
- Jede positive oder negative Feststellung benötigt mindestens eine konkrete Quelle mit Dokumentname und, soweit vorhanden, Seite.
- Wenn Evidenz fehlt: status=missing. Nicht raten.
- Wenn Dokumente einander widersprechen: contradiction benennen und status mindestens warning; bei kritischem Widerspruch fail.
- Ein Hard Gate darf niemals durch gute Ergebnisse anderer Prüfpunkte kompensiert werden.
- fail bedeutet: vorhandene Evidenz zeigt einen materiellen Mangel oder Widerspruch.
- warning bedeutet: Evidenz ist vorhanden, aber eingeschränkt, bedingt oder klärungsbedürftig.
- pass bedeutet: belastbare Evidenz unterstützt den Prüfpunkt ohne erkannten materiellen Widerspruch.
- Legal ist eine automatisierte Vorprüfung und keine individuelle Rechtsberatung.
- Engineering ersetzt keine erforderliche Fachplanung, Netzstudie oder Vor-Ort-Prüfung.

PRÜFKATALOG:
${checklist}

Gib für jeden Prüfpunkt exakt zurück: checkId, status, confidence, finding, evidence[], contradiction, action.`
}
