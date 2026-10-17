import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Nouveau mot de passe · Be Stable ». */
export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
