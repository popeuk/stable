"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Ic, Ill, eur } from "@/components/carnet/ui";
import { usePerso } from "@/components/bs/essayer";
import { getSession } from "@/lib/account/session";
import type { ResumeEssai } from "@/lib/account/vault";
import { useSettingsStore } from "@/stores/settings-store";
import { localToday } from "@/lib/utils/local-date";

/**
 * « Tes chiffres sont sur ce téléphone seulement. Garde-les avec ton
 * e-mail. » : le bandeau discret de l'écurie essayée sans compte, qui dit
 * franchement où sont les chiffres tant qu'il n'y a pas de compte, au-dessus de la barre du bas. Il se montre une fois
 * les trois premiers obstacles passés (chevaux, tarifs, frais), pas avant.
 * Fermé, il revient le lendemain. Rien hors de la session locale.
 * À poser une fois dans app/(app)/layout.tsx.
 */
const MEM = "be-stable-garder";
interface Mem {
  ferme?: string;
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
  const parcours = useSettingsStore((s) => s.parcours);
  const [local, setLocal] = useState(false);
  const [ferme, setFerme] = useState(false);
  const voir = parcours.chevaux && parcours.tarifs && parcours.factures;

  useEffect(() => {
    if (getSession()?.kind !== "locale") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(true);
    if (lire().ferme === localToday()) setFerme(true);
  }, []);

  if (!local || !voir || ferme || path.startsWith("/compte")) return null;
  return (
    <div className="es-keep" role="region" aria-label="Garder mes chiffres">
      <span>
        <b>Tes chiffres sont sur ce téléphone seulement.</b> Garde-les avec ton e-mail.
      </span>
      <Link href="/compte/connexion?garder=1" className="btn">
        Garder mes chiffres
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

/** Ce qu'on garde : n chevaux, la pension, les frais, les séances notées. */
export function GardeListe({ r }: { r: ResumeEssai | null }) {
  if (!r) return null;
  const items: string[] = [];
  if (r.chevaux) items.push(r.chevaux > 1 ? `${r.chevaux} chevaux en pension` : "1 cheval en pension");
  if (r.pension) items.push(`Pension à ${eur(r.pension)} par mois`);
  if (r.frais) items.push(`Frais communs à ${eur(r.frais)} par mois`);
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

/** C'est gardé : la rosette, puis retour à l'écurie. */
export function GardeFait({ onOpen }: { onOpen: () => void }) {
  const perso = usePerso();
  return (
    <div className="ar-v es-done">
      <div className="hero-ill es-ros rise">
        <Ill n={perso === "m" ? "gerant-rosette" : "rosette"} alt={perso === "m" ? "Le gérant brandit une rosette." : "La gérante brandit une rosette."} />
      </div>
      <div className="q rise" style={{ animationDelay: ".1s" }}>
        <h2>C’est gardé.</h2>
        <p>Demain, ton e-mail suffit pour retrouver tes chiffres.</p>
      </div>
      <div className="foot rise" style={{ animationDelay: ".2s" }}>
        <button type="button" className="btn full" onClick={onOpen}>
          Revenir à mon écurie
        </button>
      </div>
    </div>
  );
}
