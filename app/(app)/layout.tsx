import { PeriodStrip } from "@/components/ed/period-strip";
import { BottomNav } from "@/components/ed/bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OnboardingGate } from "@/components/ed/onboarding-gate";
import { ImpactFlash } from "@/components/ed/impact-flash";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base text-primary">
      <OnboardingGate />
      <PeriodStrip />
      <main className="mx-auto max-w-[440px] px-5 pb-36 pt-4">
        <ImpactFlash />
        {children}
      </main>
      <BottomNav />
      <PwaInstallPrompt />
    </div>
  );
}
