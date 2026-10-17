import type { Metadata } from "next";

/** Ancienne adresse du nouveau mot de passe : elle mène à la connexion. */
export const metadata: Metadata = { title: "Connexion" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
