import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Static export — no Node server needed at runtime
  output: "export",
  // GitHub Pages serves from /chemlearning/
  basePath: isProd ? '/chemlearning' : '',
  assetPrefix: isProd ? '/chemlearning/' : '',
};

export default nextConfig;
