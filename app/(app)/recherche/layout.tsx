import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Chercher · Be Stable ». */
export const metadata: Metadata = { title: "Chercher" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
