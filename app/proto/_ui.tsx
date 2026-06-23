/* Shared visual atoms for the "play" prototype skin. Server-safe (no hooks). */

/** The Be Stable coin — a yellow token with a horseshoe, à la Macadam's mascot. */
export function Coin({ size = 44 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: "var(--p-coin)",
        border: "2.5px solid var(--p-ink)",
        boxShadow: "0 3px 0 var(--p-ink)",
      }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M7 6 A6 6 0 1 0 17 6"
          stroke="var(--p-ink)"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="7" cy="6" r="1.5" fill="var(--p-ink)" />
        <circle cx="17" cy="6" r="1.5" fill="var(--p-ink)" />
      </svg>
    </span>
  );
}

/** Chunky rounded pill used for tags and amounts. */
export function Pill({
  children,
  bg = "var(--p-card)",
  className = "",
}: {
  children: React.ReactNode;
  bg?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-[2px] border-[var(--p-ink)] px-3 py-1 text-[13px] font-extrabold ${className}`}
      style={{ background: bg }}
    >
      {children}
    </span>
  );
}

/** Be Stable wordmark with the coin. */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Coin size={30} />
      <span
        className="proto-disp text-[20px]"
        style={{ color: light ? "#fff" : "var(--p-ink)" }}
      >
        Be Stable
      </span>
    </div>
  );
}
