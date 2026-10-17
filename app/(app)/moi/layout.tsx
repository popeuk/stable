import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Réglages · Be Stable ». */
export const metadata: Metadata = { title: "Réglages" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
