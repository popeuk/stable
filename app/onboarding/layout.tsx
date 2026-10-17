import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Premiers pas · Be Stable ». */
export const metadata: Metadata = { title: "Premiers pas" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
