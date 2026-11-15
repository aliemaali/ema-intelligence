"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type Template = {
  id: string;
  title: string;
  subject: string;
  body: string;
  body_html?: string | null;
};
export type ProductivityData = {
  templates: Template[];
  signatureText: string;
  projects: { id: string; project_name: string }[];
  schedules: {
    id: string;
    subject: string;
    run_at: string;
    state: string;
    last_error?: string;
  }[];
  schedulerConfigured: boolean;
};
export const emptyProductivity: ProductivityData = {
  templates: [],
  signatureText: "",
  projects: [],
  schedules: [],
  schedulerConfigured: false,
};
export function useMailProductivity(demo: boolean, mailbox: string, enabled = true) {
  const cache = useRef<Record<string, ProductivityData>>({});
  const currentMailbox = useRef(mailbox);
  currentMailbox.current = mailbox;
  const [data, setValue] = useState<ProductivityData>(emptyProductivity),
    [error, setError] = useState("");
  const update = useCallback(
    (fn: (old: ProductivityData) => ProductivityData) => {
      setValue((old) => {
        const next = fn(
          currentMailbox.current === mailbox
            ? old
            : cache.current[mailbox] || emptyProductivity,
        );
        cache.current[mailbox] = next;
        return currentMailbox.current === mailbox ? next : old;
      });
    },
    [mailbox],
  );
  const refresh = useCallback(async () => {
    if (demo) {
      setValue(
        cache.current[mailbox] || {
          ...emptyProductivity,
          projects: [
            {
              id: "11111111-2222-4333-8444-555555555555",
              project_name: "Beispielprojekt · Demo",
            },
          ],
          schedulerConfigured: true,
        },
      );
      return;
    }
    try {
      const r = await fetch(
          `/api/mail/productivity?${new URLSearchParams({ mailbox })}`,
          { cache: "no-store" },
        ),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (currentMailbox.current === mailbox) {
        cache.current[mailbox] = j;
        setValue(j);
        setError("");
      }
    } catch (e) {
      if (currentMailbox.current === mailbox) setError((e as Error).message);
    }
  }, [demo, mailbox]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    setValue(cache.current[mailbox] || emptyProductivity);
    if (demo) {
      setValue(
        cache.current[mailbox] || {
          ...emptyProductivity,
          projects: [
            {
              id: "11111111-2222-4333-8444-555555555555",
              project_name: "Beispielprojekt · Demo",
            },
          ],
          schedulerConfigured: true,
        },
      );
      return;
    }
    fetch(`/api/mail/productivity?${new URLSearchParams({ mailbox })}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (active) {
          cache.current[mailbox] = j;
          setValue(j);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [demo, mailbox, enabled]);
  return { data, update, refresh, error };
}
export async function mailPost(action: string, body: unknown) {
  const r = await fetch(`/api/mail/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Anfrage fehlgeschlagen.");
  return j;
}
export function localDateTime(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
