import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  transpilePackages: ["mind-ar"],

  // Allow HMR and error overlay from mobile on the same LAN
  allowedDevOrigins: ["192.168.33.93"],

  // Proxy /api/* → backend. El celular solo necesita llegar al frontend (port 3001).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },

  turbopack: {
    resolveAlias: {
      // MindAR importa sRGBEncoding removido en Three.js r152
      three: "./stubs/three-compat.js",
      // MindAR intenta importar módulos Node.js en el browser
      fs: "./stubs/empty.js",
      "node-fetch": "./stubs/node-fetch.js",
    },
  },
};

export default nextConfig;
