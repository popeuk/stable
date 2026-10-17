import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Combien de chevaux · Be Stable ». */
export const metadata: Metadata = { title: "Combien de chevaux" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
