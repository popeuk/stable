"use client";

import { useEffect } from "react";
import ParametresPage from "../page";

/**
 * Tes tarifs : une partie de l'écran « Tous les réglages ». L'ancienne adresse
 * reste valable et ouvre l'écran directement sur cette partie.
 */
export default function Page() {
  useEffect(() => {
    const t = setTimeout(() => document.getElementById("tarifs")?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(t);
  }, []);
  return <ParametresPage />;
}
