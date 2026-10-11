import type { Horse } from "@/lib/domain/types";

/**
 * Le portrait d'un cheval : une tête de profil, dans sa robe. Un gérant
 * reconnaît ses chevaux à leur robe avant leur nom ; c'est ce qui remplace
 * les initiales. La robe vient du cheval (champ coat), sinon d'un tirage
 * stable sur son identifiant.
 */
export const COATS = {
  alezan: { label: "Alezan", c: "#B4612C", m: "#8A4520", swatch: "#B4612C" },
  bai: { label: "Bai", c: "#6E4128", m: "#2A1C18", swatch: "#6E4128" },
  noir: { label: "Noir", c: "#2E2733", m: "#17121B", swatch: "#2E2733" },
  gris: { label: "Gris", c: "#B7B1BC", m: "#7F7884", swatch: "#B7B1BC" },
  isabelle: { label: "Isabelle", c: "#D8B06A", m: "#8C6A35", swatch: "#D8B06A" },
  pie: { label: "Pie", c: "#F4EFE7", m: "#6E4128", swatch: "linear-gradient(135deg,#F4EFE7 50%,#6E4128 50%)" },
} as const;
export type Coat = keyof typeof COATS;
export const COAT_KEYS = Object.keys(COATS) as Coat[];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function coatOf(h: Pick<Horse, "id"> & { coat?: string }): Coat {
  if (h.coat && h.coat in COATS) return h.coat as Coat;
  return COAT_KEYS[hash(h.id) % COAT_KEYS.length];
}

export function blazeOf(h: Pick<Horse, "id"> & { blaze?: boolean }): boolean {
  if (typeof h.blaze === "boolean") return h.blaze;
  return hash(h.id + "b") % 2 === 0;
}

export function HorseFace({
  horse,
  size = 44,
  coat,
  blaze,
}: {
  horse?: Pick<Horse, "id"> & { coat?: string; blaze?: boolean };
  size?: number;
  coat?: Coat;
  blaze?: boolean;
}) {
  const k = coat ?? (horse ? coatOf(horse) : "alezan");
  const b = blaze ?? (horse ? blazeOf(horse) : true);
  const { c, m } = COATS[k];
  return (
    <span className="bs-face" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" fill="#F1EEF3" />
        <path
          d="M30 100 C33 82 36 70 40 62 L30 66 C22 70 14 68 12 60 C10 54 14 48 20 44 L40 28 C46 23 52 20 58 20 L62 8 L66 19 L71 10 L72 24 C82 34 88 50 88 70 L90 100 Z"
          fill={c}
        />
        <path
          d="M58 20 C66 22 72 28 74 36 C70 34 66 33 64 34 C68 40 76 46 80 54 C76 54 72 52 70 51 C74 58 80 64 84 70 C82 70 79 69 77 68 C80 76 84 84 88 90 L90 100 L84 100 C82 80 78 62 70 48 C66 40 62 32 58 20 Z"
          fill={m}
        />
        {b && <path d="M40 30 C34 36 26 44 20 50 C24 49 28 46 31 43 C35 39 38 34 40 30 Z" fill="#fff" opacity=".9" />}
        <circle cx="44" cy="38" r="2.6" fill="#1B1225" />
        <circle cx="44.8" cy="37.2" r=".8" fill="#fff" />
        <path d="M14 56 C16 57 18 57 19 56" stroke="#1B1225" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
