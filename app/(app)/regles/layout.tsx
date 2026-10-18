import type { Metadata } from "next";

/** Le titre de l'onglet : « Les règles · Be Stable ». */
export const metadata: Metadata = { title: "Les règles" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
