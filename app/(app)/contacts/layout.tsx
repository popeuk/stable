import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Les pros · Be Stable ». */
export const metadata: Metadata = { title: "Les pros" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
