import type { NextConfig } from 'next';

const config: NextConfig = {
  cacheComponents: true,
  // Los paquetes del monorepo se consumen como TypeScript sin build previo
  // (ADR 0001): editar un paquete se refleja en la app sin pasos intermedios.
  transpilePackages: [
    '@nitro-web/shared',
    '@nitro-web/contracts',
    '@nitro-web/db',
    '@nitro-web/templates',
  ],

  images: {
    // Las imágenes de las landings viven en Supabase Storage. No se admiten
    // dominios arbitrarios: un cliente no debe poder hacer que el optimizador
    // de imágenes de Vercel descargue archivos de cualquier host.
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/**' }],
    formats: ['image/avif', 'image/webp'],
  },

  // El renderer sirve dominios de terceros. Estas cabeceras aplican a todas las
  // landings por igual.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Las landings no necesitan estos permisos; concederlos por defecto
          // solo amplía la superficie disponible para un script inyectado.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // El preview muestra borradores. Que un buscador lo indexe expondría
        // contenido sin publicar y competiría en SEO con la landing real.
        source: '/preview/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default config;
