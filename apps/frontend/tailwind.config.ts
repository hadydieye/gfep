// Référence documentaire uniquement : ce fichier N'est PAS lu par Tailwind v4.
// La source de vérité des tokens est le bloc @theme de src/app/globals.css
// (aucune directive @config n'y est présente).

import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F4C3A',
          dark: '#1A6B52',
        },
        secondary: {
          DEFAULT: '#C9A227',
          dark: '#D4AF37',
        },
        background: {
          main: '#FAFAF8',
          surface: '#FFFFFF',
          'main-dark': '#0D0F0E',
          'surface-dark': '#16181A',
        },
        foreground: {
          primary: '#111418',
          secondary: '#5C6168',
          'primary-dark': '#F2F3F2',
          'secondary-dark': '#9AA0A6',
        },
        border: {
          DEFAULT: '#E4E6E8',
          dark: '#2A2D30',
        },
        success: {
          DEFAULT: '#1B8A5A',
          dark: '#2FA873',
        },
        warning: {
          DEFAULT: '#B8860B',
          dark: '#D4A017',
        },
        error: {
          DEFAULT: '#C0392B',
          dark: '#E05A4A',
        },
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
