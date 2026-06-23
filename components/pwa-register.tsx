"use client";

import { useEffect } from "react";

/** Registers the service worker once, in production. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    // Skip on the static export (served from a sub-path) — the SW lives at the
    // site root and would 404.
    if (process.env.NEXT_PUBLIC_BASE_PATH) return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
