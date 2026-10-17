import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Fiche du cheval · Be Stable ». */
export const metadata: Metadata = { title: "Fiche du cheval" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
