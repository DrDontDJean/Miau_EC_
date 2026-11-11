import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// En local, las claves viven en el .env de la raíz del monorepo (lo escribe el wizard).
// En Vercel no existe ese archivo: las variables vienen del panel del proyecto.
const envRaiz = resolve(process.cwd(), '../../.env');
if (existsSync(envRaiz)) process.loadEnvFile(envRaiz);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.vteximg.com.br' },
      { protocol: 'https', hostname: '*.vtexassets.com' },
      { protocol: 'https', hostname: 'www.computron.com.ec' },
    ],
  },
};

export default nextConfig;
