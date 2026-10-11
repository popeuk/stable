import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { EARLY_INSTALL_SCRIPT, PwaRegister } from "@/components/pwa-register";
import "./globals.css";
import "./bs.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Be Stable",
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
    { media: "(min-width: 1024px)", color: "#0B3325" },
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
      className={`${bricolage.variable} antialiased`}
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
