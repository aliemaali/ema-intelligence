'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ContactRound,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type Contact = {
  id: string
  name: string
  company: string
  role: string
  email: string
  phone: string
  initials: string
}

type ContactForm = {
  name: string
  company: string
  role: string
  email: string
  phone: string
}

type View = 'list' | 'edit' | 'delete'

function messageFromResponse(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }
  return fallback
}

function initialForm(contact: Contact): ContactForm {
  return {
    name: contact.name,
    company: contact.company,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
  }
}

export function MicrosoftContactManager() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('list')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactForm>({ name: '', company: '', role: '', email: '', phone: '' })

  async function loadContacts() {
    setLoading(true)
    try {
      const response = await fetch('/api/microsoft/contacts', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(messageFromResponse(payload, 'Kontakte konnten nicht geladen werden.'))
      setContacts(payload.contacts || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kontakte konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadContacts()
  }, [open])

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE')
    if (!normalized) return contacts
    return contacts.filter((contact) => [contact.name, contact.company, contact.role, contact.email, contact.phone]
      .some((value) => value.toLocaleLowerCase('de-DE').includes(normalized)))
  }, [contacts, query])

  function closeManager() {
    setOpen(false)
    setView('list')
    setActiveContact(null)
    setQuery('')
  }

  function editContact(contact: Contact) {
    setActiveContact(contact)
    setForm(initialForm(contact))
    setView('edit')
  }

  function confirmDelete(contact: Contact) {
    setActiveContact(contact)
    setView('delete')
  }

  function backToList() {
    setView('list')
    setActiveContact(null)
  }

  function permissionHint(message: string) {
    if (/privilege|permission|authorization|access|berechtigung|zugriff/i.test(message)) {
      return 'Microsoft 365 benötigt die neue Kontakt-Schreibberechtigung. Bitte Microsoft in EMA einmal trennen und danach neu verbinden.'
    }
    return message
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    if (!activeContact) return

    setSaving(true)
    try {
      const response = await fetch(`/api/microsoft/contacts/${encodeURIComponent(activeContact.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(messageFromResponse(payload, 'Kontakt konnte nicht geändert werden.'))

      toast.success('Kontakt wurde in Outlook aktualisiert.')
      await loadContacts()
      backToList()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kontakt konnte nicht geändert werden.'
      toast.error(permissionHint(message))
    } finally {
      setSaving(false)
    }
  }

  async function deleteContact() {
    if (!activeContact) return

    setSaving(true)
    try {
      const response = await fetch(`/api/microsoft/contacts/${encodeURIComponent(activeContact.id)}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(messageFromResponse(payload, 'Kontakt konnte nicht gelöscht werden.'))

      toast.success('Kontakt wurde aus Outlook gelöscht.')
      setContacts((current) => current.filter((contact) => contact.id !== activeContact.id))
      backToList()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kontakt konnte nicht gelöscht werden.'
      toast.error(permissionHint(message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+7.5rem)] right-4 z-[90] inline-flex items-center gap-2 rounded-full bg-[#1F2A44] px-4 py-3 text-sm font-extrabold text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 md:bottom-8 md:right-8"
        aria-label="Outlook-Kontakte bearbeiten oder löschen"
      >
        <ContactRound className="h-5 w-5" />
        Kontakte verwalten
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-[#07142F]/50 p-0 backdrop-blur-sm md:items-center md:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeManager() }}
        >
          <section className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:rounded-[2rem] md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5CB800]">Outlook-Kontakte</p>
                <h2 className="mt-2 text-2xl font-black text-[#07142F]">
                  {view === 'list' ? 'Kontakte verwalten' : view === 'edit' ? 'Kontakt bearbeiten' : 'Kontakt löschen'}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Änderungen werden direkt in deinem Microsoft-365-Konto gespeichert.
                </p>
              </div>
              <button type="button" onClick={closeManager} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100" aria-label="Schließen">
                <X className="h-5 w-5" />
              </button>
            </div>

            {view === 'list' && (
              <div className="mt-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Kontakt suchen"
                    aria-label="Kontakt suchen"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[#07142F] outline-none placeholder:text-slate-400 focus:border-[#5CB800]"
                  />
                </div>

                <div className="mt-4 space-y-3">
                  {loading && <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-[#5CB800]" /></div>}
                  {!loading && visibleContacts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">Keine passenden Kontakte gefunden.</div>
                  )}
                  {!loading && visibleContacts.map((contact) => (
                    <article key={contact.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#07142F] text-sm font-black text-white">{contact.initials}</div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-[#07142F]">{contact.name}</h3>
                          {(contact.company || contact.role) && <p className="mt-1 text-sm text-slate-500">{[contact.company, contact.role].filter(Boolean).join(' · ')}</p>}
                          <div className="mt-3 grid gap-1.5 text-sm text-slate-500">
                            {contact.email && <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{contact.email}</span></p>}
                            {contact.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{contact.phone}</p>}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={() => editContact(contact)} className="inline-flex items-center gap-2 rounded-xl bg-[#1F2A44] px-3 py-2 text-xs font-extrabold text-white"><Pencil className="h-4 w-4" /> Bearbeiten</button>
                            <button type="button" onClick={() => confirmDelete(contact)} className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700"><Trash2 className="h-4 w-4" /> Löschen</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {view === 'edit' && activeContact && (
              <form onSubmit={saveContact} className="mt-6 grid gap-4">
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">Name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">Unternehmen<input value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">Position<input value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">E-Mail<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">Telefon<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-[#07142F] outline-none focus:border-[#5CB800]" /></label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button type="button" onClick={backToList} disabled={saving} className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-extrabold text-slate-600 disabled:opacity-60">Abbrechen</button>
                  <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5CB800] px-4 py-3.5 font-extrabold text-white disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Speichern</button>
                </div>
              </form>
            )}

            {view === 'delete' && activeContact && (
              <div className="mt-6">
                <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700"><Trash2 className="h-6 w-6" /></div>
                  <h3 className="mt-4 text-xl font-black text-red-900">{activeContact.name} wirklich löschen?</h3>
                  <p className="mt-2 text-sm leading-6 text-red-800">Der Kontakt wird direkt aus Outlook gelöscht und verschwindet anschließend auch aus EMA. Diese Aktion betrifft den echten Microsoft-365-Kontakt.</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button type="button" onClick={backToList} disabled={saving} className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-extrabold text-slate-600 disabled:opacity-60">Abbrechen</button>
                  <button type="button" onClick={deleteContact} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3.5 font-extrabold text-white disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />} Aus Outlook löschen</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
