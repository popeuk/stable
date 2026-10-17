import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Ma fiche · Be Stable ». */
export const metadata: Metadata = { title: "Ma fiche" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
