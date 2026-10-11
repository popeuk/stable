import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OnboardingGate } from "@/components/ed/onboarding-gate";
import { Autopilot } from "@/components/ed/autopilot";
import { TabBar, ToastHost } from "@/components/bs/shell";
import { NoterSheet } from "@/components/bs/noter-sheet";
import { MorningNudge } from "@/components/bs/morning-nudge";

/**
 * La coque de l'app : une colonne au pouce, la barre d'onglets, la feuille
 * « Noter » et le message du bas, partagés par tous les écrans.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base text-primary">
      <OnboardingGate />
      <Autopilot />
      <MorningNudge />
      <main className="mx-auto max-w-[480px] px-5 pb-32" style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
        {children}
      </main>
      <TabBar />
      <NoterSheet />
      <ToastHost />
      <PwaInstallPrompt />
    </div>
  );
}
