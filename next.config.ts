import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a fully static site into ./out, served by Cloudflare Workers static
  // assets at https://coursechain.raykoff.org/ (see wrangler.jsonc).
  output: "export",
  // Static hosting can't run the Next.js image optimizer.
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  reactCompiler: true,
};

export default nextConfig;
