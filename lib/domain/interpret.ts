import type { ISODate } from "@/lib/domain/types";
import { addDays, CARE_KINDS, type CareKind } from "@/lib/domain/care";

/**
 * L'interpréteur de commandes en français : « cours collectif demain 14 h
 * avec Belle et Pacha, 25 euros » devient une commande structurée. Version
 * locale, déterministe et testée : le repli hors-ligne de l'assistant.
 * L'LLM (OpenRouter) produit la même forme de commande.
 */
export interface Command {
  kind: CareKind;
  horseIds: string[];
  all: boolean;
  date: ISODate;
  cost?: number;
  revenue?: number;
  provider?: string;
  label?: string;
}

export interface InterpretContext {
  horses: { id: string; name: string }[];
  today: ISODate;
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const KIND_PATTERNS: [RegExp, CareKind][] = [
  [/cours collectif|cours de groupe/, "cours_collectif"],
  [/cours (individuel|particulier|prive)/, "cours_individuel"],
  [/concours|competition|cso|dressage/, "concours"],
  [/veterinaire|veto/, "veto"],
  [/marechal|ferrure|ferrer|parage/, "ferrure"],
  [/vermifuge/, "vermifuge"],
  [/vaccin/, "vaccin"],
  [/dentiste|dents/, "dentiste"],
  [/osteo/, "osteo"],
  [/entrainement|travail|seance/, "entrainement"],
  [/document|assurance|papiers/, "document"],
  [/soin/, "soin"],
];

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Le jour existe-t-il (pas de 31 novembre) ? */
const existe = (y: number, m: number, d: number) => d >= 1 && new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;
const ecart = (a: ISODate, b: ISODate) => Math.abs(Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z"));
const jourSemaine = (d: ISODate) => new Date(d + "T00:00:00Z").getUTCDay();

/**
 * Une date dite avec son mois : « 15 octobre », « le 1er novembre »,
 * « 3 mars 2027 ». Sans année : celle qui la met au plus près d'aujourd'hui
 * (en décembre, « 5 janvier » est l'an prochain).
 */
function dateAvecMois(t: string, today: ISODate): ISODate | null {
  const m = t.match(new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MOIS.join("|")})\\b(?:\\s+(\\d{4}))?`));
  if (!m) return null;
  const jour = Number(m[1]);
  const mois = MOIS.indexOf(m[2]) + 1;
  if (m[3]) return existe(Number(m[3]), mois, jour) ? iso(Number(m[3]), mois, jour) : null;
  const y = Number(today.slice(0, 4));
  const ok = [y - 1, y, y + 1].filter((a) => existe(a, mois, jour)).map((a) => iso(a, mois, jour));
  return ok.sort((a, b) => ecart(a, today) - ecart(b, today))[0] ?? null;
}

/**
 * « Jeudi 15 » : le jour nommé avec un numéro. Le mois proche où le 15 tombe
 * un jeudi ; à défaut, le 15 le plus proche. Le numéro gagne toujours sur le
 * nom du jour.
 */
function jourEtNumero(t: string, today: ISODate): ISODate | null {
  const m = t.match(new RegExp(`\\b(${WEEKDAYS.join("|")})\\s+(?:le\\s+)?(\\d{1,2})(?:er)?\\b(?!\\s*(?:h\\b|heures?|€|euros?|places?))`));
  if (!m) return null;
  const jour = Number(m[2]);
  const dow = WEEKDAYS.indexOf(m[1]);
  const [y, mo] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const proches = [-1, 0, 1]
    .map((k) => {
      const mm = ((mo - 1 + k + 12) % 12) + 1;
      const yy = y + Math.floor((mo - 1 + k) / 12);
      return existe(yy, mm, jour) ? iso(yy, mm, jour) : null;
    })
    .filter((x): x is ISODate => !!x)
    .sort((a, b) => ecart(a, today) - ecart(b, today));
  return proches.find((d) => jourSemaine(d) === dow) ?? proches[0] ?? null;
}

export function parseDate(t: string, today: ISODate): ISODate | null {
  // Une date écrite gagne sur le nom du jour : « jeudi 15 octobre » est le 15 octobre.
  const avecMois = dateAvecMois(t, today);
  if (avecMois) return avecMois;
  const numero = jourEtNumero(t, today);
  if (numero) return numero;
  if (/\bavant[- ]hier\b/.test(t)) return addDays(today, -2);
  if (/\bhier\b/.test(t)) return addDays(today, -1);
  if (/apres[- ]demain/.test(t)) return addDays(today, 2);
  if (/\bdemain\b/.test(t)) return addDays(today, 1);
  if (/aujourd|ce soir|ce matin/.test(t)) return today;
  const inDays = t.match(/dans (\d+) jours?/);
  if (inDays) return addDays(today, Number(inDays[1]));
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) {
      const todayDow = new Date(today + "T00:00:00Z").getUTCDay();
      let delta = (i - todayDow + 7) % 7;
      if (delta === 0) delta = 7; // « mardi » un mardi = mardi prochain
      return addDays(today, delta);
    }
  }
  const onDay = t.match(/\ble (\d{1,2})\b/);
  if (onDay) {
    const day = Number(onDay[1]);
    if (day >= 1 && day <= 31) {
      const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
      const candidate = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (candidate >= today) return candidate;
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

/** Résout les chevaux cités (mot entier ou préfixe, sans accents ni casse). */
export function matchHorses(
  text: string,
  horses: { id: string; name: string }[],
): string[] {
  const t = norm(text);
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const found: string[] = [];
  for (const h of horses) {
    const n = norm(h.name);
    const hit = words.some(
      (w) => w === n || (w.length >= 3 && (n.startsWith(w) || w.startsWith(n))),
    );
    if (hit) found.push(h.id);
  }
  return found;
}

export function interpretLocal(
  text: string,
  ctx: InterpretContext,
): { command: Command | null; missing: string[] } {
  const t = norm(text);

  let kind: CareKind | null = null;
  for (const [re, k] of KIND_PATTERNS) {
    if (re.test(t)) {
      kind = k;
      break;
    }
  }

  const all = /tous les chevaux|toute l'?ecurie|tout le monde|\btous\b/.test(t);
  const horseIds = all ? ctx.horses.map((h) => h.id) : matchHorses(text, ctx.horses);

  // « un cours » sans précision : collectif à plusieurs, individuel seul.
  if (!kind && /\bcours\b/.test(t)) {
    kind = all || horseIds.length > 1 ? "cours_collectif" : "cours_individuel";
  }

  const date = parseDate(t, ctx.today) ?? ctx.today;

  let cost: number | undefined;
  let revenue: number | undefined;
  const amount = t.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/);
  if (amount) {
    const value = Number(amount[1].replace(",", "."));
    const isCours = kind === "cours_collectif" || kind === "cours_individuel" || kind === "concours";
    if (/recette|gagne|rapporte/.test(t)) revenue = value;
    else if (/cout|coute|paye|facture/.test(t)) cost = value;
    else if (isCours) revenue = value;
    else cost = value;
  }

  const time = text.match(/(\d{1,2})\s*h(?:\s*(\d{2}))?/i);
  const label = time ? `${time[1]} h${time[2] ? ` ${time[2]}` : ""}` : undefined;

  const missing: string[] = [];
  if (!kind) missing.push("l'acte (cours, véto, ferrure…)");
  if (horseIds.length === 0) missing.push("le ou les chevaux");
  if (!kind || horseIds.length === 0) return { command: null, missing };

  return {
    command: { kind, horseIds, all, date, cost, revenue, label },
    missing: [],
  };
}

/** Garde-fou : valide une commande venue de l'extérieur (LLM). */
export function sanitizeCommand(
  raw: unknown,
  ctx: InterpretContext,
): Command | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kind = CARE_KINDS.includes(r.kind as CareKind) ? (r.kind as CareKind) : null;
  if (!kind) return null;
  const all = r.all === true;
  const names = Array.isArray(r.horses) ? r.horses.filter((n): n is string => typeof n === "string") : [];
  const horseIds = all
    ? ctx.horses.map((h) => h.id)
    : names.flatMap((n) => matchHorses(n, ctx.horses));
  if (horseIds.length === 0) return null;
  const date =
    typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : ctx.today;
  const num = (v: unknown) =>
    typeof v === "number" && isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : undefined;
  return {
    kind,
    horseIds: [...new Set(horseIds)],
    all,
    date,
    cost: num(r.cost),
    revenue: num(r.revenue),
    provider: typeof r.provider === "string" && r.provider.trim() ? r.provider.trim().slice(0, 60) : undefined,
    label: typeof r.label === "string" && r.label.trim() ? r.label.trim().slice(0, 80) : undefined,
  };
}
