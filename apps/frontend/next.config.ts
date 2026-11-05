import type { NextConfig } from 'next';

// URL du backend NestJS, lue depuis l'environnement (apps/frontend/.env.local)
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Proxy same-origin : le cookie de session httpOnly reste first-party, pas de CORS
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
