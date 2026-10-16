"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { plannedRest } from "@/components/bs/goal-card";
import { localToday } from "@/lib/utils/local-date";
import { CountUp, Ic, Ill, sg } from "@/components/carnet/ui";
import { phraseObjectif } from "@/lib/domain/objectif";

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Un chiffre qui compte d'une valeur à une autre, après un petit délai. */
export function useCompte(from: number, to: number, { ms = 1200, delay = 0 }: { ms?: number; delay?: number } = {}) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const t = setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const k = calme() ? 1 : Math.min(1, (now - start) / ms);
        setV(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, calme() ? 0 : delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [from, to, ms, delay]);
  return v;
}

/** Le chiffre du mois et ce qu'il faut pour le lire : objectif, ce qui est encore prévu au planning. */
export function useMois() {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const net = useMemo(() => monthBreakdown(data, currentPeriod()).net, [data]);
  const prevu = useMemo(() => Math.max(0, plannedRest(data, localToday())), [data]);
  const pct = objective > 0 ? Math.max(0, Math.min(100, (net / objective) * 100)) : 0;
  const left = Math.max(0, objective - net);
  return { net, objective, prevu, pct, left };
}

/** « Il te manque 448 € pour ton objectif de 1 000 €. » Sans objectif (0) : rien (lib/domain/objectif). */
export { phraseObjectif };

/** « d’ici le 31 » : la portée de ce qui est encore prévu, écrite. */
export const dIciFin = () => {
  const d = new Date();
  return `d’ici le ${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
};

/**
 * Le compteur du mois, en grand : ce qui te reste, le personnage à côté
 * (ill), la barre vers l'objectif s'il y en a un, et ce qui est encore prévu
 * au planning d'ici la fin du mois (en encre : ce n'est pas encore rentré).
 * Ce qui est passé compte déjà tout seul. Avec href, toute la carte mène au
 * détail (Mon mois). Sans objectif, une proposition discrète d'en fixer un,
 * sous la carte.
 */
export function Compteur({ href, ill, className = "" }: { href?: string; ill?: boolean; className?: string }) {
  const { net, objective, prevu, pct } = useMois();
  const tone = Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "";
  const phrase = phraseObjectif(net, objective);
  const prevuTxt = Math.round(prevu) > 0 ? `${sg(prevu)} encore prévu au planning ${dIciFin()}` : "";
  const inner: ReactNode = (
    <>
      <span className="ac-tx">
        <span className="k">{net < 0 ? "Ce mois, il te manque" : "Ce mois, il te reste"}</span>
        <span className={`big ${tone}`}>
          <CountUp value={net} ms={900} />
        </span>
        <span className="ac-sub">{phrase || "Une fois tout payé : pensions, soins, frais communs."}</span>
      </span>
      {ill && (
        <span className="ac-ill" aria-hidden="true">
          <Ill n="assise" />
        </span>
      )}
      {objective > 0 && (
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
      )}
      {(objective > 0 || prevuTxt) && (
        <span className="bar-lab">
          {objective > 0 && <span>{Math.round(pct)} % de ton objectif</span>}
          {prevuTxt && <span>{prevuTxt}</span>}
        </span>
      )}
      {href && (
        <span className="ac-go">
          Voir d’où ça vient
          <Ic n="chev" className="chev" />
        </span>
      )}
    </>
  );
  const label = `${net < 0 ? "Ce mois, il te manque" : "Ce mois, il te reste"} ${sg(net)}. ${phrase}${prevuTxt ? ` ${prevuTxt}.` : ""}`;
  const card = href ? (
    <Link href={href} className={`card moncard ac-cpt${ill ? "" : " nobag"}`} aria-label={`${label} Voir d’où ça vient.`}>
      {inner}
    </Link>
  ) : (
    <div className={`card moncard ac-cpt${ill ? "" : " nobag"}`} aria-label={label} role="group">
      {inner}
    </div>
  );
  return (
    <div className={`ac-cptw rise ${className}`} style={{ animationDelay: "0.04s" }}>
      {card}
      {objective <= 0 && href && (
        <Link href="/argent?objectif=1" className="ac-fixer">
          Te fixer un objectif pour le mois ?
        </Link>
      )}
    </div>
  );
}
