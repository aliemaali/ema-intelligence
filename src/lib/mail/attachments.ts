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

export function validateComposeFiles(
  existing: { contentBytes: string }[],
  files: { size: number }[],
) {
  if (existing.length + files.length > 10)
    throw new MailError(413, "Maximal zehn Anhänge.");
  if (
    files.some(
      (f) => !Number.isFinite(f.size) || f.size < 0 || f.size > 2_000_000,
    )
  )
    throw new MailError(413, "Einzelne Anhänge maximal 2 MB.");
  if (
    existing.reduce((n, a) => n + a.contentBytes.length, 0) +
      files.reduce((n, f) => n + 4 * Math.ceil(f.size / 3), 0) >
    3_000_000
  )
    throw new MailError(413, "Anhänge zusammen maximal 2,25 MB.");
}
