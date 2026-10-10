import type { NextConfig } from "next";

// When DEPLOY_TARGET=pages we build a fully static export for GitHub Pages,
// served from the /stable sub-path (the repo name). The normal build (Netlify
// / local) is unaffected and keeps SSR + dynamic routes.
const isPages = process.env.DEPLOY_TARGET === "pages";
// Since October 2026 the prototype owns /stable; this app is served under /stable/v1.
const pagesBase = process.env.PAGES_BASE ?? "/stable";

const nextConfig: NextConfig = isPages
  ? {
      output: "export",
      basePath: pagesBase,
      assetPrefix: `${pagesBase}/`,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
