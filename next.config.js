/** @type {import('next').NextConfig} */
const emaOfficeOrigin = process.env.EMA_OFFICE_ORIGIN ?? 'https://ema-office.vercel.app'

const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
    outputFileTracingIncludes: {
      '/api/plaud/notes/*/pdf': [
        './public/brand/ema-logo.png',
        './public/fonts/inter/*.ttf',
      ],
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/office',
        destination: `${emaOfficeOrigin}/office`,
      },
      {
        source: '/office/:path*',
        destination: `${emaOfficeOrigin}/office/:path*`,
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // PLAUD PDFs are embedded only by EMA itself. This rule intentionally
        // overrides the global DENY header while still blocking other origins.
        source: '/api/plaud/notes/:path*/pdf',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
      {
        // The service worker is our own hand-written script (push + notificationclick
        // handling for iPhone reminders). It must never be served stale from a cache —
        // iOS Safari in particular will happily keep running an old cached worker across
        // deploys, which silently reintroduces already-fixed push bugs.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
