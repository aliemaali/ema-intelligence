import { createHmac, timingSafeEqual } from 'node:crypto';

// Bind opaque Microsoft continuation URLs to the authenticated user, mailbox and logical folder.
export function sealDeltaCursor(url: string, scope: string, secret: string) {
  const data = Buffer.from(JSON.stringify({ url, scope })).toString('base64url');
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}
export function openDeltaCursor(cursor: string, scope: string, secret: string): string {
  if (cursor.length > 24000) throw new Error('Ungültiger Abgleichsstand.');
  const [data, signature, extra] = cursor.split('.');
  if (!data || !signature || extra) throw new Error('Ungültiger Abgleichsstand.');
  const expected = createHmac('sha256', secret).update(data).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Ungültiger Abgleichsstand.');
  const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (decoded.scope !== scope || typeof decoded.url !== 'string') throw new Error('Abweichendes Postfach oder Benutzerkonto.');
  return decoded.url;
}
