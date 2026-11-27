import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « À valider · Be Stable ». */
export const metadata: Metadata = { title: "À valider" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
