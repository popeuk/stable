import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Fiche client · Be Stable ». */
export const metadata: Metadata = { title: "Fiche client" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
