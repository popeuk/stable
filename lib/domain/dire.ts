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
  /** Les cavaliers nommés (« avec Emma »), tels qu'ils sont notés dans les clients. */
  cavaliers?: string[];
  /** « à refacturer », « au propriétaire » : un soin que le propriétaire paie. */
  refacturer?: boolean;
}

export interface DireContext {
  today: ISODate;
  horses: { id: string; name: string }[];
  prestations?: { id: string; label: string; hasFormat?: boolean }[];
  /** Les clients, pour reconnaître un cavalier nommé (les cavaliers d'abord, puis les propriétaires). */
  people?: { name: string; role?: string }[];
}

/** « à refacturer », « refacturé », « au propriétaire », « faire payer au proprio ». */
const REFACTURER = /\b(a refacturer|refactur\w*|au proprio(?:taire)?|faire payer)\b/;

/** Les mots qui ferment une liste de noms : « avec Jade et Lou à 18 h sur Pacha ». */
const FIN_NOMS = new Set(["a", "sur", "pour", "le", "la", "les", "de", "du", "des", "au", "dans", "demain", "aujourd", "hui", "hier", "avant", "apres", "ce", "cette", "soir", "matin", "midi", "places", "place", "euros", "euro", "eur", "cours", "seance", "balade", "chaque", "tous", "toutes", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche", "prochain", "refacturer", "refacture"]);

/** « emma roux » devient « Emma Roux » : un nouveau cavalier, écrit comme dans la phrase (« Léo » garde son accent). */
function commeUnNom(mots: string[], brut: string): string {
  const bruts = brut.split(/[^\p{L}\p{N}’'-]+/u).filter(Boolean);
  return mots
    .map((m) => {
      const vu = bruts.find((b) => norm(b) === m) ?? m;
      return vu.charAt(0).toUpperCase() + vu.slice(1);
    })
    .join(" ");
}

/**
 * Les noms dits après « avec » : « avec Jade Martin, Emma Roux et Léo
 * Petit ». Chaque nom, tel qu'il est dit (normalisé, en mots), sans les
 * chevaux.
 */
function nomsApresAvec(text: string, horses: { name: string }[]): string[][] {
  const chevaux = new Set(horses.map((h) => words(h.name).trim()));
  const out: string[][] = [];
  const t = norm(text);
  for (const m of t.matchAll(/\bavec\s+([^]*)/g)) {
    const seg = m[1].split(/\bavec\b/)[0];
    for (const bout of seg.split(/,|;|\bet\b/)) {
      const toks = bout.split(/[^a-z0-9]+/).filter(Boolean);
      const nom: string[] = [];
      for (const x of toks) {
        if (/\d/.test(x) || FIN_NOMS.has(x)) break;
        nom.push(x);
      }
      if (!nom.length || nom.length > 3 || nom.some((x) => x.length < 2)) {
        if (nom.length) continue;
        else break;
      }
      if (chevaux.has(nom.join(" "))) continue;
      out.push(nom);
    }
  }
  return out;
}

/**
 * Les cavaliers nommés. Un nom entier dit (« Emma Roux ») ne retrouve que la
 * personne de ce nom entier ; s'il n'est à personne, c'est un nouveau
 * cavalier, écrit tel qu'il est dit (jamais Emma Garnier à la place d'Emma
 * Roux). Un prénom seul (3 lettres au moins) retrouve un cavalier qui le
 * porte, puis un client, s'il est le seul ; sinon un nouveau cavalier. Pas un
 * nom de cheval.
 */
export function cavaliersDits(text: string, people: { name: string; role?: string }[], horses: { name: string }[] = []): string[] {
  const w = words(text);
  const chevaux = new Set(horses.map((h) => words(h.name).trim()));
  const gens = people.map((p) => ({ name: p.name, role: p.role, full: words(p.name).trim() })).filter((p) => p.full && !chevaux.has(p.full));
  const out: string[] = [];
  const dits = nomsApresAvec(text, horses);
  const prenomsVus = new Set<string>();
  for (const nom of dits) {
    nom.forEach((x) => prenomsVus.add(x));
    const dit = nom.join(" ");
    const entier = gens.find((p) => p.full === dit);
    if (entier) {
      out.push(entier.name);
      continue;
    }
    if (nom.length === 1) {
      if (dit.length < 3) continue;
      const porte = gens.filter((p) => p.full.split(" ")[0] === dit);
      const cav = porte.filter((p) => p.role === "cavalier");
      const choisi = cav.length === 1 ? cav[0] : !cav.length && porte.length === 1 ? porte[0] : undefined;
      out.push(choisi ? choisi.name : porte.length ? "" : commeUnNom(nom, text));
      continue;
    }
    // Un prénom et un nom que personne ne porte : un nouveau cavalier.
    out.push(commeUnNom(nom, text));
  }
  // Ailleurs dans la phrase : un nom entier connu, ou le prénom d'un seul cavalier (ou client).
  for (const p of gens) {
    if (w.includes(` ${p.full} `)) out.push(p.name);
  }
  const reste = w.trim().split(" ").filter((x) => x.length >= 3 && !chevaux.has(x) && !prenomsVus.has(x));
  for (const x of new Set(reste)) {
    const porte = gens.filter((p) => p.full.split(" ")[0] === x);
    if (!porte.length) continue;
    const cav = porte.filter((p) => p.role === "cavalier");
    const choisi = cav.length === 1 ? cav[0] : !cav.length && porte.length === 1 ? porte[0] : undefined;
    if (choisi && !out.includes(choisi.name)) out.push(choisi.name);
  }
  return [...new Set(out.filter(Boolean))];
}

/**
 * Les cavaliers d'une séance dictée, dans la confirmation : « Avec Jade
 * Martin. Nouveaux cavaliers : Emma Roux, Léo Petit. » Un nouveau nom se
 * voit avant d'être inscrit.
 */
export function cavaliersEnMots(cav: string[], connus: string[]): string {
  const k = new Set(connus.map((n) => words(n).trim()));
  const deja = cav.filter((n) => k.has(words(n).trim()));
  const neufs = cav.filter((n) => !k.has(words(n).trim()));
  const out: string[] = [];
  if (deja.length) out.push(`Avec ${deja.join(", ")}.`);
  if (neufs.length) out.push(neufs.length > 1 ? `Nouveaux cavaliers : ${neufs.join(", ")}.` : `Nouveau cavalier : ${neufs[0]}.`);
  return out.join(" ");
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
    .replace(DATE_MOIS, " ")
    .replace(/\b\d{1,2}\s*(?:heures?|h)(?:\s*\d{2})?\b/g, " ")
    .replace(/\b\d+\s*places?\b/g, " ")
    .replace(/\b(?:le|du|au|dans)\s+\d+(?:\s*jours?)?\b/g, " ")
    .trim();
  const m = t.match(/(?:^|\s)(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return undefined;
  const v = Number(m[1].replace(/[   ]/g, "") + (m[2] ? "." + m[2] : ""));
  return v > 0 && v < 1_000_000 ? v : undefined;
}

/** « le 15 octobre », « 1er novembre 2026 » : une date dite avec son mois (avec ou sans accents). */
const DATE_MOIS = /\b(?:le\s+)?\d{1,2}(?:er)?\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+\d{4})?(?![\p{L}])/giu;

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
  cut(/\b(?:aujourd['’ ]?hui|apr[eè]s[- ]demain|demain|avant[- ]hier|hier|ce soir|ce matin)\b/gi);
  cut(DATE_MOIS);
  cut(/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?: prochain)?(?:\s+(?:le\s+)?\d{1,2}(?:er)?(?!\d|\s*(?:h\b|heures?|€|euros?|places?)))?\b/gi);
  cut(/\b(?:le|du) \d{1,2}\b/gi);
  cut(/\bdans \d+ jours?\b/gi);
  cut(/\brien à voir avec les chevaux\b|\brien a voir avec les chevaux\b|\bhors chevaux\b/gi);
  cut(/\bpour (?:toute )?l['’]\s*écurie\b|\bpour (?:toute )?l['’]\s*ecurie\b/gi);
  cut(/(?:^|\s)[çc]a (?:rentre|sort)\b/gi);
  cut(/(?:^|\s)(?:à|a) refacturer(?![\p{L}])|\brefactur(?:é|e)e?s?(?![\p{L}])/giu);
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
  if (soin) return { ...base, type: "soin", care: soin[1], amount: nu, ...(REFACTURER.test(t) ? { refacturer: true } : {}) };
  const cavaliers = cavaliersDits(text, ctx.people ?? [], ctx.horses);
  // Le nom du cours, sans « avec Jade Martin et Emma Roux » (ni le « et » qui les liait).
  let sansCav = label;
  for (const n of cavaliers) for (const part of [n, n.split(/\s+/)[0]]) sansCav = sansCav.replace(new RegExp(`\\s*(?:(?:avec|pour|de|et|,)\\s*)*${escRe(part)}(?![\\p{L}])`, "giu"), "").trim();

  const ps = ctx.prestations ?? [];
  const prestaWord = ps.some((p) => norm(p.label).split(/[^a-z0-9]+/).some((x) => x.length >= 4 && !STOP.has(x) && words(t).includes(` ${x} `)));
  if (SEANCE.test(t) || prestaWord) {
    return { ...base, type: "seance", places, amount, ...prestationDite(t, places, sansCav, ctx), ...(cavaliers.length ? { cavaliers } : {}) };
  }

  const argentMot = ENTREE.test(t) || SORTIE.test(t) || HORS.test(t);
  if ((amount && !start) || (argentMot && !start)) {
    const sens = ENTREE.test(t) ? "in" : "out";
    const pour: Pour = horseIds.length ? "cheval" : HORS.test(t) ? "hors" : ECURIE.test(t) ? "ecurie" : sens === "in" ? "hors" : "ecurie";
    return { ...base, type: "argent", amount: nu, sens, pour, label: label || undefined };
  }

  return { ...base, type: "rdv", amount, label: label || text.trim() || undefined };
}
