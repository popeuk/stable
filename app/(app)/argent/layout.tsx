import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Mon mois · Be Stable ». */
export const metadata: Metadata = { title: "Mon mois" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
