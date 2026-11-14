import { NextRequest, NextResponse } from "next/server";
import { isMailEnabled } from "@/lib/mail/model";
import { cronAuthorized, runMailWorker } from "@/lib/mail/background";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
async function handle(request: NextRequest) {
  if (!isMailEnabled() || process.env.EMA_MAIL_WORKER_ENABLED !== "true")
    return NextResponse.json(
      { error: "Mail-Hintergrundbetrieb ist nicht aktiviert." },
      { status: 503 },
    );
  if (!cronAuthorized(request))
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  try {
    return NextResponse.json(
      { ok: true, ...(await runMailWorker()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Hintergrundlauf fehlgeschlagen. Jobstatus prüfen." },
      { status: 503 },
    );
  }
}
