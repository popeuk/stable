import { AppHeader } from "@/components/ed/app-header";
import { BottomNav } from "@/components/ed/bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OnboardingGate } from "@/components/ed/onboarding-gate";
import { ImpactFlash } from "@/components/ed/impact-flash";
import { Autopilot } from "@/components/ed/autopilot";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base text-primary">
      <OnboardingGate />
      <Autopilot />
      <AppHeader />
      <main className="mx-auto max-w-[440px] px-5 pb-36 pt-4">
        <ImpactFlash />
        {children}
      </main>
      <BottomNav />
      <PwaInstallPrompt />
    </div>
  );
}
