import { cn } from "@/lib/utils/cn";

const ACCENTS = [
  "#d4793d",
  "#7c9070",
  "#e8b547",
  "#c24b3d",
  "#7a9f5e",
  "#5b8def",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Elegant monogram placeholder when a horse has no photo (section 9.3). */
export function HorseAvatar({
  name,
  size = 44,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const accent = ACCENTS[hash(name) % ACCENTS.length];
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-fraunces)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `${accent}26`,
        color: accent,
        fontSize: size * 0.42,
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
