import { mailboxRoot } from "./model";

export class MailError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function safeGraphUrl(path: string, root?: string) {
  const url = new URL(
    path.startsWith("/") ? `https://graph.microsoft.com/v1.0${path}` : path,
  );
  if (
    url.origin !== "https://graph.microsoft.com" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/v1.0/")
  )
    throw new MailError(400, "Ungültiges Graph-Ziel.");
  if (root && !url.pathname.startsWith(`/v1.0${root}/`))
    throw new MailError(400, "Die Seite gehört nicht zu diesem Postfach.");
  return url.href;
}
export async function mailGraph<T>(
  token: string,
  path: string,
  init: RequestInit = {},
  root?: string,
): Promise<T> {
  const response = await fetch(safeGraphUrl(path, root), {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
    },
    cache: "no-store",
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new MailError(
      [403, 404, 410, 429].includes(response.status) ? response.status : 502,
      response.status === 403
        ? "Microsoft verweigert den Zugriff. Bitte Exchange-Freigabe und Graph-Rechte prüfen."
        : response.status === 429
          ? "Microsoft ist ausgelastet. Bitte später erneut versuchen."
          : `Microsoft-Anfrage fehlgeschlagen (${response.status}).`,
    );
  if (response.status === 202 || response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export function messagePath(mailbox: string, id: string) {
  return `${mailboxRoot(mailbox)}/messages/${encodeURIComponent(id)}`;
}
