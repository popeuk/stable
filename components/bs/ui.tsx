"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Picto, type PictoName } from "@/components/bs/picto";

/* ---------- Format ---------- */
/* Espace insécable ordinaire : la fine (U+202F) ne s’affiche pas dans nos polices. */
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf = { format: (n: number) => nf0.format(n).replace(/\u202f/g, "\u00a0") };
export const eur = (n: number) => `${nf.format(Math.round(n))} €`;
export const signed = (n: number) => {
  const r = Math.round(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${nf.format(Math.abs(r))} €`;
};
export const dec1 = (n: number) => (isFinite(n) ? n.toFixed(1).replace(".", ",") : "∞");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export { esc } from "@/lib/utils/esc";

/** Un lien brut (dans un message HTML) doit porter le préfixe de déploiement. */
export const withBase = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

/* ---------- Haut d'écran ---------- */
/**
 * Un écran. Sur ordinateur, « wide » occupe toute la largeur utile
 * (cockpit, planning, tableaux) ; sinon une colonne de lecture.
 */
export function Screen({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={`cn-page bs-screen${wide ? " wide" : ""}`}>{children}</div>;
}

export function Over({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="bs-over">
      <span>{left}</span>
      {right}
    </div>
  );
}

/** Le retour est dans l'en-tête (téléphone) ou au-dessus de l'écran (ordinateur). */
export function Back(_: { href: string; children: ReactNode }) {
  return null;
}

export function Title({ children, as = "h1" }: { children: ReactNode; as?: "h1" | "h2" }) {
  const Tag = as;
  return <Tag className="bs-d bs-t1">{children}</Tag>;
}

export function Sec({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <p className="bs-sec">
      <span>{children}</span>
      {action}
    </p>
  );
}

export function Pic({ name, tone }: { name: PictoName; tone?: "rose" | "soft" }) {
  return (
    <span className={`bs-pic ${tone ?? ""}`}>
      <Picto name={name} />
    </span>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="bs-tip">
      <span className="bs-pic">
        <Picto name="bulb" />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function NetPill({ value }: { value: number }) {
  const k = value > 0 ? "g" : value < 0 ? "r" : "n";
  return (
    <span className={`bs-pill ${k}`}>
      {k === "g" && <Picto name="up" />}
      {signed(value)}
    </span>
  );
}

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`bs-ck${on ? " on" : ""}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      <i>
        <Picto name="check" />
      </i>
    </button>
  );
}

export function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="bs-toggle" role="switch" aria-checked={on} onClick={onClick}>
      <span>{children}</span>
      <span className="bs-switch" aria-hidden="true" />
    </button>
  );
}

/** Le dessin du parcours : six barres, un flot à l'arrivée. */
export function CourseDrawing({ done }: { done: number }) {
  const jumps: [number, number][] = [
    [28, 150],
    [70, 108],
    [118, 128],
    [166, 92],
    [206, 112],
    [240, 70],
  ];
  const won = done >= 6;
  return (
    <svg viewBox="0 0 270 200" width="100%" style={{ maxWidth: 300, display: "block", margin: "4px auto 0" }} role="img" aria-label={`Parcours : ${done} obstacles passés sur 6`}>
      <path d="M6 170 C40 170 50 120 70 120 S100 150 118 140 S150 100 166 104 S195 130 206 124 S232 80 262 40" fill="none" stroke="#DCD6E0" strokeWidth="3" strokeDasharray="6 6" />
      {jumps.map(([x, y], k) => {
        const col = k < done ? "#134E3A" : k === done ? "#F6B3CB" : "#DCD6E0";
        return (
          <g key={k} transform={`translate(${x - 17} ${y - 30})`}>
            <rect width="4" height="32" rx="2" fill="#1B1225" />
            <rect x="30" width="4" height="32" rx="2" fill="#1B1225" />
            <rect y="9" width="34" height="5" rx="2.5" fill={col} />
            <rect y="18" width="34" height="5" rx="2.5" fill={col} />
            <circle cx="17" cy="44" r="9" fill={k <= done ? col : "#fff"} stroke={k <= done ? "none" : "#DCD6E0"} strokeWidth="1.5" />
            <text x="17" y="48" textAnchor="middle" fontWeight="700" fontSize="11" fill={k < done ? "#fff" : k === done ? "#0B3325" : "#7A7284"}>
              {k + 1}
            </text>
          </g>
        );
      })}
      <g transform="translate(236 2) rotate(8)">
        <path d="M10 26 L5 48 L11 44 L14 48 L17 30Z" fill={won ? "#134E3A" : "#DCD6E0"} />
        <path d="M24 26 L29 48 L23 44 L20 48 L17 30Z" fill={won ? "#134E3A" : "#E4DFE8"} />
        {Array.from({ length: 12 }, (_, a) => (
          <circle key={a} cx={17 + 14 * Math.cos((a * Math.PI) / 6)} cy={18 + 14 * Math.sin((a * Math.PI) / 6)} r="4" fill={won ? "#134E3A" : "#DCD6E0"} />
        ))}
        <circle cx="17" cy="18" r="14" fill={won ? "#134E3A" : "#DCD6E0"} />
        <circle cx="17" cy="18" r="11" fill={won ? "#F6B3CB" : "#fff"} />
      </g>
    </svg>
  );
}

/** Le flot gagné : la rosette de concours, un statut, jamais un décor. */
export function Rosette({ lines, size = 112 }: { lines: string[]; size?: number }) {
  return (
    <svg viewBox="0 0 120 146" width={size} style={{ transform: "rotate(-6deg)" }} role="img" aria-label={`Flot ${lines.join(" ")}`}>
      <path d="M44 84 L34 140 L46 130 L54 140 L60 90 Z" fill="#134E3A" />
      <path d="M76 84 L86 140 L74 130 L66 140 L60 90 Z" fill="#134E3A" opacity=".82" />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return <circle key={i} cx={60 + 41 * Math.cos(a)} cy={52 + 41 * Math.sin(a)} r="9.5" fill="#134E3A" />;
      })}
      <circle cx="60" cy="52" r="42" fill="#134E3A" />
      <circle cx="60" cy="52" r="35" fill="#F6B3CB" />
      <circle cx="60" cy="52" r="30" fill="none" stroke="#0B3325" strokeWidth=".9" strokeDasharray="1.6 2.4" />
      {lines.map((l, i) => (
        <text key={i} x="60" y={52 + (i - (lines.length - 1) / 2) * 14 + 4.5} textAnchor="middle" fontWeight="700" fontSize="12.5" fill="#0B3325">
          {l}
        </text>
      ))}
    </svg>
  );
}
