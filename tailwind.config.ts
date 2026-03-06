import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#142033',
        mist: '#f5f6f8',
        line: '#d9dde5',
        panel: '#ffffff',
        shell: '#f1f3f6',
        cloud: '#fbfbfc',
        accent: {
          50: '#eff4ff',
          100: '#dbe7ff',
          200: '#bed2ff',
          500: '#4b74d9',
          600: '#3c62c0',
          700: '#3150a1',
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
