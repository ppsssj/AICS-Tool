import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--theme-ink) / <alpha-value>)',
        mist: 'rgb(var(--theme-mist) / <alpha-value>)',
        line: 'rgb(var(--theme-line) / <alpha-value>)',
        panel: 'rgb(var(--theme-panel) / <alpha-value>)',
        shell: 'rgb(var(--theme-shell) / <alpha-value>)',
        cloud: 'rgb(var(--theme-cloud) / <alpha-value>)',
        accent: {
          50: 'rgb(var(--theme-accent-50) / <alpha-value>)',
          100: 'rgb(var(--theme-accent-100) / <alpha-value>)',
          200: 'rgb(var(--theme-accent-200) / <alpha-value>)',
          500: 'rgb(var(--theme-accent-500) / <alpha-value>)',
          600: 'rgb(var(--theme-accent-600) / <alpha-value>)',
          700: 'rgb(var(--theme-accent-700) / <alpha-value>)',
        },
        success: '#2f7a62',
        warning: '#997147',
        danger: '#a94d59',
      },
      boxShadow: {
        soft: '0 18px 40px rgba(17, 24, 39, 0.06)',
        float: '0 24px 60px rgba(15, 23, 42, 0.08)',
        innerline: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
      },
      fontFamily: {
        sans: ['"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'sans-serif'],
      },
      backgroundImage: {
        grid:
          'linear-gradient(to right, rgba(148, 163, 184, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.05) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
