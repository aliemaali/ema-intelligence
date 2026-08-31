import Link from 'next/link'
import { FileSignature } from 'lucide-react'

export function NdaGeneratorCard() {
  return <section className="dms-generator-card mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-7"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5CB800]/12 text-[#8eee51]"><FileSignature className="h-6 w-6" /></span><div><h2 className="text-xl font-extrabold text-white">NDA</h2><p className="mt-1 text-sm text-slate-300">Investor auswählen und eine gemeinsame PDF auf Deutsch und Englisch erstellen.</p></div></div><Link href="/dms/nda/new" target="_blank" rel="noopener noreferrer" className="btn-primary shrink-0">Erstellen</Link></div></section>
}
