import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Be Stable",
  },
};

export const viewport: Viewport = {
  themeColor: "#FCFBF9",
  width: "device-width",
  initialScale: 1,
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
      className={`${bricolage.variable} antialiased`}
    >
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
