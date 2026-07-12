/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── EMA Brand ──────────────────────────────────────────
        brand: {
          navy:       '#1F2A44',  // Primary – deep navy
          'navy-800': '#253252',
          'navy-700': '#2C3D63',
          'navy-600': '#354875',
          'navy-500': '#3E5488',
          green:      '#5CB800',  // Secondary – signal green
          'green-600':'#4E9F00',
          'green-400':'#72D100',
          'green-300':'#8EE020',
          'green-100':'#D6F5A3',
        },

        // ── Semantic tokens (light mode) ───────────────────────
        background:   'hsl(var(--background))',
        foreground:   'hsl(var(--foreground))',
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border:       'hsl(var(--border))',
        input:        'hsl(var(--input))',
        ring:         'hsl(var(--ring))',

        // ── Status colors ──────────────────────────────────────
        status: {
          lead:             '#94A3B8',  // slate-400
          vorpruefung:      '#60A5FA',  // blue-400
          investorensuche:  '#A78BFA',  // violet-400
          dd:               '#F59E0B',  // amber-500
          loi:              '#10B981',  // emerald-500
          spa:              '#3B82F6',  // blue-500
          closing:          '#8B5CF6',  // violet-500
          verkauft:         '#5CB800',  // brand green
          abgelehnt:        '#EF4444',  // red-500
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },

      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
      },

      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top':    'env(safe-area-inset-top)',
      },

      screens: {
        'xs': '390px',   // iPhone 14 Pro
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },

      animation: {
        'fade-in':    'fadeIn 0.2s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-in':   'slideInFromLeft 0.2s ease-out',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromLeft: {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss/plugin')(function ({ addUtilities, addVariant }) {
      addUtilities({
        '.safe-pb': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-pt': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })

      // Activated by toggling the `.pdf-render` class (see PrintButton) instead of
      // relying on @media print, so the exact same compact layout can be rasterized
      // via html2canvas for the downloadable PDF and used for the browser print dialog.
      addVariant('pdf', '.pdf-render &')
    }),
  ],
}
