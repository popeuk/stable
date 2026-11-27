"use client";

import Link from "next/link";
import { Ic, Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { Redirect } from "@/components/bs/redirect";
import { usePresence } from "@/components/bs/presence";
import { Gestes, VoletDetail, VueEnsemble, useGrille } from "@/components/da/grille-audit";
import { PAYANT_VISIBLE, QUATRE_PARTIES } from "@/lib/fonctions";
import "@/app/carnet/presence.css";

/**
 * Te trouver (Visibilité) : est-ce que les cavaliers tombent sur l'écurie ?
 * Depuis le 27 novembre 2026, le volet « Te trouver » de la grille d'audit
 * (lib/audit/grille.ts) : dix critères notés 2, 1 ou 0 selon une règle écrite,
 * les premiers gestes, et ce qui reste à mesurer en ligne. On ne juge jamais
 * une source qu'on n'a pas lue.
 */
export default function TeTrouverPage() {
  if (!QUATRE_PARTIES) return <Redirect to="/audit" />;
  return (
    <ClientGate>
      <TeTrouver />
    </ClientGate>
  );
}

function TeTrouver() {
  const { etat } = usePresence();
  const { lignes } = useGrille();
  const trouver = lignes.filter((l) => l.volet === "trouver");

  return (
    <Page className="pr-page">
      {etat === "aucune" && (
        <div className="pr-pad rise" style={{ marginTop: 18 }}>
          <p className="q4-bientot" style={{ margin: "0 0 12px" }}>
            Ton écurie n’a pas encore sa fiche à ton nom : c’est le premier critère de ta visibilité.
          </p>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Trouver mon écurie
            <Ic n="arrow" className="" />
          </Link>
        </div>
      )}
      {etat === "erreur" && <p className="q4-bientot" style={{ margin: "18px 16px 0" }}>bestable.fr ne répond pas pour le moment : ce qui se lit sur ta fiche reviendra dans un instant.</p>}

      <div className="au-zone">
        <VueEnsemble lignes={lignes} ici="trouver" />
        <Gestes lignes={trouver} />
        <VoletDetail k="trouver" lignes={lignes} />
      </div>

      {PAYANT_VISIBLE && (
        <div className="q4-sec">
          <Link href="/mon-site" className="q4-card q4-plus-loin" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="k">Aller plus loin</span>
            <b style={{ fontSize: 16 }}>Ton site, fait à partir de ta fiche</b>
            <span style={{ fontSize: 14, color: "var(--ink2)" }}>Une adresse à ton nom, que Google peut montrer.</span>
            <span className="q4-lk">
              Voir Mon site <Ic n="chev" className="" />
            </span>
          </Link>
        </div>
      )}
      <div className="end" />
    </Page>
  );
}
