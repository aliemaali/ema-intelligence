'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Eye, Link2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Project = { id: string; project_name: string | null; project_number: string | null; location_city: string | null; project_type: string | null }
type Assignment = { id: string; project_id: string; status: string; expose_sent_at: string | null; notes: string | null }
type Props = { investorId: string; projects: Project[]; assignments: Assignment[] }

const STATUS_OPTIONS = [
  ['vorgemerkt', 'Vorgemerkt'],
  ['expose_versendet', 'Exposé versendet'],
  ['interesse', 'Interesse'],
  ['kein_interesse', 'Kein Interesse'],
  ['rueckmeldung_offen', 'Rückmeldung offen'],
] as const

export function InvestorProjectAssignments({ investorId, projects, assignments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [saving, setSaving] = useState(false)
  const assignedProjectIds = useMemo(() => new Set(assignments.map((item) => item.project_id)), [assignments])
  const availableProjects = projects.filter((project) => !assignedProjectIds.has(project.id))
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])

  async function addAssignment() {
    if (!selectedProjectId) return toast.error('Bitte ein Projekt auswählen.')
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) { setSaving(false); return toast.error('Nicht angemeldet.') }
    const { error } = await (supabase as any).from('investor_project_assignments').insert({ user_id: user.id, investor_id: investorId, project_id: selectedProjectId, status: 'vorgemerkt' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Projekt wurde zugeordnet.')
    setSelectedProjectId('')
    setOpen(false)
    router.refresh()
  }

  async function updateStatus(assignment: Assignment, status: string) {
    const payload: Record<string, unknown> = { status }
    if (status === 'expose_versendet' && !assignment.expose_sent_at) payload.expose_sent_at = new Date().toISOString()
    const { error } = await (supabase as any).from('investor_project_assignments').update(payload).eq('id', assignment.id)
    if (error) return toast.error(error.message)
    toast.success('Status aktualisiert.')
    router.refresh()
  }

  async function removeAssignment(assignment: Assignment) {
    const project = projectById.get(assignment.project_id)
    if (!window.confirm(`Zuordnung zu „${project?.project_name || project?.project_number || 'Projekt'}“ entfernen?`)) return
    const { error } = await (supabase as any).from('investor_project_assignments').delete().eq('id', assignment.id)
    if (error) return toast.error(error.message)
    toast.success('Zuordnung entfernt.')
    router.refresh()
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-lg font-extrabold text-[#07142F]">Zugeordnete Projekte</h2><p className="mt-1 text-sm text-slate-500">{assignments.length} Projekt{assignments.length === 1 ? '' : 'e'} mit aktuellem Exposé</p></div>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0"><Plus className="h-4 w-4" /> Projekt zuordnen</button>
    </div>

    <div className="mt-5 space-y-3">
      {assignments.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center"><Link2 className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-bold text-[#07142F]">Noch kein Projekt zugeordnet</p></div> : assignments.map((assignment) => {
        const project = projectById.get(assignment.project_id)
        if (!project) return null
        return <div key={assignment.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-extrabold text-[#07142F]">{project.project_name || project.project_number || 'Projekt'}</p><p className="mt-1 text-xs text-slate-500">{[project.project_number, project.location_city, project.project_type].filter(Boolean).join(' · ')}</p>{assignment.expose_sent_at && <p className="mt-1 text-xs font-bold text-[#2F8A00]">Exposé versendet am {new Date(assignment.expose_sent_at).toLocaleDateString('de-DE')}</p>}</div><button type="button" onClick={() => removeAssignment(assignment)} className="btn-icon shrink-0 text-red-600" aria-label="Zuordnung entfernen"><Trash2 className="h-4 w-4" /></button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><select className="form-input" value={assignment.status} onChange={(event) => updateStatus(assignment, event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Link href={`/expose/${project.id}`} className="btn-secondary justify-center"><Eye className="h-4 w-4" /> Exposé ansehen</Link></div>
        </div>
      })}
    </div>

    {open && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-3 md:items-center"><div className="w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#2F8A00]">Investor</p><h3 className="mt-1 text-xl font-extrabold text-[#07142F]">Projekt zuordnen</h3></div><button type="button" onClick={() => setOpen(false)} className="btn-icon"><X className="h-5 w-5" /></button></div><select autoFocus className="form-input mt-5 w-full" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="">Projekt auswählen</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.project_name || project.project_number || 'Projekt'}{project.project_number ? ` · ${project.project_number}` : ''}</option>)}</select>{availableProjects.length === 0 && <p className="mt-3 text-sm text-slate-500">Alle aktiven Projekte sind bereits zugeordnet.</p>}<button type="button" onClick={addAssignment} disabled={!selectedProjectId || saving} className="btn-primary mt-5 w-full justify-center">{saving ? 'Wird gespeichert…' : 'Zuordnung speichern'}</button></div></div>}
  </section>
}
