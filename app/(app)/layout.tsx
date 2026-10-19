import { OnboardingGate } from "@/components/ed/onboarding-gate";
import { Autopilot } from "@/components/ed/autopilot";
import { Header, TabBar, ToastHost } from "@/components/bs/shell";
import { AjouterDepuisIcone, BarreBureau, ClavierBureau, BandeauxDifferes, FeuillesDifferees, InstallerDiffere, RappelDuMatin, TourneeDifferee, TutoDiffere } from "@/components/bs/coque-legere";
import { ClientGate } from "@/components/ui/client-gate";
import { SessionSync } from "@/components/bs/session-sync";
import { NuageSync } from "@/components/bs/nuage-sync";
import { AideCarte, TitreEcran } from "@/components/bs/nav";
import { RetourOrdinateur } from "@/components/bs/navigation";
import { Secours } from "@/components/bs/secours-garde";
import { LimiteCoque } from "@/components/bs/ecran-erreur-differe";

/**
 * La coque de l'app, dans le carnet illustré. Au téléphone : une colonne au
 * pouce, l'en-tête et la barre d'onglets. Sur ordinateur (1024 px et plus) :
 * la barre latérale blanche, la palette (Ctrl K) et les raccourcis clavier ;
 * les feuilles s'ouvrent en panneau à droite. Le bureau et les grandes
 * feuilles, la bulle du + et l'invitation à installer se chargent à part
 * (`coque-legere.tsx`). Toute la coque est sous
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
        <RappelDuMatin />
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
        <BandeauxDifferes />
        <TabBar />
        <FeuillesDifferees />
        <ClientGate>
          <TourneeDifferee />
          <ClavierBureau />
          <TutoDiffere />
        </ClientGate>
        <ToastHost />
        <InstallerDiffere />
      </div>
    </LimiteCoque>
  );
}
