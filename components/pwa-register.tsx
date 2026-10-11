"use client";

import { useEffect } from "react";
import { captureInstall } from "@/lib/pwa";

/**
 * Enregistre le service worker (en production) à la racine de l'app, sous
 * /stable sur GitHub Pages, et garde la proposition d'installation.
 */
export function PwaRegister() {
  useEffect(() => {
    captureInstall();
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
  }, []);
  return null;
}

/** Écoute la proposition d'installation avant même le chargement de React. */
export const EARLY_INSTALL_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__bsInstall=e;});`;
