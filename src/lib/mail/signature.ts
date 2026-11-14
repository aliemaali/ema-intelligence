export const SIGNATURE_ID = "ali-unluer-v1" as const;
export const SIGNATURE_ADDRESS = "unluer@ema-enterprise.de";
export const SIGNATURE_IMAGE = "/mail/signature-ali-unluer-v1.jpeg";
export const SIGNATURE_SHA256 =
  "6ac1f042b5379ecaf6270f222d2bd645c1520f4c965bc21eab15d22ce0e95409";
export const SIGNATURE_CID = "ema-signature-ali-unluer-v1";
export const SIGNATURE_ALT =
  "Ali Ünlüer | Geschäftsführer | EMA Enterprise GmbH | +49 176 620 51 942 | unluer@ema-enterprise.de | Gabriel-von-Seidl-Str. 56, D-67550 Worms | www.ema-enterprise.de";
export function signatureForAddress(address?: string) {
  return address?.trim().toLowerCase() === SIGNATURE_ADDRESS
    ? SIGNATURE_ID
    : undefined;
}
