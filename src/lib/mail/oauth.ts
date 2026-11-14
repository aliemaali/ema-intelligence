import { MICROSOFT_SCOPES } from "@/lib/microsoft/graph";
// Requested only by the explicitly selected EMA Mail connection flow.
export const MAIL_SCOPES = `${MICROSOFT_SCOPES} Mail.ReadWrite Mail.ReadWrite.Shared Mail.Send.Shared`;
