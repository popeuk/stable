import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Mon bilan · Be Stable ». */
export const metadata: Metadata = { title: "Mon bilan" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
