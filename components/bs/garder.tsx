"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Ic, Ill, eur } from "@/components/carnet/ui";
import { usePerso } from "@/components/bs/perso";
import { useOuChiffres } from "@/components/bs/ou-chiffres";
import { getSession } from "@/lib/account/session";
import type { ResumeEssai } from "@/lib/account/vault";
import { useDataStore } from "@/stores/data-store";
import { aDejaSaisi, nouvelleSaisie } from "@/lib/premiere-saisie";
import { localToday } from "@/lib/utils/local-date";

/**
 * « Tes chiffres sont sur ce téléphone seulement. Garde-les avec ton
 * e-mail. » : le bandeau discret de l'écurie essayée sans compte, qui dit
 * franchement où sont les chiffres tant qu'il n'y a pas de compte, au-dessus de la barre du bas. Il se montre
 * après la première vraie saisie du gérant (une séance, un soin, une
 * dépense, un paiement, un cheval renommé…, lib/premiere-saisie.ts), pas
 * juste après le parcours, et sur l'Accueil seulement (pas sur chaque onglet : le premier jour est
 * déjà assez chargé). Fermé, il revient le lendemain. Rien hors de la session locale.
 * À poser une fois dans app/(app)/layout.tsx.
 */
const MEM = "be-stable-garder";
interface Mem {
  ferme?: string;
  /** La première vraie saisie a eu lieu dans cette écurie d'essai (la date d'ouverture de la session). */
  saisi?: string;
}
const lire = (): Mem => {
  try {
    return JSON.parse(localStorage.getItem(MEM) ?? "{}") as Mem;
  } catch {
    return {};
  }
};
const ecrire = (m: Mem) => {
  try {
    localStorage.setItem(MEM, JSON.stringify(m));
  } catch {}
};

export function GarderBandeau() {
  const path = usePathname() ?? "";
  const [local, setLocal] = useState(false);
  const [ferme, setFerme] = useState(false);
  const voir = usePremiereSaisie(local);
  const ou = useOuChiffres();

  useEffect(() => {
    if (getSession()?.kind !== "locale") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(true);
    if (lire().ferme === localToday()) setFerme(true);
  }, []);

  if (!local || !voir || ferme || !/^\/accueil\/?$/.test(path)) return null;
  return (
    <div className="es-keep" role="region" aria-label="Créer mon compte">
      <span>
        <b>Tout est {ou.ou}.</b> Crée ton compte pour le garder.
      </span>
      <Link href="/compte/connexion?garder=1" className="btn">
        Créer mon compte
      </Link>
      <button
        type="button"
        className="es-x"
        aria-label="Fermer jusqu’à demain"
        onClick={() => {
          ecrire({ ...lire(), ferme: localToday() });
          setFerme(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * La première vraie saisie, retenue sur l'appareil pour cette écurie
 * d'essai : déjà faite (le carnet en garde la trace), ou guettée à chaque
 * changement du carnet tant que la coque est ouverte.
 */
function usePremiereSaisie(local: boolean) {
  const [saisi, setSaisi] = useState(false);
  useEffect(() => {
    if (!local) return;
    const sess = getSession();
    const at = sess?.kind === "locale" ? sess.at : "";
    const retenir = () => {
      ecrire({ ...lire(), saisi: at });
      setSaisi(true);
    };
    if (lire().saisi === at) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaisi(true);
      return;
    }
    const d0 = useDataStore.getState();
    if (d0.hydrated && aDejaSaisi(d0)) return retenir();
    const fin = useDataStore.subscribe((d, avant) => {
      if (!d.hydrated) return;
      if (!(avant.hydrated ? nouvelleSaisie(avant, d) : aDejaSaisi(d))) return;
      fin();
      retenir();
    });
    return fin;
  }, [local]);
  return saisi;
}

/** Ce qu'on garde : n chevaux, la pension, les frais, les séances notées. */
export function GardeListe({ r }: { r: ResumeEssai | null }) {
  if (!r) return null;
  const items: string[] = [];
  if (r.chevaux) items.push(r.chevaux > 1 ? `${r.chevaux} chevaux en pension` : "1 cheval en pension");
  if (r.pension) items.push(`Pension à ${eur(r.pension)} par mois`);
  if (r.frais) items.push(`Frais de l’écurie à ${eur(r.frais)} par mois`);
  if (r.seances) items.push(r.seances > 1 ? `${r.seances} séances notées` : "1 séance notée");
  if (!items.length) items.push("Ton écurie, telle que tu l’as laissée");
  return (
    <ul className="es-kept">
      {items.map((t) => (
        <li key={t}>
          <Ic n="ck" className="" />
          {t}
        </li>
      ))}
    </ul>
  );
}

/**
 * Le compte est prêt : la rosette, puis retour à l'écurie. Si le gérant a
 * choisi une fiche libre de mon-ecurie.fr, il peut la reprendre tout de
 * suite, sans obligation (sinon on le lui proposera plus tard, par e-mail).
 */
export function GardeFait({ onOpen, fiche, onFiche }: { onOpen: () => void; fiche?: { id: number; title: string } | null; onFiche?: (id: number) => void }) {
  const perso = usePerso();
  return (
    <div className="ar-v es-done">
      <div className="hero-ill es-ros rise">
        <Ill n={perso === "m" ? "gerant-rosette" : "rosette"} alt={perso === "m" ? "Le gérant brandit une rosette." : "La gérante brandit une rosette."} />
      </div>
      <div className="q rise" style={{ animationDelay: ".1s" }}>
        <h2>Ton compte est prêt.</h2>
        <p>Demain, ton e-mail suffit pour retrouver tes chiffres.</p>
      </div>
      <div className="foot rise" style={{ animationDelay: ".2s" }}>
        <button type="button" className="btn full" onClick={onOpen}>
          Revenir à mon écurie
        </button>
        {fiche && onFiche && (
          <button type="button" className="lnk" onClick={() => onFiche(fiche.id)}>
            Reprendre ma fiche mon-ecurie.fr
          </button>
        )}
      </div>
    </div>
  );
}
