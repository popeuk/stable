import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Les frais partagés · Be Stable ». */
export const metadata: Metadata = { title: "Les frais de l’écurie" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
