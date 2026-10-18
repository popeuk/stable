import type { Metadata } from "next";

// Le même écran sert aux trois questions et à Mon écurie, Mes frais : l'onglet dit ce qu'il contient.
export const metadata: Metadata = { title: "Les frais de l’écurie" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
