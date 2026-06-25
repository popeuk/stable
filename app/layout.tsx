import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces, Hanken_Grotesk } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Be Stable",
  description: "Le copilote chiffré de ton écurie",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Be Stable",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf6e9",
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${hanken.variable} antialiased`}
    >
      <body>
        {/* Apply the saved theme before first paint so there's no light/dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('be-stable-theme')==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}",
          }}
        />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
