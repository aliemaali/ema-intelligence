import { getMicrosoftAccessToken } from '@/lib/microsoft/session';
import { MailError } from './graph';
import { mailAdmin, mailboxAccess, type MailSession } from './server';
import { canReadAliContacts, SHARED_CONTACT_OWNER } from './shared-contacts';

// The owner connection is selected solely by the explicit server-side grant.
export async function sharedContactAccess(session: MailSession, permission: 'read' | 'write' = 'read') {
  if (!canReadAliContacts(session.user.id)) throw new MailError(403, 'Keine Kontaktfreigabe.');
  await mailboxAccess(session, 'unluer@ema-enterprise.de', permission);
  const admin = mailAdmin();
  const [owner, connection] = await Promise.all([
    admin.from('profiles').select('is_active,email').eq('id', SHARED_CONTACT_OWNER).maybeSingle(),
    admin.from('microsoft_connections').select('microsoft_email').eq('user_id', SHARED_CONTACT_OWNER).maybeSingle(),
  ]);
  if (owner.error || connection.error || owner.data?.is_active !== true ||
      owner.data?.email?.toLowerCase() !== 'unluer@ema-enterprise.de' ||
      connection.data?.microsoft_email?.toLowerCase() !== 'unluer@ema-enterprise.de')
    throw new MailError(403, 'Die Kontaktfreigabe von Ali ist derzeit nicht verfügbar.');
  const token = await getMicrosoftAccessToken(SHARED_CONTACT_OWNER);
  if (!token) throw new MailError(409, 'Ali muss seine Microsoft-Verbindung erneuern.');
  return { token };
}
