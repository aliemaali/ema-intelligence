import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/hooks/useAuth'
import { DashboardCalendarShortcut } from '@/components/calendar/DashboardCalendarShortcut'
import { DashboardTemplateShortcut } from '@/components/templates/DashboardTemplateShortcut'
import 'leaflet/dist/leaflet.css'
import '@/styles/globals.css'
import '@/styles/ema-9.css'
import '@/styles/ema-9-components.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'EMA Intelligence',
    template: '%s | EMA Intelligence',
  },
  description: 'Deal-Management-Plattform für PV-, BESS- und Hybridprojekte – EMA Enterprise GmbH',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EMA Intelligence',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F4F6F8',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.variable} overflow-x-hidden font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <a
              href="#ema-main-content"
              className="fixed left-3 top-3 z-[9999] -translate-y-24 rounded-xl bg-[#5CB800] px-4 py-3 text-sm font-extrabold text-[#07142F] shadow-xl transition-transform focus:translate-y-0"
            >
              Zum Hauptinhalt
            </a>
            <div id="ema-main-content" tabIndex={-1} className="min-h-dvh w-full max-w-full overflow-x-clip">
              {children}
            </div>
            <DashboardCalendarShortcut />
            <DashboardTemplateShortcut />
            <Toaster
              position="top-center"
              mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
              toastOptions={{
                style: {
                  background: 'var(--toast-bg)',
                  border: '1px solid var(--toast-border)',
                  color: 'var(--toast-color)',
                },
              }}
              richColors
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
