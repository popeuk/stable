import type { Metadata } from "next";
import { ToastHost } from "@/components/bs/shell";

export const metadata: Metadata = { title: "Bienvenue" };

/** L'accueil des gérants : plein écran dans le carnet, le parcours gère lui-même sa mise en page (téléphone et ordinateur). */
export default function BienvenueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="carnet">
      {children}
      <ToastHost haut />
    </div>
  );
}
