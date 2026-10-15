import { ToastHost } from "@/components/bs/shell";
import { OnboardingGate } from "@/components/ed/onboarding-gate";

/** Le parcours de démarrage : plein écran dans le carnet, sans barre d'onglets. Il faut un compte (ou la démo). */
export default function ParcoursLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="carnet">
      <OnboardingGate />
      <main className="ar-pc">{children}</main>
      <ToastHost />
    </div>
  );
}
