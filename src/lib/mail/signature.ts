export const SIGNATURE_ID = "ali-unluer-v1" as const;
export const SIGNATURE_ADDRESS = "unluer@ema-enterprise.de";
export const SIGNATURE_IMAGE = "/mail/signature-ali-unluer-v1.jpeg";
export const SIGNATURE_SHA256 =
  "6ac1f042b5379ecaf6270f222d2bd645c1520f4c965bc21eab15d22ce0e95409";
export const SIGNATURE_CID = "ema-signature-ali-unluer-v1";
export const SIGNATURE_ALT =
  "Ali Ünlüer | Geschäftsführer | EMA Enterprise GmbH | +49 176 620 51 942 | unluer@ema-enterprise.de | Gabriel-von-Seidl-Str. 56, D-67550 Worms | www.ema-enterprise.de";
export function signatureForAddress(address?: string) {
  return SIGNATURES.find(signature => signature.address === address?.trim().toLowerCase())?.id;
}

export const SIGNATURES = [
  { id: SIGNATURE_ID, address: SIGNATURE_ADDRESS, image: SIGNATURE_IMAGE, sha256: SIGNATURE_SHA256, cid: SIGNATURE_CID, alt: SIGNATURE_ALT, filename: 'EMA-Signatur-Ali-Unluer.jpeg' },
  {
    id: 'tuba-unluer-v1',
    address: 'tuba.unluer@ema-enterprise.de',
    image: '/mail/signature-tuba-unluer-v1.jpeg',
    sha256: '0b73b6977bc89901fa51d86cea4af97f15ed612b42e7c0251745fe0ff5a5f3ac',
    cid: 'ema-signature-tuba-unluer-v1',
    alt: 'Tuba Ünlüer | Prokuristin | EMA Enterprise GmbH | tuba.unluer@ema-enterprise.de | Gabriel-von-Seidl-Str. 56, D-67550 Worms | www.ema-enterprise.de',
    filename: 'EMA-Signatur-Tuba-Unluer.jpeg',
  },
  {
    id: 'info-v1',
    address: 'info@ema-enterprise.de',
    image: '/mail/signature-info-v1.jpeg',
    sha256: 'd4ef467488e648a88377bc297eae51c0335871ae4c05bae84eb3a5a8032856a3',
    cid: 'ema-signature-info-v1',
    alt: 'EMA Enterprise GmbH | +49 176 620 51 942 | info@ema-enterprise.de | Gabriel-von-Seidl-Str. 56, D-67550 Worms | www.ema-enterprise.de',
    filename: 'EMA-Signatur-Info.jpeg',
  },
] as const;
export function signatureById(id?: string) {
  return SIGNATURES.find(signature => signature.id === id);
}
