"use client";

import { useEffect } from "react";

/**
 * Safari sur iPhone ignore « user-scalable=no » : on bloque aussi le pincement
 * (gestes WebKit et deux doigts). La double tape est coupée en CSS
 * (touch-action: manipulation), sans avaler les appuis rapides sur un bouton.
 * Le zoom du navigateur sur ordinateur n'est pas touché.
 */
export function SansZoom() {
  useEffect(() => {
    const geste = (e: Event) => e.preventDefault();
    const deuxDoigts = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", geste);
    document.addEventListener("gesturechange", geste);
    document.addEventListener("touchmove", deuxDoigts, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", geste);
      document.removeEventListener("gesturechange", geste);
      document.removeEventListener("touchmove", deuxDoigts);
    };
  }, []);
  return null;
}
