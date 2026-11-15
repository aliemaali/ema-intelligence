"use client";
import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { MailDialog } from "./MailDialog";
import { loadNameContacts, type NameContact } from "@/lib/mail/contact-names";
import type { MailPimItem } from "./MailPim";
import s from "./mail.module.css";

type Props = {
  sender: { name?: string; address: string };
  displayName: string;
  demo: boolean;
  demoContacts?: MailPimItem[];
  onSaved: (contact: MailPimItem) => void;
  onOpenContacts: () => void;
};

export function MailSenderContact({ sender, displayName, demo, demoContacts, onSaved, onOpenContacts }: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={s.senderContactButton} onClick={() => setOpen(true)}
      aria-label={`Kontakt für ${displayName} öffnen`} aria-haspopup="dialog">
      <strong>{displayName}</strong>
      <small>{sender.address}</small>
      <span><UserPlus size={13} aria-hidden="true" /> Kontakt</span>
    </button>
    {open && <SenderContactDialog sender={sender} displayName={displayName} demo={demo}
      demoContacts={demoContacts} onSaved={onSaved} onOpenContacts={onOpenContacts} onClose={() => setOpen(false)} />}
  </>;
}

function SenderContactDialog({ sender, displayName, demo, demoContacts, onSaved, onOpenContacts, onClose }: Props & { onClose: () => void }) {
  const [name, setName] = useState(displayName === sender.address ? "" : displayName);
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<NameContact | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true); setError("");
    void (async () => {
      try {
        const contacts = demo ? demoContacts || [{ id: "demo-contact", displayName: "Lena Berger", emailAddresses: [{ address: "lena.berger@example.com" }] }]
          : await loadNameContacts(async path => {
            const response = await fetch("/api/mail/" + path, { cache: "no-store", signal: controller.signal });
            if (!response.ok) throw new Error("Kontakte konnten nicht geprüft werden. Bitte erneut versuchen.");
            return response.json();
          });
        if (!controller.signal.aborted) {
          setExisting(contacts.find(contact => contact.emailAddresses?.some(email =>
            email.address?.trim().toLowerCase() === sender.address.trim().toLowerCase())) || null);
          setChecking(false);
        }
      } catch (e) {
        if (!controller.signal.aborted) { setError((e as Error).message); setChecking(false); }
      }
    })();
    return () => controller.abort();
  }, [demo, demoContacts, sender.address, attempt]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current || checking || existing || error) return;
    saving.current = true; setBusy(true);
    try {
      let contact: MailPimItem;
      if (demo) contact = { id: crypto.randomUUID(), displayName: name.trim(),
        emailAddresses: [{ address: sender.address }], companyName: company.trim(), businessPhones: phone.trim() ? [phone.trim()] : [] };
      else {
        const response = await fetch("/api/mail/contacts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "create", target: "shared", confirmed: true,
            value: { displayName: name.trim(), email: sender.address, companyName: company.trim(), phone: phone.trim() } }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Kontakt konnte nicht gespeichert werden.");
        contact = data.item;
      }
      onSaved(contact); onClose();
    } catch (e) { setError((e as Error).message); }
    finally { saving.current = false; setBusy(false); }
  }

  return <MailDialog title={existing ? "Kontakt vorhanden" : "Kontakt aus E-Mail erstellen"} onClose={onClose} busy={busy}>
    {error && <p role="alert">{error}</p>}
    {checking ? <p role="status">Gespeicherte Kontakte werden geprüft …</p> : existing ? <>
      <p>Diese E-Mail-Adresse ist bereits als <b>{existing.displayName || sender.address}</b> gespeichert.</p>
      <p>{sender.address}</p>
      <footer><button type="button" className={s.primary} onClick={() => { onClose(); onOpenContacts(); }}>Kontakte öffnen</button></footer>
    </> : <form onSubmit={event => void save(event)}>
      <p>Der neue Kontakt wird für Ali und Tuba gespeichert.</p>
      <label>Name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} disabled={busy} autoComplete="name" /></label>
      <label>E-Mail<input type="email" value={sender.address} readOnly /></label>
      <label>Firma<input maxLength={200} value={company} onChange={e => setCompany(e.target.value)} disabled={busy} autoComplete="organization" /></label>
      <label>Telefon<input type="tel" maxLength={60} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} autoComplete="tel" /></label>
      <footer>
        <button type="button" className={s.subtle} onClick={onClose} disabled={busy}>Abbrechen</button>
        {error ? <button type="button" className={s.primary} onClick={() => setAttempt(value => value + 1)}>Erneut prüfen</button>
          : <button type="submit" className={s.primary} disabled={busy || !name.trim()}>{busy ? "Wird gespeichert …" : "Kontakt speichern"}</button>}
      </footer>
    </form>}
  </MailDialog>;
}
