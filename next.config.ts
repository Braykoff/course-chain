import type { NextConfig } from "next";

// The site is served from https://raykoff.org/course-chain/ on GitHub Pages.
// This is the single source of truth: `basePath` prefixes routes and _next
// assets, and it's re-exported as NEXT_PUBLIC_BASE_PATH for the few spots
// (next/image src for /public files) that Next doesn't rewrite automatically.
const basePath = "/course-chain";

const nextConfig: NextConfig = {
  // Emit a fully static site into ./out for GitHub Pages.
  output: "export",
  basePath,
  // Static hosting can't run the Next.js image optimizer.
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  reactCompiler: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
