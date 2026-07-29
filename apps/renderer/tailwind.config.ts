import type { Config } from 'tailwindcss';

/**
 * Sistema de diseño del renderer.
 *
 * Las escalas `coffee` y `gold` vienen de la landing de referencia
 * (`cafetera_espresso`). Se conservan tal cual para que portar la plantilla sea
 * una reestructuración de contenido y no una reescritura visual (ADR 0006).
 *
 * Una plantilla futura con otra identidad añade su propia escala aquí; no
 * reutiliza estas con otros valores.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/templates/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#fcf9f6',
          100: '#f5efe9',
          200: '#eadcd3',
          300: '#dbc3b4',
          400: '#c5a08d',
          500: '#b07d62',
          600: '#9d634b',
          700: '#834d3b',
          800: '#6d4035',
          900: '#58362e',
          950: '#2f1b17',
        },
        gold: {
          50: '#fbf9eb',
          100: '#f5f0c8',
          200: '#eee392',
          300: '#e5d054',
          400: '#debf26',
          500: '#cc9710',
          600: '#a8720b',
          700: '#86540d',
          800: '#714412',
          900: '#613915',
          950: '#381e08',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 20px rgba(204, 151, 16, 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
