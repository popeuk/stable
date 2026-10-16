"use client";

import { useState, type ReactNode } from "react";
import { Promo } from "@/components/carnet/ui";
import { getSession, type Session } from "@/lib/account/session";

/**
 * L'encart mon-ecurie.fr de l'accueil : de la promo assumée, toujours en
 * dernier. Le message suit où en est le gérant : pas encore de fiche (la
 * reprendre), fiche en vérification (préparer la suite), fiche en ligne (la
 * tenir à jour). Rien de promis que le site ne tient pas : un annuaire,
 * gratuit, sans commission. « Plus tard » le cache quinze jours. En tête,
 * la marque telle que sur le site : la rosette et « mon écurie, par Be Stable ».
 */
const KEY = "be-stable-promo-mon-ecurie";
const PAUSE = 15 * 24 * 3600 * 1000;

function enPause() {
  try {
    const t = Number(localStorage.getItem(KEY));
    return !!t && Date.now() - t < PAUSE;
  } catch {
    return false;
  }
}

export function PromoMonEcurie({ small }: { small?: boolean }) {
  // L'accueil n'est rendu que dans le navigateur (ClientGate) : on lit tout de suite.
  const [etat, setEtat] = useState<{ s: Session | null; cache: boolean }>(() => ({ s: getSession(), cache: enPause() }));
  if (etat.cache) return null;

  const listing = etat.s?.kind === "compte" ? etat.s.listing : null;
  const statut = listing?.status ?? "aucune";
  const plusTard = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setEtat({ ...etat, cache: true });
  };

  const msg =
    statut === "validee"
      ? {
          etat: "ta fiche est en ligne",
          title: small ? "Les cavaliers te trouvent. Montre-leur la bonne écurie." : <>Les cavaliers te trouvent.<br />Montre-leur la bonne écurie.</>,
          text: "Une photo, tes places libres et tes formules : c’est ce qu’ils regardent avant d’écrire.",
          cta: "Mettre ma fiche à jour",
        }
      : statut === "revendication_en_attente" || statut === "creation_en_attente"
        ? {
            etat: "en vérification",
            title: "Ta fiche arrive. Prépare ta vitrine.",
            text: `On vérifie ${listing?.title ?? "ton écurie"}. En attendant, choisis ta plus belle photo et compte tes places libres.`,
            cta: "Voir ma fiche",
          }
        : {
            etat: "gratuit, sans commission",
            title: small ? "Les cavaliers cherchent leur pension. Ton écurie y est peut-être déjà." : <>Les cavaliers cherchent leur pension.<br />Ton écurie y est peut-être déjà.</>,
            text: "Plus de 12 000 écuries sur la carte de France. Reprends la tienne avec ce même compte, en deux minutes.",
            cta: "Trouver mon écurie",
          };

  return (
    <div className="ac-promo">
      <Promo href="/ma-fiche" ping small={small} title={msg.title} text={msg.text} cta={msg.cta} tag={<Marque etat={msg.etat} />} />
      <button type="button" className="ac-promo-x" onClick={plusTard} aria-label="Masquer pour l’instant">
        Plus tard
      </button>
    </div>
  );
}

/** La rosette de mon-ecurie.fr, dessinée comme sur le site (pc-signe). */
const PERLES: [number, number][] = [
  [43.4, 24], [42.23, 30.64], [38.86, 36.47], [33.7, 40.8], [27.37, 43.11], [20.63, 43.11], [14.3, 40.8], [9.14, 36.47], [5.77, 30.64],
  [4.6, 24], [5.77, 17.36], [9.14, 11.53], [14.3, 7.2], [20.63, 4.89], [27.37, 4.89], [33.7, 7.2], [38.86, 11.53], [42.23, 17.36],
];
const POINTS: [number, number][] = [[17.1, 18.6], [30.9, 18.6], [17.3, 22.6], [30.7, 22.6], [18.6, 27.2], [29.4, 27.2]];

function Marque({ etat }: { etat: ReactNode }) {
  return (
    <span className="me-marque">
      <svg viewBox="0 0 48 48" className="me-signe" aria-hidden="true">
        <g fill="#134E3A">
          {PERLES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.6" />
          ))}
          <circle cx="24" cy="24" r="19.4" />
        </g>
        <circle cx="24" cy="24" r="15" fill="#F6B3CB" />
        <path d="M17.2 15.6c-.3 2.6-.4 5.2-.1 7.7a6.9 6.9 0 0 0 13.8 0c.3-2.5.2-5.1-.1-7.7" fill="none" stroke="#0B3325" strokeWidth="3.4" strokeLinecap="round" />
        <g fill="#F6B3CB">
          {POINTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r=".8" />
          ))}
        </g>
      </svg>
      <span className="me-txt">
        <span className="me-nom">mon écurie</span>
        <span className="me-par">par Be Stable</span>
      </span>
      <span className="me-etat">{etat}</span>
    </span>
  );
}
