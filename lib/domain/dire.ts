import type { ISODate, SeanceFormat } from "@/lib/domain/types";
import type { CareKind } from "@/lib/domain/care";
import { norm, parseDate } from "@/lib/domain/interpret";

/**
 * « Je préfère le dire » : une phrase dite au + devient un ajout prêt à
 * confirmer. « Cours collectif demain 18 h, 6 places », « Maréchal pour
 * Pacha jeudi 9 h, 85 € », « Réparation du tracteur 350 € », « PAC 4 200 € »,
 * « Livraison du foin lundi 8 h ». Rien n'est jamais refusé : ce qui n'est
 * pas compris devient une tâche au nom de la phrase, à corriger d'un toucher.
 * Domaine pur, déterministe, testé.
 */
export type DireType = "seance" | "soin" | "rdv" | "argent";
export type Pour = "cheval" | "ecurie" | "hors";

export interface Compris {
  type: DireType;
  date: ISODate;
  /** Le jour a-t-il été dit ? Sinon c'est aujourd'hui par défaut. */
  dateSaid: boolean;
  /** HH:MM, quand une heure est dite. */
  start?: string;
  places?: number;
  /** Le montant dit : prix de la place (séance), coût (soin), montant (argent). */
  amount?: number;
  sens?: "in" | "out";
  pour?: Pour;
  horseIds: string[];
  prestationId?: string;
  format?: SeanceFormat;
  /** Un cours qui n'existe pas encore : son nom, tel que dit. */
  coursName?: string;
  care?: CareKind;
  /** Ce que c'est, nettoyé des jours, heures, montants et chevaux. */
  label?: string;
}

export interface DireContext {
  today: ISODate;
  horses: { id: string; name: string }[];
  prestations?: { id: string; label: string; hasFormat?: boolean }[];
}

const SOINS: [RegExp, CareKind][] = [
  [/\b(marechal|marechal ferrant|ferrure|ferrer|parage)\b/, "ferrure"],
  [/\b(veterinaire|veto)\b/, "veto"],
  [/\bvermifuge/, "vermifuge"],
  [/\bvaccin/, "vaccin"],
  [/\b(dentiste|dents)\b/, "dentiste"],
  [/\b(osteo|osteopathe)\b/, "osteo"],
];
const SEANCE = /\b(cours|balade|stage|seance|lecon|reprise|longe|promenade)\b/;
const ENTREE = /\b(pac|subvention|vente|vendu|recu|rentre|rentree|aide|gagne|rapporte|remboursement|prime)\b/;
const SORTIE = /\b(sort|achat|achete|depense|facture|reparation|paye|payer)\b/;
const HORS = /rien a voir|hors chevaux|\b(tracteur|pac|subvention|banque|voiture|camion|maison|impots?)\b/;
const ECURIE = /\b(foin|paille|granules|litiere|loyer|electricite|toute l ?ecurie|tous les chevaux|ecurie)\b/;
const STOP = new Set(["cours", "cheval", "chevaux", "avec", "pour", "dans", "encadree", "encadre"]);

/** Les mots d'un texte normalisé, séparés par une espace, bordés d'espaces. */
const words = (s: string) => ` ${norm(s).split(/[^a-z0-9]+/).filter(Boolean).join(" ")} `;

/** Les chevaux nommés : nom entier, ou début de nom d'au moins 4 lettres (« PAC » n'est pas Pacha). */
export function chevauxDits(text: string, horses: { id: string; name: string }[]): string[] {
  const w = words(text);
  const toks = w.trim().split(" ");
  return horses
    .filter((h) => {
      const n = words(h.name).trim();
      if (!n) return false;
      if (w.includes(` ${n} `)) return true;
      return !n.includes(" ") && toks.some((t) => t.length >= 4 && n.startsWith(t));
    })
    .map((h) => h.id);
}

/** Un montant en euros : « 85 € », « 4 200 € », « 12,50 euros ». */
export function montantDit(text: string): number | undefined {
  const t = norm(text);
  const m = t.match(/(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:€|euros?\b|eur\b)/);
  if (!m) return undefined;
  const v = Number(m[1].replace(/[   ]/g, "") + (m[2] ? "." + m[2] : ""));
  return v > 0 && v < 1_000_000 ? v : undefined;
}

/**
 * Un montant dit sans « € », en fin de phrase : « Facture véto Diva 120 ».
 * Les heures, les places, les dates (« le 12 », « dans 3 jours ») ne
 * comptent pas.
 */
