import type { Metadata, Viewport } from "next";
import { MailChrome } from "@/components/mail/MailChrome";
export const metadata: Metadata = {
  applicationName: "EMA Mail", manifest: "/mail/manifest.webmanifest",
  appleWebApp: { capable: true, title: "eMail", statusBarStyle: "default" },
  icons: { icon: "/mail/icons/icon-192-v2.png", apple: "/mail/icons/apple-touch-icon-v2.png" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true,
  viewportFit: "cover", themeColor: "#ffffff", colorScheme: "light",
};
export default function MailLayout({children}: {children: React.ReactNode}) {
  return <><MailChrome />{children}</>;
}
