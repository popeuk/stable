import { Suspense } from "react";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OnboardingGate } from "@/components/ed/onboarding-gate";
import { Autopilot } from "@/components/ed/autopilot";
import { Header, TabBar, ToastHost } from "@/components/bs/shell";
import { CommandPalette, Shortcuts, ShortcutHelp, Sidebar } from "@/components/bs/desk";
import { ClientGate } from "@/components/ui/client-gate";
import { NoterSheet } from "@/components/bs/noter-sheet";
import { SeanceSheet } from "@/components/bs/seance-sheet";
import { MorningNudge } from "@/components/bs/morning-nudge";
import { SessionSync } from "@/components/bs/session-sync";

/**
 * La coque de l'app. Au téléphone : une colonne au pouce, l'en-tête et la
 * barre d'onglets. Sur ordinateur (1024 px et plus) : la barre latérale
 * vert profond, la palette (Ctrl K) et les raccourcis clavier ; les
 * feuilles s'ouvrent en panneau à droite.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bs-app min-h-dvh bg-base text-primary">
      <OnboardingGate />
      <Autopilot />
      <MorningNudge />
      <SessionSync />
      <ClientGate>
        <Suspense fallback={null}>
          <Sidebar />
          <Shortcuts />
        </Suspense>
      </ClientGate>
      <main className="bs-main">
        <ClientGate>
          <Header />
        </ClientGate>
        {children}
      </main>
      <TabBar />
      <NoterSheet />
      <SeanceSheet />
      <CommandPalette />
      <ShortcutHelp />
      <ToastHost />
      <PwaInstallPrompt />
    </div>
  );
}
