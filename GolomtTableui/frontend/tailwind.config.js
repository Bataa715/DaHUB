/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        golomt: {
          50: '#f0f1ff', 100: '#e0e1ff', 200: '#c7c8fe', 300: '#a4a5fc',
          400: '#8183f9', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
        brand: {
          purple: '#8B5CF6',
          indigo: '#6366F1',
          blue: '#3B82F6',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          card: 'var(--surface-card)',
          elevated: 'var(--surface-elevated)',
          border: 'var(--surface-border)',
          hover: 'var(--surface-hover)',
        },
        txt: {
          DEFAULT: 'var(--txt)',
          muted: 'var(--txt-muted)',
          dim: 'var(--txt-dim)',
        },
      },
      fontFamily: {
        sans: ['"JetBrains Mono"', 'monospace'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-right': { '0%': { opacity: '0', transform: 'translateX(8px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease-out both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'slide-right': 'slide-right 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
