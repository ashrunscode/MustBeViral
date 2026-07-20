import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
  transpilePackages: ['@mustbeviral/config', '@mustbeviral/graph', '@mustbeviral/ui'],
};

export default nextConfig;
