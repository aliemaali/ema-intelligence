import Link from 'next/link'
import { FileSignature } from 'lucide-react'

export function NdaGeneratorCard() {
  return <section className="dms-generator-card mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#8eee51]"><FileSignature className="h-6 w-6" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-white">NDA</h2><p className="mt-1 text-sm leading-5 text-slate-300">Investor auswählen und eine gemeinsame PDF auf Deutsch und Englisch erstellen.</p><Link href="/dms/nda/new" target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">Erstellen</Link></div></div></section>
}
