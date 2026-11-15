import s from "./mail.module.css";

const identities: Record<string, { label: string; tone: string }> = {
  "info@ema-enterprise.de": { label: "Info", tone: "info" },
  "unluer@ema-enterprise.de": { label: "Ali", tone: "ali" },
  "tuba.unluer@ema-enterprise.de": { label: "Tuba", tone: "tuba" },
};

export function MailMailboxBadge({ mailbox, accounts }: {
  mailbox: string;
  accounts: { mailbox: string; address?: string; name?: string }[];
}) {
  const account = accounts.find(item => item.mailbox === mailbox);
  const address = account?.address || mailbox;
  const identity = identities[address.trim().toLowerCase()];
  return <span className={`${s.badge} ${s.mailboxBadge}`} data-mailbox-tone={identity?.tone || "other"}
    title={address} aria-label={`Postfach: ${identity?.label || account?.name || address}`}>
    {identity?.label || account?.name || address}
  </span>;
}
