"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import { usePaniers } from "@/components/bs/paniers";
import { CountUp, Ic, Ill, eur, sg, type IllName } from "@/components/carnet/ui";

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

/** Le chiffre du mois et ce qu'il faut pour le lire : objectif, part à valider. */
export function useMois() {
  const data = useDataStore();
  const objective = useSettingsStore((s) => s.objective);
  const { total: aValider } = usePaniers();
  const net = useMemo(() => monthBreakdown(data, currentPeriod()).net, [data]);
  const pct = objective > 0 ? Math.max(0, Math.min(100, (net / objective) * 100)) : 0;
  const planPct = objective > 0 ? Math.max(0, Math.min(100 - pct, (aValider / objective) * 100)) : 0;
  const left = Math.max(0, objective - net);
  return { net, objective, aValider, pct, planPct, left };
}

/** « Il te manque 448 € pour ton objectif de 1 000 €. » */
export function phraseObjectif(net: number, objective: number) {
  if (objective <= 0) return "Fixe-toi un objectif dans Mon mois.";
  const left = Math.max(0, objective - net);
  return left > 0 ? `Il te manque ${eur(left)} pour ton objectif de ${eur(objective)}.` : `Objectif de ${eur(objective)} atteint.`;
}

/**
 * Le compteur du mois, en grand : ce qui te reste, la sacoche et ses pièces,
 * la barre vers l'objectif, et la part hachurée encore à valider (le total
 * des paniers). Avec href, toute la carte mène au détail (Mon mois).
 * perch : un personnage assis sur la carte (l'accueil).
 */
export function Compteur({ href, perch, className = "" }: { href?: string; perch?: IllName; className?: string }) {
  const { net, objective, aValider, pct, planPct } = useMois();
  const tone = Math.round(net) > 0 ? "in" : Math.round(net) < 0 ? "out" : "";

  // Quand le chiffre monte (un panier validé), une pièce tombe dans la sacoche.
  const avant = useRef(net);
  const [drop, setDrop] = useState(0);
  useEffect(() => {
    const monte = Math.round(net - avant.current) > 0;
    avant.current = net;
    if (!monte || calme()) return;
    setDrop((n) => n + 1);
  }, [net]);

  const piles = Math.max(0, Math.min(5, Math.round(pct / 20)));
  const inner: ReactNode = (
    <>
      <span className="ac-tx">
        <span className="k">{net < 0 ? "Ce mois, il te manque" : "Ce mois, il te reste"}</span>
        <span className={`big ${tone}`}>
          <CountUp value={net} ms={900} />
        </span>
        <span className="ac-sub">{phraseObjectif(net, objective)}</span>
      </span>
      <span className={`ac-bag${drop ? " bump" : ""}`} key={`bag-${drop}`} aria-hidden="true">
        <Ill n="sacoche" />
        <span className="ac-tas">
          {Array.from({ length: piles }, (_, i) => (
            <i key={i} style={{ bottom: i * 6 }} />
          ))}
        </span>
        {drop > 0 && <i className="ac-drop" />}
      </span>
      {objective > 0 && (
        <>
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
            {planPct > 0 && <i className="plan" style={{ left: `${pct}%`, width: `${planPct}%` }} />}
          </span>
          <span className="bar-lab">
            <span>{Math.round(pct)} % de ton objectif</span>
            {Math.round(aValider) > 0 && <span>{sg(aValider)} à valider</span>}
          </span>
        </>
      )}
      {href && (
        <span className="ac-go">
          Voir d’où ça vient
          <Ic n="chev" className="chev" />
        </span>
      )}
    </>
  );
  const label = `${net < 0 ? "Ce mois, il te manque" : "Ce mois, il te reste"} ${sg(net)}. ${phraseObjectif(net, objective)}${Math.round(aValider) > 0 ? ` ${sg(aValider)} à valider.` : ""}`;
  const card = href ? (
    <Link href={href} className="card moncard ac-cpt" aria-label={`${label} Voir d’où ça vient.`}>
      {inner}
    </Link>
  ) : (
    <div className="card moncard ac-cpt" aria-label={label} role="group">
      {inner}
    </div>
  );
  if (!perch) return <div className={`ac-cptw rise ${className}`}>{card}</div>;
  const homme = perch.startsWith("gerant");
  return (
    <div className={`perch ac-perch rise ${className}`} style={{ animationDelay: "0.04s" }}>
      <div className="sitw">
        <Ill n={perch} alt={`${homme ? "Un gérant assis" : "Une gérante assise"} sur le chiffre du mois, un café à la main.`} />
      </div>
      {card}
    </div>
  );
}
