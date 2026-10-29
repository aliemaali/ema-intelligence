import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeRuntime } from '@/components/ThemeRuntime'
import { themeInitScript } from '@/lib/theme-init'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/hooks/useAuth'
import { DashboardCalendarShortcut } from '@/components/calendar/DashboardCalendarShortcut'
import { DashboardTemplateShortcut } from '@/components/templates/DashboardTemplateShortcut'
import { EmaVoiceGate } from '@/components/layout/EmaVoiceGate'
import '@/styles/globals.css'
import '@/styles/ema-theme.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: 'EMA',
  title: {
    default:  'EMA Intelligence',
    template: '%s | EMA Intelligence',
  },
  description: 'Deal-Management-Plattform für PV-, BESS- und Hybridprojekte – EMA Enterprise GmbH',
  manifest:    '/manifest.json',
  icons: {
    icon:  '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable:       true,

    title:         'EMA',
  },
}

export const viewport: Viewport = {
  width:                    'device-width',
  initialScale:             1,
  maximumScale:             1,
  userScalable:             false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#5CB800' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1623' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className={`${inter.variable} premium-root font-sans antialiased`}>
        <ThemeRuntime>
          <AuthProvider>
            {children}
            <EmaVoiceGate />
            <DashboardCalendarShortcut />
            <DashboardTemplateShortcut />
            <Toaster
              position="top-center"
              toastOptions={{
                style: {
                  background: 'var(--toast-bg)',
                  border:     '1px solid var(--toast-border)',
                  color:      'var(--toast-color)',
                },
              }}
              richColors
            />
          </AuthProvider>
        </ThemeRuntime>
      </body>
    </html>
  )
}
