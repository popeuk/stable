import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import { EARLY_INSTALL_SCRIPT, PwaRegister } from "@/components/pwa-register";
import { SANS_ZOOM } from "@/lib/sans-zoom";
import { TAILLE_TOT } from "@/lib/taille";
import { ConsentementDiffere } from "@/components/bs/consentement-differe";
import { TypoFr } from "@/components/typo-fr";
// Les feuilles de style partagées, dans l'ordre de la cascade : livret.css et
// liens.css passent par-dessus les chapitres d'avant, qui restent donc ici.
// Celles d'un seul écran (ecurie, client, proprio, facture, registre, ob-fort)
// sont importées par la page ou le composant qui s'en sert.
import "./globals.css";
import "./bs.css";
import "./carnet.css";
import "./carnet/matin.css";
import "./carnet/journee.css";
import "./carnet/chevaux.css";
import "./carnet/argent.css";
import "./carnet/arrivee.css";
import "./carnet/noter.css";
import "./carnet/essayer.css";
import "./carnet/accueil2.css";
import "./carnet/livret.css";
import "./carnet/liens.css";
import { UnSeulOnglet } from "@/components/bs/un-seul-onglet";
import { SuiviErreurs } from "@/components/bs/suivi-erreurs";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  display: "swap",
});

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  // Chaque écran nomme son onglet : « Planning · Be Stable ».
  title: { default: "Be Stable", template: "%s · Be Stable" },
  description: "Ce que ton écurie te rapporte vraiment. Cheval par cheval.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-192.png`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Be Stable",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(min-width: 1024px)", color: "#FFFFFF" },
    { color: "#FCFBF9" },
  ],
  width: "device-width",
  initialScale: 1,
  // Pas de zoom : ni au pincement, ni quand on touche un champ sur iPhone.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${bricolage.variable} ${plex.variable} antialiased`}
      // Le gros texte se pose sur <html> avant React (data-taille) : pas d'alerte au réveil.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_INSTALL_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: TAILLE_TOT }} />
        <script dangerouslySetInnerHTML={{ __html: SANS_ZOOM }} />
      </head>
      <body>
        {process.env.NEXT_PUBLIC_PREPROD ? (
          <div role="note" style={{ position: "fixed", left: "50%", top: 2, transform: "translateX(-50%)", zIndex: 9999, padding: "4px 9px", borderRadius: 8, background: "#FBF1D6", color: "#5C4210", font: "700 10px/1.3 system-ui, sans-serif", whiteSpace: "nowrap", pointerEvents: "none" }}>
            Préproduction · données de test
          </div>
        ) : null}
        {children}
        <PwaRegister />
        <ConsentementDiffere />
        <TypoFr />
        <UnSeulOnglet />
        <SuiviErreurs />
      </body>
    </html>
  );
}
