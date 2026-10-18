import type { Metadata } from "next";

// Le même écran sert aux trois questions et à Mon écurie, Mes prix : l'onglet dit ce qu'il contient.
export const metadata: Metadata = { title: "Tes prix" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
