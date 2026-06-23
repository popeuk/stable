import { Search, Bell, ArrowUpRight } from "lucide-react";

/* Atomes visuels du skin éditorial. Server-safe (aucun hook). */

const HORSE_P1 =
  "M7 10l-.85 8.507a1.357 1.357 0 0 0 1.35 1.493h.146a2 2 0 0 0 1.857 -1.257l.994 -2.486a2 2 0 0 1 1.857 -1.257h1.292a2 2 0 0 1 1.857 1.257l.994 2.486a2 2 0 0 0 1.857 1.257h.146a1.37 1.37 0 0 0 1.364 -1.494l-.864 -9.506h-8c0 -3 -3 -5 -6 -5l-3 6l2 2l3 -2";
const HORSE_P2 = "M22 14v-2a3 3 0 0 0 -3 -3";
const HORSESHOE =
  "M19 17c.5 -1.242 2 -2 2 -5s-1 -9 -9 -9s-9 6 -9 9s1.495 3.749 2 5l-2 1l2 3l2.406 -1.147c1.25 -.714 1.778 -2.08 1.203 -3.363c-1.078 -2.407 -1.609 -8.49 3.391 -8.49s4.469 6.083 3.39 8.49c-.574 1.284 -.045 2.649 1.204 3.363l2.406 1.147l2 -3l-2 -1";

/** Cheval en line-art fin (Tabler, MIT). L'« image » éditoriale de l'app. */
export function HorseLine({
  size = 120,
  stroke = 1.3,
  color = "currentColor",
  className,
}: {
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={HORSE_P1} />
      <path d={HORSE_P2} />
    </svg>
  );
}

export function Horseshoe({
  size = 20,
  stroke = 1.6,
  color = "currentColor",
  className,
}: {
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={HORSESHOE} />
    </svg>
  );
}

/** Barre d'app en haut : logo + actions. Fine, carrée. */
export function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--o-line)] px-5 py-3.5">
      <div className="flex items-center gap-1.5">
        <Horseshoe size={18} stroke={2} />
        <span className="text-[17px] font-extrabold tracking-tight">Be Stable</span>
      </div>
      <div className="flex items-center gap-4 text-[var(--o-ink)]">
        <Search size={19} strokeWidth={1.6} />
        <Bell size={19} strokeWidth={1.6} />
      </div>
    </header>
  );
}

/** Petit label carré, fin. */
export function Tag({
  children,
  tone = "line",
}: {
  children: React.ReactNode;
  tone?: "line" | "ink" | "yellow" | "green" | "red";
}) {
  const styles: Record<string, string> = {
    line: "border border-[var(--o-line-strong)] text-[var(--o-ink)]",
    ink: "bg-[var(--o-ink)] text-[var(--o-bg)]",
    yellow: "bg-[var(--o-yellow)] text-[var(--o-ink)]",
    green: "bg-[var(--o-green)] text-white",
    red: "bg-[var(--o-red)] text-white",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/** Bouton rond avec flèche, accent jaune (comme OCITE). */
export function ArrowDisc({ size = 44 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "var(--o-yellow)" }}
    >
      <ArrowUpRight size={size * 0.5} strokeWidth={2} color="var(--o-ink)" />
    </span>
  );
}

/** En-tête de section : titre + lien fin. */
export function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--o-muted)]">
        {title}
      </h2>
      {action && (
        <span className="text-[12px] font-semibold text-[var(--o-muted)]">{action}</span>
      )}
    </div>
  );
}
