import type { Metadata } from "next";

/** Le titre de l'onglet : « Mon site · Be Stable ». */
export const metadata: Metadata = { title: "Mon site" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
