"use client";

import Link from "next/link";
import { Ic, Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { Redirect } from "@/components/bs/redirect";
import { Agir, usePresence } from "@/components/bs/presence";
import { PanneauEtape } from "@/components/bs/etape-audit";
import { PAYANT_VISIBLE, QUATRE_PARTIES } from "@/lib/fonctions";
import "@/app/carnet/presence.css";

/**
 * Te trouver (26 novembre 2026, les quatre parties) : est-ce que les cavaliers
 * tombent sur l'écurie ? L'étape 1 de l'audit (lib/presence.ts), la chose à
 * faire d'abord, puis ce qui viendra (Google, la position dans la recherche).
 * On ne juge jamais une source qu'on n'a pas lue.
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
  const { etat, etapes } = usePresence();
  const e = etapes?.[0];
  const premier = e?.points.find((p) => p.etat === "ko") ?? e?.points.find((p) => p.etat === "mid") ?? null;

  return (
    <Page className="pr-page">
      <div className="pr-hello rise">
        <span className="eyeb">D’après ta fiche bestable.fr</span>
        <h2 className="q5-h">
          Ta <span className="pr-hl">visibilité</span>
        </h2>
        <p>Est-ce que les cavaliers tombent sur ton écurie quand ils cherchent une pension près de chez eux ?</p>
      </div>

      {etat !== "pret" || !e ? (
        <>
          <p className="q4-bientot" style={{ margin: "14px 16px 0" }}>
            {etat === "inconnu" ? "On regarde ta fiche…" : etat === "erreur" ? "bestable.fr ne répond pas pour le moment. Réessaie dans un instant." : "L’audit s’ouvre dès que ton écurie a sa fiche à ton nom."}
          </p>
          {etat === "aucune" && (
            <div className="pr-pad" style={{ marginTop: 14 }}>
              <Link href="/compte/inscription?retrouver=1" className="btn full">
                Trouver mon écurie
                <Ic n="arrow" className="" />
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          {premier && (
            <div className="pr-now rise" style={{ animationDelay: ".06s" }}>
              <span className="eyeb">À faire d’abord</span>
              <h3>{premier.titre}</h3>
              <p>{premier.pourquoi}</p>
              <Agir p={premier} className="btn pr-rose full" />
            </div>
          )}
          <div className="pr-panel">
            <PanneauEtape e={e} />
          </div>
        </>
      )}

      <div className="q4-sec">
        <h2>Ce que l’audit lira ensuite</h2>
        <p className="q4-bientot">Ta fiche Google (note, avis, photos, horaires), ta place quand on cherche « pension cheval » et le nom de ta ville, ton site et ta page Facebook. Rien n’est noté tant qu’on ne l’a pas lu.</p>
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
