import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Tâches de l’équipe · Be Stable ». */
export const metadata: Metadata = { title: "Tâches de l’équipe" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
