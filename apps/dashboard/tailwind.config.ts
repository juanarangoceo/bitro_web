import type { Config } from 'tailwindcss';

/**
 * Sistema de diseño del dashboard.
 *
 * Deliberadamente distinto al del renderer: aquel viste la marca del cliente,
 * este es una herramienta de trabajo. Compartir escalas invitaría a que un
 * cambio de identidad de una plantilla moviera la interfaz de administración.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0bacb',
          400: '#8595ae',
          500: '#657694',
          600: '#505f7a',
          700: '#424d63',
          800: '#394253',
          900: '#333a47',
          950: '#22262f',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdeff',
          300: '#8ecaff',
          400: '#59acff',
          500: '#328aff',
          600: '#1b6af5',
          700: '#1454e1',
          800: '#1746b6',
          900: '#193f8f',
          950: '#142757',
        },
      },
    },
  },
  plugins: [],
};

export default config;
