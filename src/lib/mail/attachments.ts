import { MailError } from "./graph";
export function validateStoredAttachment(bytes: Uint8Array, mime: string) {
  const starts = (signature: number[]) =>
    signature.every((b, i) => bytes[i] === b);
  const valid =
    mime === "application/pdf"
      ? starts([37, 80, 68, 70, 45])
      : mime === "image/png"
        ? starts([137, 80, 78, 71, 13, 10, 26, 10])
        : mime === "image/jpeg"
          ? starts([255, 216, 255])
          : false;
  if (!valid)
    throw new MailError(
      400,
      "Dateiinhalt passt nicht zum angegebenen Dateityp.",
    );
}
