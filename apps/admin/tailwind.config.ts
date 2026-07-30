import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f8fa', 100: '#eef0f3', 200: '#d9dde3', 500: '#68707d',
          600: '#515966', 700: '#3d444f', 800: '#292f38', 900: '#171b21',
        },
        brand: { 100: '#e1efff', 500: '#1677ff', 600: '#0967df', 700: '#0754b7' },
      },
    },
  },
  plugins: [],
} satisfies Config;
