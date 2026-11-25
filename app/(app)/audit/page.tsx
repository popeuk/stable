"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ic, Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { Redirect } from "@/components/bs/redirect";
import { usePresence } from "@/components/bs/presence";
import { COULEUR, PanneauEtape } from "@/components/bs/etape-audit";
import type { EtapeId } from "@/lib/presence";
import { ARGENT_VISIBLE, QUATRE_PARTIES } from "@/lib/fonctions";
import "@/app/carnet/presence.css";

/**
 * L'audit de la présence en ligne (29 octobre 2026, maquette validée) : une
 * étape du cavalier à la fois. Le compte (à corriger, à revoir, c'est bon),
 * puis les points dans cet ordre ; ce qui va bien tient en une ligne.
 * Avec la partie argent allumée, l'ancienne adresse ramène à Mon bilan,
 * comme avant (l'ancien « Audit du mois »).
 */
export default function AuditPage() {
  // Les quatre parties : l'audit est réparti entre Te trouver (étape 1) et Te choisir (étapes 2 et 3).
  if (QUATRE_PARTIES) return <VersQuatre />;
  if (ARGENT_VISIBLE) return <Redirect to="/argent" />;
  return (
    <ClientGate>
      <Audit />
    </ClientGate>
  );
}


function Audit() {
  const { etat, etapes } = usePresence();
  const [n, setN] = useState<EtapeId>(1);
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get("etape"));
    // L'étape demandée par l'accueil (?etape=), lue une fois dans le navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === 1 || v === 2 || v === 3) setN(v);
  }, []);

  if (etat !== "pret" || !etapes)
    return (
      <Page className="pr-page">
        <div className="pr-hello rise">
          <h1>
            Ton <span className="pr-hl">audit</span>.
          </h1>
          <p>{etat === "inconnu" ? "On regarde ta fiche…" : etat === "erreur" ? "bestable.fr ne répond pas pour le moment. Réessaie dans un instant." : "Ton audit s’ouvre dès que ton écurie a sa fiche à ton nom."}</p>
        </div>
        {etat === "aucune" && (
          <div className="pr-pad">
            <Link href="/compte/inscription?retrouver=1" className="btn full">
              Trouver mon écurie
              <Ic n="arrow" className="" />
            </Link>
          </div>
        )}
      </Page>
    );

  const e = etapes[n - 1];

  return (
    <Page className="pr-page">
      <div className="pr-hello rise">
        <span className="eyeb">D’après ta fiche bestable.fr et tes demandes</span>
        <h1>
          Ton <span className="pr-hl">audit</span>.
        </h1>
        <p>Une étape à la fois, comme la vit le cavalier.</p>
      </div>
      <div className="pr-tabs3 rise" role="tablist" aria-label="Les trois étapes" style={{ animationDelay: ".06s" }}>
        {etapes.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === n} onClick={() => setN(x.id)}>
            <i style={{ background: COULEUR[x.etat] }} />
            {x.id === 1 ? "Te trouver" : x.id === 2 ? "Te choisir" : "T’écrire"}
          </button>
        ))}
      </div>

      <div key={n} className="pr-panel">
        <PanneauEtape e={e} />
        {n < 3 && (
          <div className="pr-pad" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn line full"
              onClick={() => {
                setN((n + 1) as EtapeId);
                window.scrollTo({ top: 0 });
              }}
            >
              Étape suivante : {etapes[n].titre.toLowerCase()}
              <Ic n="arrow" className="" />
            </button>
          </div>
        )}
      </div>
      <div className="end" />
    </Page>
  );
}

/** L'ancienne adresse de l'audit, avec les quatre parties : l'étape demandée mène au bon onglet. */
function VersQuatre() {
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    const v = Number(new URLSearchParams(window.location.search).get("etape"));
    // Lu une fois dans le navigateur (export statique).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTo(v === 2 || v === 3 ? "/te-choisir" : "/te-trouver");
  }, []);
  return to ? <Redirect to={to} /> : null;
}
