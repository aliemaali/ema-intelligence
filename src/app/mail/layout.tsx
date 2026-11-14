import type { Metadata } from "next";
export const metadata: Metadata = {
  applicationName: "EMA Mail", manifest: "/mail/manifest.webmanifest",
  appleWebApp: { capable: true, title: "eMail" },
  icons: { icon: "/mail/icons/icon-192.png", apple: "/mail/icons/apple-touch-icon.png" },
};
export default function MailLayout({children}: {children: React.ReactNode}) { return children; }
