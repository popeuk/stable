"use client";

import { useEffect } from "react";
import { brancherSuivi } from "@/lib/suivi-erreurs";

/** Le suivi des erreurs (lib/suivi-erreurs), branché une fois dans app/layout.tsx. Rien ne s'affiche. */
export function SuiviErreurs() {
  useEffect(() => brancherSuivi(), []);
  return null;
}
