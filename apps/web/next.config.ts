import type { NextConfig } from 'next';
import path from 'node:path';

import { publicSecurityHeaders } from './src/lib/public-security';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  distDir: process.env.MBV_PLAYWRIGHT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  // English and Spanish roots have static document languages; unmatched routes use one full 404.
  experimental: { globalNotFound: true },
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
  transpilePackages: ['@mustbeviral/config', '@mustbeviral/graph', '@mustbeviral/ui'],
  async headers() {
    // Only byte-versioned assets get immutable caching; unversioned media keeps its default.
    const assets = [
      '/films/s0-studio-hero-d55af8ec3d69.mp4',
      '/films/s0-studio-hero-poster-41da8acddb3f.jpg',
    ].map((source) => ({
      source,
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }));
    return [
      {
        source: '/:path*',
        headers: publicSecurityHeaders({
          supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
          core: process.env.NEXT_PUBLIC_CORE_API_URL,
          collaboration: process.env.NEXT_PUBLIC_COLLABORATION_API_URL,
          development: process.env.NODE_ENV === 'development',
        }),
      },
      ...assets,
    ];
  },
  async rewrites() {
    const coreApiUrl = process.env.NEXT_PUBLIC_CORE_API_URL?.replace(/\/$/u, '');
    return coreApiUrl === undefined
      ? []
      : [{ source: '/api/core/:path*', destination: `${coreApiUrl}/:path*` }];
  },
};

export default nextConfig;
