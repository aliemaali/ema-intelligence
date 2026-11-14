import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { mailSession } from "@/lib/mail/server";
import { microsoftConfig, MICROSOFT_STATE_COOKIE } from "@/lib/microsoft/graph";
import { MAIL_SCOPES } from "@/lib/mail/oauth";
import { MailError } from "@/lib/mail/graph";
export async function GET() {
  try {
    const { user } = await mailSession();
    const { tenantId, clientId, redirectUri } = microsoftConfig();
    const state = randomBytes(32).toString("base64url");
    const url = new URL(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    );
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: MAIL_SCOPES,
      state,
      ...(user.email ? { login_hint: user.email } : {}),
    }).toString();
    const response = NextResponse.redirect(url);
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600,
    };
    response.cookies.set(MICROSOFT_STATE_COOKIE, state, options);
    response.cookies.set("ema_ms_mail_flow", state, options);
    return response;
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof MailError
            ? e.message
            : "Microsoft-Anmeldung konnte nicht gestartet werden.",
      },
      { status: e instanceof MailError ? e.status : 503 },
    );
  }
}
