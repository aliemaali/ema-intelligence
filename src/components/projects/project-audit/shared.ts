import type { Severity } from '@/lib/pdf/projectAuditPdf'

export const auditNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
export const auditMoney = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const auditMoneyPerKwp = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function fallbackProjectImage(type: string) {
  if (type === 'pv_dach') return '/project-dach.svg'
  if (type === 'bess') return '/project-bess.svg'
  if (type === 'wind') return '/hero-wind.svg'
  if (type === 'rechenzentrum') return '/hero-datacenter.webp'
  if (type === 'sonstiges') return '/hero-generic-project.svg'
  return '/project-freiflaeche.svg'
}

export function auditStatusMeta(severity: Severity) {
  if (severity === 'error') return { title: 'Fehler', subtitle: 'Unplausibel', dot: 'bg-red-600', text: 'text-red-700', badge: 'bg-red-50 text-red-700', panel: 'border-red-200 bg-red-50/70' }
  if (severity === 'missing') return { title: 'Fehlt', subtitle: 'Fehlende Werte', dot: 'bg-slate-500', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700', panel: 'border-slate-200 bg-slate-50' }
  if (severity === 'warning') return { title: 'Prüfen', subtitle: 'Auffälliger Wert', dot: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-700', panel: 'border-amber-200 bg-amber-50/70' }
  return { title: 'OK', subtitle: 'Plausibel', dot: 'bg-[#5CB800]', text: 'text-[#4E9D00]', badge: 'bg-[#5CB800]/10 text-[#4E9D00]', panel: 'border-[#5CB800]/20 bg-[#5CB800]/5' }
}
