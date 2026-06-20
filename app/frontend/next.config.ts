import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["mind-ar"],
  turbopack: {
    resolveAlias: {
      // MindAR importa sRGBEncoding que fue removido en Three.js r152
      three: "./stubs/three-compat.js",
      // MindAR intenta importar 'fs' en el browser
      fs: "./stubs/empty.js",
    },
  },
};

export default nextConfig;
