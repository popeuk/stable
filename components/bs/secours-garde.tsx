"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { useDataStore } from "@/stores/data-store";

/** L'écran de secours ne se charge que si les données lues sont abîmées (components/bs/secours.tsx). */
const SecoursEcran = dynamic(() => import("@/components/bs/secours").then((m) => m.SecoursEcran), { ssr: false });

/** À la place de l'écran : le secours, quand le store a écarté une partie abîmée à la lecture. */
export function Secours({ children }: { children: ReactNode }) {
  const secours = useDataStore((s) => s.secours);
  const quitter = useDataStore((s) => s.quitterSecours);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted || !secours) return <>{children}</>;
  return <SecoursEcran problemes={secours.problemes} origine={secours.copie} onGarder={() => quitter("garder")} onRepartir={() => quitter("repartir")} />;
}
