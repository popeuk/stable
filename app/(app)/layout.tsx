import { PeriodStrip } from "@/components/ed/period-strip";
import { BottomNav } from "@/components/ed/bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OnboardingGate } from "@/components/ed/onboarding-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base text-primary">
      <OnboardingGate />
      <PeriodStrip />
      <main className="mx-auto max-w-[440px] px-5 pb-28 pt-4">{children}</main>
      <BottomNav />
      <PwaInstallPrompt />
    </div>
  );
}
