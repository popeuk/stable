import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import { EARLY_INSTALL_SCRIPT, PwaRegister } from "@/components/pwa-register";
import "./globals.css";
import "./bs.css";
import "./carnet.css";
import "./carnet/matin.css";
import "./carnet/journee.css";
import "./carnet/chevaux.css";
import "./carnet/argent.css";
import "./carnet/ecurie.css";
import "./carnet/arrivee.css";
import "./carnet/noter.css";
import "./carnet/essayer.css";
import "./carnet/accueil2.css";
import "./carnet/client.css";
import "./carnet/proprio.css";
import "./carnet/facture.css";
import "./carnet/registre.css";

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
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_INSTALL_SCRIPT }} />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
