import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Mot de passe oublié · Be Stable ». */
export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
