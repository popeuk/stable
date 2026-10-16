"use client";

import { useState } from "react";
import { Promo } from "@/components/carnet/ui";
import { getSession, type Session } from "@/lib/account/session";

/**
 * L'encart mon-ecurie.fr de l'accueil : de la promo assumée, toujours en
 * dernier. Le message suit où en est le gérant : pas encore de fiche (la
 * reprendre), fiche en vérification (préparer la suite), fiche en ligne (la
 * tenir à jour). Rien de promis que le site ne tient pas : un annuaire,
 * gratuit, sans commission. « Plus tard » le cache quinze jours.
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
          tag: "mon-ecurie.fr · ta fiche est en ligne",
          title: small ? "Les cavaliers te trouvent. Montre-leur la bonne écurie." : <>Les cavaliers te trouvent.<br />Montre-leur la bonne écurie.</>,
          text: "Une photo, tes places libres et tes formules : c’est ce qu’ils regardent avant d’écrire.",
          cta: "Mettre ma fiche à jour",
        }
      : statut === "revendication_en_attente" || statut === "creation_en_attente"
        ? {
            tag: "mon-ecurie.fr · fiche en vérification",
            title: "Ta fiche arrive. Prépare ta vitrine.",
            text: `On vérifie ${listing?.title ?? "ton écurie"}. En attendant, choisis ta plus belle photo et compte tes places libres.`,
            cta: "Voir ma fiche",
          }
        : {
            tag: "mon-ecurie.fr · gratuit, sans commission",
            title: small ? "Les cavaliers cherchent leur pension. Ton écurie y est peut-être déjà." : <>Les cavaliers cherchent leur pension.<br />Ton écurie y est peut-être déjà.</>,
            text: "Plus de 7 000 écuries sur la carte de France. Reprends la tienne avec ce même compte, en deux minutes.",
            cta: "Trouver mon écurie",
          };

  return (
    <div className="ac-promo">
      <Promo href="/ma-fiche" ping small={small} {...msg} />
      <button type="button" className="ac-promo-x" onClick={plusTard} aria-label="Masquer pour l’instant">
        Plus tard
      </button>
    </div>
  );
}
