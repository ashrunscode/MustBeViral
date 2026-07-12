import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
  transpilePackages: ['@mustbeviral/config', '@mustbeviral/ui'],
};

export default nextConfig;
