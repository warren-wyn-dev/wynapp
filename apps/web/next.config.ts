import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@wyn/ui'],
  async rewrites() {
    // The API's session/CSRF cookies are `__Host-` prefixed, which locks
    // them to the exact origin that set them. Proxying `/v1/*` through this
    // app's own origin keeps the browser same-origin with the API so those
    // cookies are actually sent back on subsequent requests.
    return [{ source: '/v1/:path*', destination: `${apiOrigin}/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
export default withSentryConfig(config, {
  silent: true,
  // No org/project/authToken configured for this environment — skip
  // source-map upload entirely rather than let the build warn or stall
  // trying to reach Sentry's API.
  sourcemaps: { disable: true },
  webpack: {
    automaticVercelMonitors: false,
    treeshake: { removeDebugLogging: true },
  },
});
