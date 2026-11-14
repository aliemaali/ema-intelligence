"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import s from "./mail.module.css";
export function MailDialog({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    element
      ?.querySelector<HTMLElement>("input,button,select,textarea")
      ?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const fields = Array.from(
          element?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = fields[0],
          last = fields[fields.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [busy]);
  return (
    <div className={s.modalBackdrop}>
      <section
        ref={ref}
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            disabled={busy}
            className={s.iconButton}
            aria-label="Dialog schließen"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
