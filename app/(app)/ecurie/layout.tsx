import type { Metadata } from "next";

/** Le titre de l'onglet : « Mon écurie · Be Stable ». */
export const metadata: Metadata = { title: "Mon écurie" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
