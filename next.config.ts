import type { NextConfig } from "next";

// When DEPLOY_TARGET=pages we build a fully static export for GitHub Pages,
// served from the /stable sub-path (the repo name). The normal build (Netlify
// / local) is unaffected and keeps SSR + dynamic routes.
const isPages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = isPages
  ? {
      output: "export",
      basePath: "/stable",
      assetPrefix: "/stable/",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
