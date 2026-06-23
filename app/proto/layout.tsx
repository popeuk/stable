import { Hanken_Grotesk } from "next/font/google";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function ProtoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${hanken.variable} proto-skin min-h-dvh`}>{children}</div>
  );
}
