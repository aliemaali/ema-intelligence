import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/hooks/useAuth'
import { DashboardCalendarShortcut } from '@/components/calendar/DashboardCalendarShortcut'
import { DashboardTemplateShortcut } from '@/components/templates/DashboardTemplateShortcut'
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
    statusBarStyle: 'black-translucent',
    title: 'EMA Intelligence',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0B1118',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <DashboardCalendarShortcut />
            <DashboardTemplateShortcut />
            <Toaster
              position="top-center"
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
