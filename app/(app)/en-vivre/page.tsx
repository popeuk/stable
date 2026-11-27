"use client";

import { Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { Redirect } from "@/components/bs/redirect";
import { Gestes, VoletDetail, VueEnsemble, useGrille } from "@/components/da/grille-audit";
import { QUATRE_PARTIES } from "@/lib/fonctions";
import "@/app/carnet/presence.css";

/**
 * En vivre (27 novembre 2026, comme dans l'Analyse du Clos) : le troisième
 * volet de l'audit, lu dans les données de l'écurie (pensions, séances,
 * frais) et dans tes réponses (lib/audit/grille.ts).
 */
export default function EnVivrePage() {
  if (!QUATRE_PARTIES) return <Redirect to="/argent" />;
  return (
    <ClientGate>
      <EnVivre />
    </ClientGate>
  );
}

function EnVivre() {
  const { lignes } = useGrille();
  return (
    <Page className="pr-page">
      <div className="au-zone">
        <Gestes lignes={lignes.filter((l) => l.volet === "vivre")} />
        <VoletDetail k="vivre" lignes={lignes} />
        <div style={{ marginTop: 18 }}>
          <VueEnsemble lignes={lignes} ici="vivre" />
        </div>
      </div>
      <div className="end" />
    </Page>
  );
}
