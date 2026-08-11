import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  distDir: process.env.MBV_PLAYWRIGHT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
  transpilePackages: ['@mustbeviral/config', '@mustbeviral/graph', '@mustbeviral/ui'],
  async rewrites() {
    const coreApiUrl = process.env.NEXT_PUBLIC_CORE_API_URL?.replace(/\/$/u, '');
    return coreApiUrl === undefined
      ? []
      : [{ source: '/api/core/:path*', destination: `${coreApiUrl}/:path*` }];
  },
};

export default nextConfig;
