import { HorseLine } from "@/components/ed/atoms";

/**
 * The co-pilot speaking — a contextual, teaching voice present across the app.
 * Dark editorial block with the line-art companion.
 */
export function CopiloteNote({
  children,
  label = "Ton copilote",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="relative overflow-hidden border border-[var(--text-primary)] bg-[var(--text-primary)] p-5 text-[var(--bg-base)]">
      <HorseLine
        size={120}
        stroke={0.9}
        color="rgba(255,255,255,0.06)"
        className="pointer-events-none absolute -right-3 -top-2"
      />
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
        {label}
      </p>
      <div className="relative mt-2 text-[15px] font-medium leading-relaxed">{children}</div>
    </div>
  );
}
