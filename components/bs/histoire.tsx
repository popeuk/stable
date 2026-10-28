"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Ill } from "@/components/carnet/ui";
import { illPerso, usePerso } from "@/components/bs/perso";
import "@/app/carnet/ob-fort.css";

/**
 * L'histoire d'ouverture : trois scènes de la gérante (ou du gérant), le
 * matin, le soir, puis avec Be Stable. C'est le premier écran d'un nouveau
 * venu (Bienvenue) et de l'inscription (Rejoindre).
 */
const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Les scènes racontent l'entrée gratuite (28 octobre 2026, demande de Samuel) : la fiche et les
 * demandes des cavaliers. Plus de « comptes du soir » : Mon argent n'est pas encore ouvert.
 */
const SCENES: { ill: "matin" | "cavaliere" | "sereine"; alt: string; t: string; s: string; fx?: "rays" | "lamp" }[] = [
  { ill: "matin", alt: "La gérante porte une botte de foin devant les box, au lever du soleil.", t: "Le matin, tu es sur le pont.", s: "Le foin, l’eau, le crottin, les sabots. Ta fiche sur internet attend son tour." },
  { ill: "cavaliere", alt: "Une cavalière cherche une pension sur son téléphone, appuyée à la barrière du paddock.", t: "Le soir, une cavalière cherche une pension.", s: "Sur son téléphone, elle compare les prix, les places libres et les photos. Puis elle écrit aux écuries qui l’ont convaincue." },
  { ill: "sereine", alt: "La gérante sourit à son téléphone, son cheval tout contre elle.", t: "Avec Be Stable, ton écurie grandit.", s: "Ta fiche à jour, et les demandes des cavaliers au même endroit. C’est gratuit." },
];
const DUREE = 5000;

/**
 * Le cadre de chaque image de scène, gérante et gérant (format largeur / hauteur),
 * et où se pose la lueur (soleil du matin, lampe du soir), en % de l'image :
 * la lueur suit le dessin, quel que soit l'écran et le personnage.
 */
const CADRES: Record<string, { r: number; x?: number; y?: number; d?: number }> = {
  // Scènes en décor papier (900 x 1200) : la lumière du matin et la lampe du soir sont dans l'image.
  matin: { r: 3 / 4 },
  "gerant-matin": { r: 3 / 4 },
  soir: { r: 3 / 4 },
  "gerant-soir": { r: 3 / 4 },
  sereine: { r: 3 / 4 },
  // Image en largeur (900 × 657) : elle garde son format dans le cadre de la scène.
  cavaliere: { r: 900 / 657 },
  "gerant-sereine": { r: 3 / 4 },
};
const cadre = (n: string) => {
  const c = CADRES[n] ?? { r: 1 };
  return { "--r": c.r, "--sx": `${c.x ?? 50}%`, "--sy": `${c.y ?? 30}%`, "--sd": `${c.d ?? 60}%` } as CSSProperties;
};

/** Trois scènes qui défilent seules (5 s), toucher avance, la dernière attend ; ou une seule, fixe. */
export function Stories({
  onStart,
  login,
  loginLabel = "Me connecter",
  busy = false,
  sous,
  cta = "Commencer",
  fixe = false,
}: {
  onStart: () => void;
  login: boolean;
  loginLabel?: string;
  busy?: boolean;
  /** Sous « Commencer » : « J'ai une sauvegarde ». */
  sous?: ReactNode;
  /** Le bouton de la dernière scène (entrée directe : « Trouver mon écurie »). */
  cta?: string;
  /** Une seule scène, la dernière (« Avec Be Stable, ton écurie grandit »), sans barres ni défilement : l'entrée directe (28 octobre 2026). */
  fixe?: boolean;
}) {
  const scenes = fixe ? SCENES.slice(-1) : SCENES;
  const [i, setI] = useState(0);
  const perso = usePerso();
  const bars = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const fill = (k: number) => bars.current.forEach((b, j) => b && (b.style.transform = `scaleX(${j < i ? 1 : j === i ? k : 0})`));
    if (calme()) return fill(1);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / DUREE);
      fill(k);
      if (k >= 1 && i < scenes.length - 1) return setI(i + 1);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const dernier = i === scenes.length - 1;
  return (
    <div className="ar-stwrap obn-st">
      <h1 className="sr-only">Be Stable, ton écurie et ce qu’elle te rapporte</h1>
      <div className="stories">
        {/* Une seule scène : les barres gardent leur place dans la mise en page, invisibles. */}
        <div className="bars" aria-hidden="true" style={scenes.length > 1 ? undefined : { visibility: "hidden" }}>
          {scenes.map((s, j) => (
            <i key={s.ill}>
              <b ref={(el) => void (bars.current[j] = el)} />
            </i>
          ))}
        </div>
        {login && (
          <Link href="/compte/connexion" className="ar-link ar-login">
            {loginLabel}
          </Link>
        )}
        <button type="button" className="stage" aria-label={fixe ? "Be Stable" : dernier ? `Scène ${i + 1} sur 3` : "Écran suivant"} tabIndex={fixe ? -1 : undefined} onClick={() => setI((x) => Math.min(x + 1, scenes.length - 1))}>
          {scenes.map((s, j) => (
            <span key={s.ill} className={`slide${j === i ? " on" : ""}`} aria-hidden={j !== i}>
              <span className="art">
                <span className="art-fit" style={cadre(illPerso(s.ill, perso).n)}>
                  {s.fx === "rays" && <span className="ar-rays" />}
                  {s.fx === "lamp" && <span className="ar-lamp" />}
                  <Ill n={s.ill} alt={s.alt} className="mul" prio={j === 0} />
                </span>
              </span>
              <span className="tx" aria-live={j === i ? "polite" : undefined}>
                <strong>{s.t}</strong>
                <span>{s.s}</span>
              </span>
            </span>
          ))}
        </button>
        <div className="cta">
          <button type="button" className="btn" disabled={busy} onClick={onStart}>
            {busy ? "On prépare ton écurie…" : cta}
          </button>
          {sous}
        </div>
      </div>
    </div>
  );
}
