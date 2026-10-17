import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Se connecter · Be Stable ». */
export const metadata: Metadata = { title: "Se connecter" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
