"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ic, Page } from "@/components/carnet/ui";
import { ClientGate } from "@/components/ui/client-gate";
import { Redirect } from "@/components/bs/redirect";
import { CartePoint, SCENES, scene, usePresence } from "@/components/bs/presence";
import { compte, type EtapeId } from "@/lib/presence";
import { ARGENT_VISIBLE } from "@/lib/fonctions";
import "@/app/carnet/presence.css";

/**
 * L'audit de la présence en ligne (29 octobre 2026, maquette validée) : une
 * étape du cavalier à la fois. Le compte (à corriger, à revoir, c'est bon),
 * puis les points dans cet ordre ; ce qui va bien tient en une ligne.
 * Avec la partie argent allumée, l'ancienne adresse ramène à Mon bilan,
 * comme avant (l'ancien « Audit du mois »).
 */
export default function AuditPage() {
  if (ARGENT_VISIBLE) return <Redirect to="/argent" />;
  return (
    <ClientGate>
      <Audit />
    </ClientGate>
  );
}

const COULEUR: Record<string, string> = { ko: "var(--out)", mid: "#B7791F", ok: "#2E9B6A" };

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
  const c = compte(e);
  const groupes = [
    ["ko", "À corriger"],
    ["mid", "À revoir"],
  ] as const;
  const oks = e.points.filter((p) => p.etat === "ok");

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
        <div className="pr-acover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene(SCENES[e.id])} alt="" />
          <div className="ov">
            <b>{e.titre}</b>
            <span>{e.scene}</span>
          </div>
        </div>
        <p className="pr-verdict">{e.verdict}</p>
        <div className="pr-score3">
          <div className="pr-s-ko">
            <b>{c.ko}</b>
            <span>à corriger</span>
          </div>
          <div className="pr-s-mid">
            <b>{c.mid}</b>
            <span>à revoir</span>
          </div>
          <div className="pr-s-ok">
            <b>{c.ok}</b>
            <span>c’est bon</span>
          </div>
        </div>

        {groupes.map(([k, t]) => {
          const l = e.points.filter((p) => p.etat === k);
          if (!l.length) return null;
          return (
            <div key={k} className="pr-grp">
              <div className="pr-grp-h">
                <span style={{ background: COULEUR[k] }} />
                <b>{t}</b>
                <small>{l.length}</small>
              </div>
              <div className="pr-pts">
                {l.map((p) => (
                  <CartePoint key={p.id} p={p} />
                ))}
              </div>
            </div>
          );
        })}
        {oks.length > 0 && (
          <div className="pr-grp">
            <div className="pr-grp-h">
              <span style={{ background: COULEUR.ok }} />
              <b>C’est bon</b>
              <small>{oks.length}</small>
            </div>
            <div className="pr-oklist">
              {oks.map((p) => (
                <CartePoint key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}

        {e.id === 1 && <p className="pr-bientot">Bientôt, l’audit lira aussi ta fiche Google, ton site et ta page Facebook.</p>}
        {e.id === 2 && (
          <div className="pr-myth">
            <p className="pr-q">
              <span>«</span> Si j’affiche mon prix, mes concurrents vont le voir. <span>»</span>
            </p>
            <p className="pr-who">Ce qu’on entend le plus chez les gérants.</p>
            <div className="ans">
              <div>
                <strong>Ce qui est vrai</strong>Ils le verront. Mais un concurrent qui veut ton prix l’a déjà : un coup de fil suffit.
              </div>
              <div>
                <strong>Ce qu’on oublie</strong>Un cavalier, lui, compare sans appeler. Ce que tu caches, tu le caches surtout à lui.
              </div>
            </div>
            <div className="ifs">
              <div className="y">
                <strong>Ça marche si</strong>ton prix est le même pour tous.
              </div>
              <div className="n">
                <strong>Ça coince si</strong>il varie : écris « à partir de ».
              </div>
            </div>
          </div>
        )}
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
