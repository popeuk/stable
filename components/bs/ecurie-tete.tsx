"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TeteVerte } from "@/components/da/tete-verte";
import { Onglets } from "@/components/da/onglets";
import { Ic } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { useBriques } from "@/components/bs/briques";
import { estOuverte } from "@/lib/briques";

export type VueEcurie = "clients" | "chevaux" | "prestations" | "plus";
const ROUTE: Record<VueEcurie, string> = { clients: "/chevaux?vue=clients", chevaux: "/chevaux?vue=chevaux", prestations: "/prestations", plus: "/ecurie" };

const plur = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

/**
 * Le haut de Mon écurie (DA de l'app du Clos, 27 novembre 2026) : l'en-tête
 * vert (« Mon écurie », le nom de l'écurie, le + rose qui note), ce qui
 * compte sur la vue ouverte (des chiffres, en enfants), puis les onglets en
 * pastilles : Clients, Chevaux, Prestations, et le reste (frais, gens,
 * papiers). Comme le registre du Clos, Mon écurie s'ouvre sur les clients.
 */
export function EcurieTete({ vue, children }: { vue: VueEcurie; children?: ReactNode }) {
  const router = useRouter();
  const stableName = useSettingsStore((s) => s.stableName);
  const openNoter = useUiStore((s) => s.openNoter);
  const { etat } = useBriques();
  const argent = estOuverte(etat.argent);
  const clients = useDataStore((s) => (s.people ?? []).length);
  const chevaux = useDataStore((s) => s.horses.filter((h) => !h.isArchived).length);
  const prestations = useDataStore((s) => (s.prestations ?? []).length);
  const aller = (v: VueEcurie) => v !== vue && router.replace(ROUTE[v], { scroll: false });
  return (
    <>
      <TeteVerte
        titre="Mon écurie"
        sous={stableName || undefined}
        action={
          argent ? (
            <button type="button" className="da-plus" onClick={() => openNoter({})} aria-label="Noter une dépense, une recette ou une séance">
              <Ic n="plus" className="" />
            </button>
          ) : undefined
        }
      >
        {children}
      </TeteVerte>
      <Onglets
        label="Clients, chevaux, prestations ou le reste"
        items={[
          { key: "clients", titre: "Clients", petit: plur(clients, "client", "clients"), on: vue === "clients", go: () => aller("clients") },
          { key: "chevaux", titre: "Chevaux", petit: plur(chevaux, "cheval", "chevaux"), on: vue === "chevaux", go: () => aller("chevaux") },
          { key: "prestations", titre: "Prestations", petit: `${prestations}`, on: vue === "prestations", go: () => aller("prestations") },
          { key: "plus", titre: "Plus", petit: "le reste", on: vue === "plus", go: () => aller("plus") },
        ]}
      />
    </>
  );
}