export function montantNu(text: string): number | undefined {
  const t = norm(text)
    .replace(/\b\d{1,2}\s*(?:heures?|h)(?:\s*\d{2})?\b/g, " ")
    .replace(/\b\d+\s*places?\b/g, " ")
    .replace(/\b(?:le|du|au|dans)\s+\d+(?:\s*jours?)?\b/g, " ")
    .trim();
  const m = t.match(/(?:^|\s)(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return undefined;
  const v = Number(m[1].replace(/[   ]/g, "") + (m[2] ? "." + m[2] : ""));
  return v > 0 && v < 1_000_000 ? v : undefined;
}

/** « tous les chevaux », « toute l'écurie », « tout le monde » : chaque cheval. */
const TOUS = /\b(tous les chevaux|toute l ?ecurie|tout le monde)\b/;

/** Une heure : « 18 h », « 9h30 », « 7 h 30 », « 8 heures », « midi ». */
export function heureDite(text: string): string | undefined {
  const t = norm(text);
  if (/\bmidi\b/.test(t)) return "12:00";
  const m = t.match(/\b(\d{1,2})\s*(?:heures?|h)(?:\s*(\d{2}))?\b/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const mn = m[2] ? Number(m[2]) : 0;
  if (h > 23 || mn > 59) return undefined;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ce que c'est : la phrase sans les jours, heures, montants, places ni chevaux. */
export function nomDit(text: string, horses: { id: string; name: string }[] = []): string {
  let s = ` ${text} `;
  const cut = (re: RegExp) => (s = s.replace(re, " "));
  cut(/(?:\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:€|euros?\b|eur\b)/gi);
  cut(/\bpour\s+tous\s+les\s+chevaux\b|\btous\s+les\s+chevaux\b/gi);
  cut(/\b(?:la|par) (?:place|personne|cavalier)\b/gi);
  cut(/\b\d+\s*places?\b/gi);
  cut(/(?:à\s*)?\b\d{1,2}\s*(?:heures?|h)(?:\s*\d{2})?\b/gi);
  cut(/(?:à\s*)?\bmidi\b/gi);
  cut(/\b(?:aujourd['’ ]?hui|apr[eè]s[- ]demain|demain|ce soir|ce matin)\b/gi);
  cut(/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?: prochain)?\b/gi);
  cut(/\b(?:le|du) \d{1,2}\b/gi);
  cut(/\bdans \d+ jours?\b/gi);
  cut(/\brien à voir avec les chevaux\b|\brien a voir avec les chevaux\b|\bhors chevaux\b/gi);
  cut(/\bpour (?:toute )?l['’]\s*écurie\b|\bpour (?:toute )?l['’]\s*ecurie\b/gi);
  cut(/(?:^|\s)[çc]a (?:rentre|sort)\b/gi);
  for (const h of horses) {
    const n = escRe(h.name);
    cut(new RegExp(`\\b(?:pour|avec|de|sur)\\s+${n}(?![\\p{L}])`, "giu"));
    s = s.replace(new RegExp(`(^|[^\\p{L}])${n}(?![\\p{L}])`, "giu"), "$1 ");
  }
  s = s.replace(/[,;:.!?]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:(?:j['’]ai|il y a|on a|nouveau|nouvelle|un|une)\s+)+/i, "");
  s = s.replace(/(?:\s+(?:à|a|pour|de|du|le|la|et|avec))+$/i, "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function prestationDite(t: string, places: number | undefined, label: string, ctx: DireContext): Pick<Compris, "prestationId" | "format" | "coursName"> {
  const ps = ctx.prestations ?? [];
  const fmt = ps.find((p) => p.hasFormat);
  if (/\bcours (?:collectif|de groupe|en groupe)\b/.test(t)) return fmt ? { prestationId: fmt.id, format: "collectif" } : { coursName: "Cours collectif" };
  if (/\bcours (?:particulier|individuel|prive)\b/.test(t)) {
    const solo = ps.find((p) => !p.hasFormat && /particulier|individuel|prive/.test(norm(p.label)));
    if (solo) return { prestationId: solo.id };
    return fmt ? { prestationId: fmt.id, format: "particulier" } : { coursName: "Cours particulier" };
  }
  const w = words(t);
  for (const p of ps) {
    const sig = norm(p.label).split(/[^a-z0-9]+/).filter((x) => x.length >= 4 && !STOP.has(x));
    if (sig.some((x) => w.includes(` ${x} `))) return { prestationId: p.id, format: p.hasFormat ? (places === 1 ? "particulier" : "collectif") : undefined };
  }
  const reste = norm(label).trim();
  if (!reste || reste === "cours" || reste === "seance") {
    if (fmt) return { prestationId: fmt.id, format: places === 1 ? "particulier" : "collectif" };
    return ps[0] ? { prestationId: ps[0].id } : { coursName: "Cours" };
  }
  return { coursName: label };
}

/** La phrase dite devient un ajout. Jamais nul : au pire, une tâche au nom de la phrase. */
export function comprendre(text: string, ctx: DireContext): Compris {
  const t = norm(text);
  const date = parseDate(t, ctx.today);
  const start = heureDite(text);
  const amount = montantDit(text);
  // Un nombre sans « € » en fin de phrase ne vaut montant que pour un soin ou de l'argent.
  const nu = amount ?? montantNu(text);
  const pm = t.match(/\b(\d+)\s*places?\b/);
  const places = pm ? Number(pm[1]) : undefined;
  // « Vermifuge pour tous les chevaux » : chaque cheval de l'écurie.
  const horseIds = TOUS.test(words(text)) ? ctx.horses.map((h) => h.id) : chevauxDits(text, ctx.horses);
  const label = nomDit(text, ctx.horses).replace(/\s*\d+(?:[.,]\d{1,2})?$/, "").trim();
  const base = { date: date ?? ctx.today, dateSaid: !!date, start, horseIds };

  const soin = SOINS.find(([re]) => re.test(t));
  if (soin) return { ...base, type: "soin", care: soin[1], amount: nu };

  const ps = ctx.prestations ?? [];
  const prestaWord = ps.some((p) => norm(p.label).split(/[^a-z0-9]+/).some((x) => x.length >= 4 && !STOP.has(x) && words(t).includes(` ${x} `)));
  if (SEANCE.test(t) || prestaWord) {
    return { ...base, type: "seance", places, amount, ...prestationDite(t, places, label, ctx) };
  }

  const argentMot = ENTREE.test(t) || SORTIE.test(t) || HORS.test(t);
  if ((amount && !start) || (argentMot && !start)) {
    const sens = ENTREE.test(t) ? "in" : "out";
    const pour: Pour = horseIds.length ? "cheval" : HORS.test(t) ? "hors" : ECURIE.test(t) ? "ecurie" : sens === "in" ? "hors" : "ecurie";
    return { ...base, type: "argent", amount: nu, sens, pour, label: label || undefined };
  }

  return { ...base, type: "rdv", amount, label: label || text.trim() || undefined };
}
