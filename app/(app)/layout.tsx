import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { OnboardingGate } from "@/components/ed/onboarding-gate";
import { Autopilot } from "@/components/ed/autopilot";
import { Header, TabBar, ToastHost } from "@/components/bs/shell";
import { AjouterDepuisIcone, BarreBureau, ClavierBureau, FeuillesDifferees, TourneeDifferee } from "@/components/bs/coque-legere";
import { ClientGate } from "@/components/ui/client-gate";
import { MorningNudge } from "@/components/bs/morning-nudge";
import { SessionSync } from "@/components/bs/session-sync";
import { NuageSync } from "@/components/bs/nuage-sync";
import { AideCarte, TitreEcran } from "@/components/bs/nav";
import { RetourOrdinateur } from "@/components/bs/navigation";
import { GarderBandeau } from "@/components/bs/garder";
import { Secours } from "@/components/bs/secours";
import { TutoPlus } from "@/components/bs/tuto-plus";
import { LimiteCoque } from "@/components/bs/ecran-erreur";

/**
 * La coque de l'app, dans le carnet illustré. Au téléphone : une colonne au
 * pouce, l'en-tête et la barre d'onglets. Sur ordinateur (1024 px et plus) :
 * la barre latérale blanche, la palette (Ctrl K) et les raccourcis clavier ;
 * les feuilles s'ouvrent en panneau à droite. Le bureau et les grandes
 * feuilles se chargent à part (`coque-legere.tsx`). Toute la coque est sous
 * une limite d'erreur (`LimiteCoque`) : jamais de page blanche.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LimiteCoque>
      <div className="carnet">
        <a className="cn-skip" href="#contenu">
          Aller au contenu
        </a>
        <OnboardingGate />
        <Autopilot />
        <MorningNudge />
        <SessionSync />
        <NuageSync />
        <ClientGate>
          <BarreBureau />
          <AjouterDepuisIcone />
        </ClientGate>
        <main className="cn-main">
          <TitreEcran />
          <ClientGate>
            <Header />
            <div className="cn-page" style={{ paddingBottom: 0, paddingTop: 0 }}>
              <RetourOrdinateur />
              <AideCarte />
            </div>
          </ClientGate>
          {/* Où mène « Aller au contenu » : après l'en-tête, avant l'écran. */}
          <span id="contenu" tabIndex={-1} className="cn-anchor" />
          <Secours>{children}</Secours>
        </main>
        <GarderBandeau />
        <TabBar />
        <FeuillesDifferees />
        <ClientGate>
          <TourneeDifferee />
          <ClavierBureau />
          <TutoPlus />
        </ClientGate>
        <ToastHost />
        <PwaInstallPrompt />
      </div>
    </LimiteCoque>
  );
}
