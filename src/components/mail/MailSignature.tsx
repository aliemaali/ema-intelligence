import Image from "next/image";
import { SIGNATURE_ALT, SIGNATURE_IMAGE } from "@/lib/mail/signature";
import s from "./mail.module.css";
export function MailSignature() {
  return (
    <div className={s.mailSignature}>
      <Image
        src={SIGNATURE_IMAGE}
        alt={SIGNATURE_ALT}
        width={600}
        height={357}
        unoptimized
      />
      <small>Signatur für unluer@ema-enterprise.de · wird mitgesendet</small>
    </div>
  );
}
