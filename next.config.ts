import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a fully static site into ./out for GitHub Pages.
  output: "export",
  // The site is served from https://raykoff.org/course-chain/ on GitHub Pages,
  // so routes and _next assets must be prefixed. Next rewrites <Link> hrefs and
  // its own asset URLs automatically; anything that references a /public file by
  // string (e.g. next/image src) needs the prefix applied by hand. Re-export it
  // as NEXT_PUBLIC_BASE_PATH here when that comes up.
  basePath: "/course-chain",
  // Static hosting can't run the Next.js image optimizer.
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  reactCompiler: true,
};

export default nextConfig;
