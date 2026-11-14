import Image from "next/image";
import { signatureById } from "@/lib/mail/signature";
import s from "./mail.module.css";
export function MailSignature({ signatureId }: { signatureId: string }) {
  const signature = signatureById(signatureId);
  if (!signature) return null;
  return (
    <div className={s.mailSignature}>
      <Image
        src={signature.image}
        alt={signature.alt}
        width={320}
        height={191}
        unoptimized
      />
      <small>Signatur für {signature.address} · wird mitgesendet</small>
    </div>
  );
}
