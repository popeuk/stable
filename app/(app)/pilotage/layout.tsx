import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Sur plusieurs mois · Be Stable ». */
export const metadata: Metadata = { title: "Sur plusieurs mois" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
