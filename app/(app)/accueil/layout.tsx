import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Accueil · Be Stable ». */
export const metadata: Metadata = { title: "Accueil" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
