import type { Metadata, Viewport } from "next";
import { MailChrome } from "@/components/mail/MailChrome";
export const metadata: Metadata = {
  applicationName: "EMA Mail", manifest: "/mail/manifest.webmanifest",
  appleWebApp: { capable: true, title: "eMail", statusBarStyle: "default" },
  icons: { icon: "/mail/icons/icon-192.png", apple: "/mail/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };
export default function MailLayout({children}: {children: React.ReactNode}) {
  return <><MailChrome />{children}</>;
}
