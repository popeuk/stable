/**
 * Lire un montant tapé à la française. « 450,50 », « 450.50 », « 1 234,5 »,
 * « 1 234,50 € », « 1.234,50 » et « 1,234.50 » donnent tous le bon nombre,
 * au centime. Un seul utilitaire pour tous les champs de montant : une
 * virgule ne multiplie jamais un montant par cent.
 *
 * Règles :
 *  - les espaces (y compris insécables) et le signe « € » sont ignorés ;
 *  - avec une virgule et un point, le dernier des deux est la décimale,
 *    l'autre sépare les milliers ;
 *  - une seule virgule est toujours la décimale (« 1,234 » vaut 1,234) ;
 *  - plusieurs points ou plusieurs virgules séparent les milliers ;
 *  - un seul point suivi d'exactement trois chiffres reste une décimale
 *    (« 12.500 » vaut 12,5) : au téléphone, le point vient du clavier
 *    décimal, pas d'un séparateur de milliers ;
 *  - le résultat est arrondi au centime. Vide ou illisible : null.
 */
export function lireMontant(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : null;
  let s = raw.replace(/[\s  €]/g, "").replace(/eur(os?)?$/i, "");
  if (!s) return null;
  const neg = s.startsWith("-") || s.startsWith("−");
  if (neg) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  let norm: string;
  if (commas && dots) {
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    norm = s.split(thou).join("").replace(dec, ".");
    if ((norm.match(/\./g) ?? []).length > 1) return null;
  } else if (commas > 1 || dots > 1) {
    norm = s.replace(/[.,]/g, "");
  } else {
    norm = s.replace(",", ".");
  }
  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return neg ? -r : r;
}

/** Comme lireMontant, mais 0 pour un champ vide ou illisible. */
export const montantOuZero = (raw: string | number | null | undefined) => lireMontant(raw) ?? 0;

/**
 * Nettoie la saisie en cours de frappe, sans la déformer : des chiffres, une
 * seule virgule (le point du clavier devient une virgule), deux décimales au
 * plus, `maxInt` chiffres avant la virgule. « 450,5 » reste « 450,5 » pendant
 * qu'on tape « 450,50 ».
 */
export function saisieMontant(raw: string, maxInt = 6): string {
  const s = raw.replace(/[\s  €]/g, "").replace(/\./g, ",").replace(/[^\d,]/g, "");
  const i = s.indexOf(",");
  if (i < 0) return s.slice(0, maxInt);
  const ent = s.slice(0, i).slice(0, maxInt);
  const dec = s.slice(i + 1).replace(/,/g, "").slice(0, 2);
  return `${ent || "0"},${dec}`;
}

/** Un nombre remis dans un champ : « 450 », « 450,5 » ou « 450,50 » (jamais « 450.5 »). */
export function montantEnTexte(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return "";
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(".", ",");
}

/**
 * Une touche du pavé du montant appliquée au texte en cours : un chiffre,
 * « , » (une seule fois), « 00 », ou « del ». Deux décimales au plus,
 * 999 999 € au plus.
 */
export function toucheMontant(txt: string, k: string): string {
  if (k === "del") return txt.slice(0, -1);
  if (k === ",") return txt.includes(",") ? txt : `${txt || "0"},`;
  const next = saisieMontant(`${txt}${k}`);
  const [ent] = next.split(",");
  if (ent.length > 6 || (txt.includes(",") && (txt.split(",")[1]?.length ?? 0) >= 2)) return txt;
  if (next === "0" || /^0\d/.test(next)) return next.replace(/^0+(?=\d)/, "");
  return next;
}

/** « 12,5 € » pendant la frappe : la virgule et les décimales tapées restent visibles. */
export function montantTape(txt: string): string {
  if (!txt) return "";
  const [ent, dec] = txt.split(",");
  const e = new Intl.NumberFormat("fr-FR").format(Number(ent || "0")).replace(/ /g, " ");
  return dec === undefined ? `${e} €` : `${e},${dec} €`;
}
