"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Plus de mot de passe (décision du 18 octobre 2026) : on entre avec un code
 * par e-mail, ou avec Google. Cette adresse reste pour les liens déjà envoyés
 * par e-mail, et mène à la connexion.
 */
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/compte/connexion");
  }, [router]);
  return null;
}
