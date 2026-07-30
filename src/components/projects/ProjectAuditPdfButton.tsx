import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'

interface ProjectAuditPdfButtonProps {
  projectIds: string[]
}

export function ProjectAuditPdfButton({ projectIds }: ProjectAuditPdfButtonProps) {
  const disabled = projectIds.length === 0

  if (disabled) {
    return <span aria-disabled="true" className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-400 shadow-sm">
      <ClipboardCheck className="h-4 w-4" /> Projektprüfung
    </span>
  }

  return <Link href="/projects/audit" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-sm transition hover:border-[#5CB800]/50 hover:bg-[#5CB800]/5">
    <ClipboardCheck className="h-4 w-4 text-[#5CB800]" /> Projektprüfung
  </Link>
}
