"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { withBase } from "@/components/bs/ui";
import { coatOf } from "@/components/bs/horse-face";
import type { Horse } from "@/lib/domain/types";

/**
 * Les briques du carnet illustré (maquettes validées du 15 octobre 2026).
 * Règle de couleur : tout est papier et encre ; <Money> met en vert ce qui
 * rentre et en rose ce qui sort, toujours avec le signe. Les illustrations
 * portent les couleurs de la cour. Classes : app/carnet.css.
 */

/* ---------- Format ---------- */
/* Espace insécable ordinaire : la fine (U+202F) ne s’affiche pas dans nos polices. */
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf = { format: (n: number) => nf0.format(n).replace(/\u202f/g, "\u00a0") };
/** À l'euro, symétrique : 500,5 donne 501 et −500,5 donne −501 (le même chiffre, rentré ou sorti). */
const arrondi = (n: number) => Math.sign(n) * Math.round(Math.abs(n)) || 0;
export const eur = (n: number) => `${nf.format(arrondi(n))} €`;
export const sg = (n: number) => {
  const r = arrondi(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${nf.format(Math.abs(r))} €`;
};
/** Au centime quand il y en a (« 12,50 € »), à l'euro sinon : pour un montant saisi, jamais pour un total. */
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const auCentime = (n: number) => {
  const a = Math.round(Math.abs(n) * 100) / 100;
  return Number.isInteger(a) ? nf.format(a) : nf2.format(a).replace(/\u202f/g, "\u00a0");
};
export const eurc = (n: number) => `${auCentime(n)} €`;
export const sgc = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${auCentime(r)} €`;
};
const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Icônes (trait 1,6, bouts ronds) ---------- */
const P: Record<string, string> = {
  home: "M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  cal: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 3v4M15 3v4",
  horse: "M7 20c1-4 1-6 3-8l-4 1c-2 0-2-2-1-3l5-5c2-1 4-1 5 0l1-2 1 3c2 2 3 5 3 9v5",
  menu: "M4 7h16M4 12h16M4 17h10",
  plus: "M12 5v14M5 12h14",
  ck: "m5 12.5 4.5 4.5L19 7.5",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.7 9.4a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.6M12 16.8v.1",
  back: "m15 6-6 6 6 6",
  chev: "m9 6 6 6-6 6",
  chevL: "m15 6-6 6 6 6",
  search: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.5-4.5",
  x: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  euro: "M17 6.5A6.5 6.5 0 1 0 17 17.5M5 10h9M5 14h9",
  list: "M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01",
  chart: "M4 20h16M7 16v-4M12 16V7M17 16v-7",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6",
  board: "M4 5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1zM16 5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  clock: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2",
  mic: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  hay: "M4 9.5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5zM4 12h16M9 8v10M15 8v10",
  shoe: "M7 20V11a5 5 0 0 1 10 0v9M5 20h4M15 20h4",
  syringe: "m14 4 6 6M17 7l-9 9-3 1 1-3 9-9M10 10l4 4M4 20l2-2",
  pen: "M4 20h4l10-10-4-4L4 16zM13 7l4 4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  copy: "M8 8h11v11H8zM5 16V5h11",
  install: "M12 3v10M8 9l4 4 4-4M5 15v4h14v-4",
  key: "M15 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 12l-7 7M6 17l2 2",
  pause: "M8 5v14M16 5v14",
  people: "M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM3 20c1-3.5 3.5-5 6-5s5 1.5 6 5M17 6a3 3 0 0 1 0 6M21 19c-.5-2.5-2-4-4-4.5",
};
export function Ic({ n, className = "cn-ic", label }: { n: string; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
      <path d={P[n] ?? P.chev} />
    </svg>
  );
}

/* ---------- Illustrations ---------- */
export type IllName =
  | "assise" | "brouette" | "carnet-buste" | "carnet" | "cavaliere" | "confirmer" | "dodo" | "foin" | "guide"
  | "matin" | "piste" | "promo" | "rosette" | "sacoche" | "sereine" | "soir" | "tete-fondu" | "tete"
  | "gerant-assise" | "gerant-buste" | "gerant-foin" | "gerant-rosette";
export function Ill({ n, alt = "", className = "", style }: { n: IllName; alt?: string; className?: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`ill ${className}`} src={withBase(`/img/carnet/${n}.webp`)} alt={alt} style={style} draggable={false} loading="lazy" decoding="async" />;
}

/* ---------- Chevaux : une seule tête, la robe par filtre ---------- */
export const COAT_FILTER: Record<string, string> = {
  alezan: "none",
  bai: "brightness(.7) saturate(1.05)",
  noir: "brightness(.38) saturate(.55)",
  gris: "grayscale(1) brightness(1.32) contrast(.92)",
  isabelle: "hue-rotate(8deg) brightness(1.25) saturate(.75)",
  pie: "grayscale(.4) brightness(1.5) contrast(.9)",
};
export const coatFilter = (h?: Pick<Horse, "id"> & { coat?: string }) => COAT_FILTER[h ? coatOf(h) : "alezan"] ?? "none";
export function Face({ horse, size, className = "" }: { horse?: Pick<Horse, "id" | "name"> & { coat?: string }; size?: number; className?: string }) {
  return (
    <span className={`face ${className}`} style={size ? { width: size, height: size } : undefined}>
      <Ill n="tete" alt={horse?.name ?? ""} style={{ filter: coatFilter(horse) }} />
    </span>
  );
}
export function Portrait({ horse }: { horse?: Pick<Horse, "id" | "name"> & { coat?: string } }) {
  return (
    <div className="portrait">
      <span className="disc">
        <span className="horse2">
          <Ill n="tete" alt={horse?.name ?? ""} style={{ filter: coatFilter(horse) }} />
        </span>
      </span>
    </div>
  );
}
export const ini = (n: string) =>
  n
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ---------- Argent ---------- */
export function Money({ v, className = "", plain, exact }: { v: number; className?: string; plain?: boolean; exact?: boolean }) {
  const r = exact ? Math.round(v * 100) / 100 : arrondi(v);
  return <span className={`${r > 0 ? "in" : r < 0 ? "out" : "num"} ${className}`}>{plain ? (exact ? eurc : eur)(Math.abs(v)) : (exact ? sgc : sg)(v)}</span>;
}

/** Un chiffre qui compte jusqu'à sa valeur, puis suit ses changements. */
export function CountUp({ value, fmt = sg, ms = 1100 }: { value: number; fmt?: (n: number) => string; ms?: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = calme() ? 1 : Math.min(1, (t - start) / ms);
      setV(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className="num">{fmt(v)}</span>;
}

/* ---------- Le carnet ---------- */
/**
 * Une partie : la vignette dans la marge, centrée sur la ligne du titre.
 * blk : bloc discret (ce qui demande une action ou une attention).
 */
export function Sec({ ill, illStyle, title, action, blk, nomarge, delay = 0, className = "", id, children }: { ill?: IllName; illStyle?: CSSProperties; title?: ReactNode; action?: ReactNode; blk?: boolean; nomarge?: boolean; delay?: number; className?: string; id?: string; children?: ReactNode }) {
  return (
    <section id={id} className={`sec rise${blk ? " blk" : ""}${nomarge || !ill ? " nomarge" : ""} ${className}`} style={{ animationDelay: `${delay}s` }}>
      {ill && !nomarge && (
        <div className="marge">
          <Ill n={ill} style={illStyle} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        {title && (
          <h4>
            <span>{title}</span>
            {action}
          </h4>
        )}
        {children}
      </div>
    </section>
  );
}

export function Hello({ title, sub, delay = 0.04 }: { title: ReactNode; sub?: ReactNode; delay?: number }) {
  return (
    <div className="hello rise" style={{ animationDelay: `${delay}s` }}>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
    </div>
  );
}

export function Steam() {
  return (
    <span className="steam" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function Coins({ style }: { style?: CSSProperties }) {
  return (
    <span className="coins" style={style} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** La carte coche ronde : la coche se dessine. */
export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`ck${on ? " on" : ""}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      <svg viewBox="0 0 24 24">
        <path d={P.ck} />
      </svg>
    </button>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: "in" | "out" | "ink" }) {
  return <span className={`pill${tone ? " " + tone : ""}`}>{children}</span>;
}

/** L'encart promo : de la promo assumée et soignée, toujours en dernier. */
export function Promo({ href, ill = "promo", tag, title, text, cta, contain, small, ping, external }: { href: string; ill?: IllName; tag: ReactNode; title: ReactNode; text: ReactNode; cta: string; contain?: boolean; small?: boolean; ping?: boolean; external?: boolean }) {
  const inner = (
    <>
      <span className="art">
        <Ill n={ill} alt="" />
        {ping && <span className="ping" aria-hidden="true" />}
      </span>
      <span className="bd">
        <span className="tag">{tag}</span>
        <strong>{title}</strong>
        <span className="tx">{text}</span>
        <span className="cta">
          {cta}
          <Ic n="arrow" className="" />
        </span>
      </span>
    </>
  );
  const cls = `promo rise${contain ? " contain" : ""}${small ? " small" : ""}`;
  return external ? (
    <a className={cls} href={href} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  );
}

/** Onglets en segment ; le panneau se choisit dehors avec la valeur. */
export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label?: string }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, ReactNode][] }) {
  return (
    <div className="chips">
      {options.map(([k, l]) => (
        <button key={k} type="button" className={`chip${value === k ? " on" : ""}`} aria-pressed={value === k} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`switch${on ? " on" : ""}`} onClick={onClick} style={{ width: "100%", background: "none", border: 0, textAlign: "left", cursor: "pointer" }}>
      <span>{children}</span>
      <i />
    </button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Moins" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <b>{value}</b>
      <button type="button" aria-label="Plus" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

export function Tip({ ill = "piste", children }: { ill?: IllName; children: ReactNode }) {
  return (
    <div className="tip">
      <Ill n={ill} />
      <span>{children}</span>
    </div>
  );
}

export function Empty({ ill = "dodo", children }: { ill?: IllName; children: ReactNode }) {
  return (
    <div className="empty">
      <Ill n={ill} />
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

/** Un écran de l'app : colonne au téléphone, page large sur ordinateur. */
export function Page({ children, wide, className = "" }: { children: ReactNode; wide?: boolean; className?: string }) {
  return <div className={`cn-page${wide ? " wide" : ""} ${className}`}>{children}</div>;
}
