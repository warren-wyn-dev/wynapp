import type { NextConfig } from 'next';
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@wyn/ui'],
  async rewrites() {
    // The API's admin session cookie is __Host- prefixed, which locks it
    // to the exact origin that set it — proxying /admin/v1/* through this
    // app's own origin (same pattern as apps/web) keeps the browser
    // same-origin with the API so that cookie actually comes back.
    return [
      {
        source: '/admin/v1/:path*',
        destination: `${apiOrigin}/admin/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};
export default config;
