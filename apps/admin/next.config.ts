import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@nitro-web/shared', '@nitro-web/contracts', '@nitro-web/db', '@nitro-web/templates'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
      ],
    }];
  },
};

export default config;
