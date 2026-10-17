import type { Metadata } from "next";

/** Le titre de l'onglet (et le nom proposé à l'enregistrement en PDF) : « Ce qui a compté · Be Stable ». */
export const metadata: Metadata = { title: "Ce qui a compté" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
