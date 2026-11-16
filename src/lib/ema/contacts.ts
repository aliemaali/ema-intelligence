import type { MailSession } from '../mail/server';
import { sharedContactAccess } from '../mail/shared-contact-access';
import { canReadAliContacts, sharedContactsPage } from '../mail/shared-contacts';
import { openDeltaCursor, sealDeltaCursor } from '../mail/delta-cursor';
import { MailError, mailGraph, safeGraphUrl } from '../mail/graph';
export async function emaContactsPage(session: MailSession, token: string, cursor?: string | null) {
      if (canReadAliContacts(session.user.id)) {
        const sharedAccess = await sharedContactAccess(session);
        return await sharedContactsPage({
          userId: session.user.id,
          cursor,
          secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          getPage: async (source, path) => mailGraph(
            source === 'personal' ? token : sharedAccess.token,
            path,
          ),
        });
      }

      const scope = JSON.stringify([session.user.id,'me','contacts']);
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      let path = '/me/contacts?$top=100&$select=id,displayName,emailAddresses,businessPhones,companyName';
      if(cursor) {
        try {
          const url = new URL(cursor.startsWith('https://') ? safeGraphUrl(cursor,'/me') : safeGraphUrl(openDeltaCursor(cursor,scope,secret)));
          if(cursor.startsWith('https://') ? url.pathname !== '/v1.0/me/contacts' : !/^\/v1\.0\/(?:me|users\/[^/]+)\/contacts$/.test(url.pathname)) throw new Error('Invalid contact page');
          path = url.href;
        } catch { throw new MailError(400,'Ungültige Kontaktseite.'); }
      }
      const result = await mailGraph<{value: unknown[]; '@odata.nextLink'?: string}>(
        token,
        path,
      );
      let next: string | undefined;
      if(result['@odata.nextLink']) {
        const url = new URL(safeGraphUrl(result['@odata.nextLink']!));
        if(!/^\/v1\.0\/(?:me|users\/[^/]+)\/contacts$/.test(url.pathname)) throw new MailError(502,'Ungültige Microsoft-Kontaktseite.');
        next=sealDeltaCursor(url.href,scope,secret);
      }
      return {...result,'@odata.nextLink':next};
}
