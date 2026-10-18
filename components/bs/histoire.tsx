"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Ill } from "@/components/carnet/ui";
import { illPerso, usePerso } from "@/components/bs/perso";
import { Flot, useObV } from "@/components/bs/ob-fort";

/**
 * L'histoire d'ouverture : trois scènes de la gérante (ou du gérant), le
 * matin, le soir, puis avec Be Stable. C'est le premier écran d'un nouveau
 * venu (Bienvenue) et de l'inscription (Rejoindre).
 */
const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `hl` : le mot que le surligneur rose porte dans les propositions (?v=…), une fois par titre. */
const SCENES: { ill: "matin" | "soir" | "sereine"; alt: string; t: string; hl: string; s: string; fx?: "rays" | "lamp" }[] = [
  { ill: "matin", alt: "La gérante porte une botte de foin devant les boxes, au lever du soleil.", t: "Le matin, tu es sur le pont.", hl: "sur le pont", s: "Le foin, l’eau, le crottin, les sabots. Tu assures, même les yeux fermés.", fx: "rays" },
  { ill: "soir", alt: "La gérante, fatiguée, devant des papiers et une calculette.", t: "Le soir, les comptes te rattrapent.", hl: "les comptes", s: "Les papiers s’empilent. Et une question revient : ton écurie te fait-elle vivre ?", fx: "lamp" },
  { ill: "sereine", alt: "La gérante sourit à son téléphone, son cheval tout contre elle.", t: "Avec Be Stable, tu tiens les rênes.", hl: "les rênes", s: "Deux gestes pour noter ta journée. Un chiffre clair pour chaque cheval." },
];
const surligne = (t: string, hl: string) => {
  const i = t.indexOf(hl);
  return i < 0 ? t : (
    <>
      {t.slice(0, i)}
      <mark>{hl}</mark>
      {t.slice(i + hl.length)}
    </>
  );
};
const DUREE = 5000;

/**
 * Le cadre de chaque image de scène, gérante et gérant (format largeur / hauteur),
 * et où se pose la lueur (soleil du matin, lampe du soir), en % de l'image :
 * la lueur suit le dessin, quel que soit l'écran et le personnage.
 */
const CADRES: Record<string, { r: number; x?: number; y?: number; d?: number }> = {
  matin: { r: 638 / 627, x: 51, y: 34, d: 78 },
  "gerant-matin": { r: 674 / 638, x: 51, y: 33, d: 74 },
  soir: { r: 642 / 1198, x: 51, y: 27, d: 40 },
  "gerant-soir": { r: 642 / 1200, x: 51, y: 27, d: 40 },
  sereine: { r: 499 / 1072 },
  "gerant-sereine": { r: 465 / 1113 },
};
const cadre = (n: string) => {
  const c = CADRES[n] ?? { r: 1 };
  return { "--r": c.r, "--sx": `${c.x ?? 50}%`, "--sy": `${c.y ?? 30}%`, "--sd": `${c.d ?? 60}%` } as CSSProperties;
};

/** Trois scènes qui défilent seules (5 s), toucher avance, la dernière attend. */
export function Stories({
  onStart,
  login,
  loginLabel = "Me connecter",
  busy = false,
}: {
  onStart: () => void;
  login: boolean;
  loginLabel?: string;
  busy?: boolean;
}) {
  const [i, setI] = useState(0);
  const perso = usePerso();
  const v = useObV();
  const bars = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const fill = (k: number) => bars.current.forEach((b, j) => b && (b.style.transform = `scaleX(${j < i ? 1 : j === i ? k : 0})`));
    if (calme()) return fill(1);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / DUREE);
      fill(k);
      if (k >= 1 && i < SCENES.length - 1) return setI(i + 1);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i]);
  const dernier = i === SCENES.length - 1;
  return (
    <div className={`ar-stwrap${v ? ` obf-st obf-${v} obf-s${i}` : ""}`}>
      <h1 className="sr-only">Be Stable, ton écurie et ce qu’elle te rapporte</h1>
      <div className="stories">
        <div className="bars" aria-hidden="true">
          {SCENES.map((s, j) => (
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
        <button type="button" className="stage" aria-label={dernier ? `Scène ${i + 1} sur 3` : "Écran suivant"} onClick={() => setI((x) => Math.min(x + 1, SCENES.length - 1))}>
          {SCENES.map((s, j) => (
            <span key={s.ill} className={`slide s${j}${j === i ? " on" : ""}`} aria-hidden={j !== i}>
              <span className="art">
                <span className="art-fit" style={cadre(illPerso(s.ill, perso).n)}>
                  {s.fx === "rays" && <span className="ar-rays" />}
                  {s.fx === "lamp" && <span className="ar-lamp" />}
                  <Ill n={s.ill} alt={s.alt} className="mul" prio={j === 0} />
                </span>
                {v === "c" && j === SCENES.length - 1 && <Flot l1="Tu tiens" l2="les rênes" className="obf-tampon" />}
              </span>
              <span className="tx" aria-live={j === i ? "polite" : undefined}>
                <strong>{v ? surligne(s.t, s.hl) : s.t}</strong>
                <span>{s.s}</span>
              </span>
            </span>
          ))}
        </button>
        <div className="cta">
          <button type="button" className="btn" disabled={busy} onClick={onStart}>
            {busy ? "On prépare ton écurie…" : "Commencer"}
          </button>
        </div>
      </div>
    </div>
  );
}
