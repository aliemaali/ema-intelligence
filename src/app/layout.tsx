import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/lib/hooks/useAuth'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
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
  // PWA metadata
  appleWebApp: {
    capable:       true,
    statusBarStyle:'black-translucent',
    title:         'EMA Intelligence',
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
  viewportFit: 'cover', // iPhone notch support
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}

            {/* Global toast notifications */}
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
        </ThemeProvider>
      </body>
    </html>
  )
}
