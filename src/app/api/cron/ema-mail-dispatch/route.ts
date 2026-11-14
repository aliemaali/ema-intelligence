import { NextRequest, NextResponse } from "next/server";
import { isMailEnabled } from "@/lib/mail/model";
import { cronAuthorized } from "@/lib/mail/background";
import { runApprovedDispatch } from "@/lib/mail/dispatch";
export const runtime = "nodejs",
  dynamic = "force-dynamic",
  maxDuration = 60;
export async function GET(request: NextRequest) {
  if (
    !isMailEnabled() ||
    process.env.EMA_MAIL_SCHEDULED_SEND_ENABLED !== "true"
  )
    return NextResponse.json(
      { error: "Geplanter Versand ist nicht aktiviert." },
      { status: 503 },
    );
  if (!cronAuthorized(request))
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  try {
    return NextResponse.json(
      { ok: true, ...(await runApprovedDispatch()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Auftragslauf fehlgeschlagen. Status prüfen." },
      { status: 503 },
    );
  }
}
export const POST = GET;
