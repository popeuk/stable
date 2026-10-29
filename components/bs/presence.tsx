"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Ic } from "@/components/carnet/ui";
import { withBase } from "@/components/bs/ui";
import { useMaFiche } from "@/lib/account/ma-fiche";
import { useDemandes } from "@/lib/account/demandes";
import { useSettingsStore } from "@/stores/settings-store";
import { auditPresence, MOTS, MOTS_POINT, type Etape, type EtapeId, type EtatPoint, type Point } from "@/lib/presence";
import type { Question } from "@/components/bs/feuille-question";
import "@/app/carnet/presence.css";

/**
 * Les pièces de la présence en ligne (29 octobre 2026, maquette validée) :
 * l'audit de la fiche, la carte d'une étape du cavalier, la carte d'un point,
 * et la porte vers la feuille qui corrige. Lues par l'accueil et l'écran Audit.
 */

const FeuilleQuestion = dynamic(() => import("@/components/bs/feuille-question").then((m) => m.FeuilleQuestion), { ssr: false });

/** Les scènes en papier des trois étapes. */
export const SCENES: Record<EtapeId, string> = { 1: "trouve", 2: "choisit", 3: "ecrit" };
export const scene = (n: string) => withBase(`/img/presence/${n}.webp`);

/** La fiche et les demandes, lues une fois, et l'audit qui en sort. */
export function usePresence() {
  const etat = useMaFiche((s) => s.etat);
  const fiche = useMaFiche((s) => s.fiche);
  const charger = useMaFiche((s) => s.charger);
  const demandes = useDemandes((s) => s.demandes);
  const chargerDemandes = useDemandes((s) => s.charger);
  const repondues = useSettingsStore((s) => s.repondues);
  useEffect(() => {
    if (etat === "inconnu") void charger();
    void chargerDemandes();
  }, [etat, charger, chargerDemandes]);
  const etapes = useMemo(() => (fiche ? auditPresence(fiche, demandes, repondues) : null), [fiche, demandes, repondues]);
  return { etat, fiche, etapes, demandes, repondues };
}

/** Où mène l'action d'un point : une question par-dessus l'écran, ou la bonne partie de la Vitrine. */
function cible(p: Point): { q?: Question; href?: string } {
  if (p.id === "places" || p.id === "prix") return { q: "places" };
  if (p.id === "propose") return { q: "propose" };
  if (p.id === "presentation") return { q: "presentation" };
  if (p.id === "email" || p.id === "tel") return { q: "contact" };
  if (p.id === "reponse") return { href: "/demandes" };
  return { href: `/ma-fiche?partie=${p.action?.partie ?? "places"}` };
}

/** Le bouton d'un point, et la feuille qu'il ouvre. */
export function Agir({ p, className = "btn", children }: { p: Point; className?: string; children?: React.ReactNode }) {
  const [q, setQ] = useState<Question | null>(null);
  const router = useRouter();
  const c = cible(p);
  const label = children ?? p.action?.label ?? "Voir";
  return (
    <>
      <button type="button" className={className} onClick={() => (c.q ? setQ(c.q) : router.push(c.href ?? "/ma-fiche"))}>
        {label}
        <Ic n="arrow" className="" />
      </button>
      {q && <FeuilleQuestion q={q} onClose={() => setQ(null)} />}
    </>
  );
}

const PASTILLE: Record<EtatPoint, string> = { ko: "pr-s-ko", mid: "pr-s-mid", ok: "pr-s-ok" };

export function Etat({ e, point }: { e: EtatPoint; point?: boolean }) {
  return (
    <span className={`pr-badge ${PASTILLE[e]}`}>
      <i />
      {point ? MOTS_POINT[e] : MOTS[e]}
    </span>
  );
}

/** Une étape du cavalier, sur l'accueil : sa scène, son état, sa phrase. */
export function CarteEtape({ e, delay = 0 }: { e: Etape; delay?: number }) {
  return (
    <div className="pr-stop rise" style={{ animationDelay: `${delay}s` }}>
      <span className={`pr-n pr-n-${e.etat}`}>{e.id}</span>
      <Link href={`/audit?etape=${e.id}`} className="pr-scard">
        <span className="pr-im">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene(SCENES[e.id])} alt="" loading="lazy" />
        </span>
        <span className="pr-bd">
          <span className="pr-row1">
            <b>{e.titre}</b>
            <Etat e={e.etat} />
          </span>
          <small>{e.verdict}</small>
          <span className="pr-more">
            Voir le détail
            <Ic n="arrow" className="" />
          </span>
        </span>
      </Link>
    </div>
  );
}

/** Un point de l'audit : son état, ce qu'on a vu et où, pourquoi ça compte, et son bouton. */
export function CartePoint({ p }: { p: Point }) {
  if (p.etat === "ok")
    return (
      <div className="pr-okr">
        <span className="pr-okic">
          <Ic n="ck" className="" />
        </span>
        <span>
          <b>{p.titre}</b>
          <small>{p.vu.map((v) => `${v.ou} : ${v.valeur}`).join(" · ")}</small>
        </span>
      </div>
    );
  return (
    <article className={`pr-pt pr-pt-${p.etat}`}>
      <div className="pr-pt-b">
        <span className="pr-tag">{MOTS_POINT[p.etat]}</span>
        <h4>{p.titre}</h4>
        <div className="pr-seen">
          {p.vu.map((v) => (
            <div key={v.ou}>
              <span>{v.ou}</span>
              <b className={v.mauvais ? "bad" : undefined}>{v.valeur}</b>
            </div>
          ))}
        </div>
        <p className="pr-why">
          <b>Pourquoi ça compte : </b>
          {p.pourquoi}
        </p>
      </div>
      {(p.action || p.id === "reponse") && (
        <div className="pr-foot">
          <Agir p={p} className="btn pr-btn-sm">
            {p.id === "reponse" ? "Voir mes demandes" : undefined}
          </Agir>
        </div>
      )}
    </article>
  );
}
