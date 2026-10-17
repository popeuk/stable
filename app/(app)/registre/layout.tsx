import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Registre d’élevage · Be Stable ». */
export const metadata: Metadata = { title: "Registre d’élevage" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
