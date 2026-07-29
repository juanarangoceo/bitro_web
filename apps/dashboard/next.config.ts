import type { NextConfig } from 'next';

const config: NextConfig = {
  // Igual que en el renderer: los paquetes se consumen como TypeScript sin
  // build previo (ADR 0001).
  transpilePackages: [
    '@nitro-web/ai',
    '@nitro-web/shared',
    '@nitro-web/contracts',
    '@nitro-web/db',
    '@nitro-web/templates',
  ],

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/**' }],
  },

  async headers() {
    return [
      {
        // El dashboard es privado por completo: ninguna de sus páginas debe
        // aparecer en un buscador, ni siquiera la de acceso.
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
