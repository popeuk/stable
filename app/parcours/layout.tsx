import type { Metadata } from "next";
import { ToastHost } from "@/components/bs/shell";
import { OnboardingGate } from "@/components/ed/onboarding-gate";

export const metadata: Metadata = { title: "Premiers pas" };

/** Le parcours de démarrage : plein écran dans le carnet, sans barre d'onglets. Il faut une session : un compte, la démo ou l'écurie essayée sans compte. */
export default function ParcoursLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="carnet">
      <OnboardingGate />
      <main className="ar-pc">{children}</main>
      <ToastHost />
    </div>
  );
}
