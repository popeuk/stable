import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Créer ton compte · Be Stable ». */
export const metadata: Metadata = { title: "Créer ton compte" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
