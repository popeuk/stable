import type { StableData } from "@/lib/domain/types";

/**
 * Lire des données sans se laisser casser par elles. Un état enregistré
 * abîmé (une liste qui n'en est pas une, une ligne sans identifiant, un
 * montant qui n'est pas un nombre) faisait tomber tous les écrans. Ici, on
 * garde ce qui est lisible, on écarte le reste et on dit ce qui manque.
 *
 * Deux usages :
 *  - au chargement (`nettoyer`) : l'app s'ouvre avec ce qui reste, et un
 *    écran de secours propose d'exporter ce qui reste ou de repartir ;
 *  - à la reprise d'une sauvegarde (`lireSauvegarde`) : un fichier abîmé ou
 *    d'un autre format est refusé, rien n'est remplacé.
 * Domaine pur, testé.
 */

/** Les listes sans lesquelles aucun écran ne s'affiche. */
const LISTES_ESSENTIELLES = ["horses", "revenues", "directExpenses", "sharedExpenses", "revenueCategories", "expenseCategories"] as const;
/** Les autres listes, facultatives. */
const LISTES = ["recurringExpenses", "recurringRevenues", "careEvents", "rhythms", "services", "team", "pros", "people", "prestations", "seances", "taskLists", "tasks", "actions", "payments", "invoices"] as const;
/** Les fiches (objets simples), facultatives. */
const FICHES = ["tariffs", "billing", "holding", "invoiceSeq"] as const;

const NOMS: Record<string, string> = {
  horses: "les chevaux",
  revenues: "ce qui rentre",
  directExpenses: "les dépenses des chevaux",
  sharedExpenses: "les frais de l’écurie",
  revenueCategories: "les catégories de recettes",
  expenseCategories: "les catégories de dépenses",
  recurringExpenses: "les frais de chaque mois",
  recurringRevenues: "les recettes de chaque mois",
  careEvents: "le carnet des chevaux",
  rhythms: "les rythmes du planning",
  services: "les services",
  team: "l’équipe",
  pros: "les pros",
  people: "les clients",
  prestations: "les cours et services",
  seances: "le planning",
  taskLists: "les colonnes des tâches",
  tasks: "les tâches",
  actions: "les idées suivies",
  payments: "les paiements",
  invoices: "les factures",
  tariffs: "les tarifs",
  billing: "les infos de facturation",
  holding: "le lieu de détention",
  invoiceSeq: "les numéros de facture",
};

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const estJour = (x: unknown) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x);
const estNombre = (x: unknown) => typeof x === "number" && Number.isFinite(x);

/** Une ligne est-elle lisible ? Le minimum pour qu'un écran ne tombe pas. */
function ligneLisible(liste: string, x: unknown): boolean {
  if (!estObjet(x)) return false;
  if (liste !== "invoiceSeq" && typeof x.id !== "string") return false;
  switch (liste) {
    case "horses":
      return typeof x.name === "string" && (x.entryDate === undefined || x.entryDate === null || typeof x.entryDate === "string") && (x.stays === undefined || (Array.isArray(x.stays) && x.stays.every((s) => estObjet(s) && typeof s.entry === "string")));
    case "revenues":
    case "directExpenses":
      return estNombre(x.amount) && estJour(x.date);
    case "sharedExpenses":
      return estNombre(x.totalAmount) && estNombre(x.periodYear) && estNombre(x.periodMonth) && Array.isArray(x.allocations);
    case "revenueCategories":
    case "expenseCategories":
      return typeof x.name === "string";
    case "recurringExpenses":
    case "recurringRevenues":
      return estNombre(x.amount) && estJour(x.startDate);
    case "careEvents":
      return estJour(x.date) && typeof x.kind === "string";
    case "people":
    case "pros":
      return typeof x.name === "string";
    case "prestations":
      return typeof x.label === "string";
    case "seances":
      return estJour(x.date) && Array.isArray(x.participants) && Array.isArray(x.horseIds);
    case "tasks":
      return typeof x.title === "string" && Array.isArray(x.checklist ?? []) && Array.isArray(x.comments ?? []) && Array.isArray(x.labels ?? []) && Array.isArray(x.forWho ?? []);
    case "payments":
      return typeof x.payer === "string" && estNombre(x.amount);
    case "invoices":
      return typeof x.number === "string" && Array.isArray(x.lines) && Array.isArray(x.revenueIds ?? []);
    default:
      return true;
  }
}

/** Une écurie sans rien : toutes les listes vides (quand rien ne se lit). */
export function vide(): Record<string, unknown> {
  return Object.fromEntries([...LISTES_ESSENTIELLES, ...LISTES].map((k) => [k, []]));
}

export interface Nettoyage {
  data: Partial<StableData> & Record<string, unknown>;
  /** Ce qui était abîmé, dit en mots (« les chevaux », « 2 lignes de ce qui rentre »). */
  problemes: string[];
}

/** Garde ce qui est lisible, écarte le reste, et dit ce qui a été écarté. */
export function nettoyer(raw: unknown): Nettoyage {
  if (!estObjet(raw)) return { data: {}, problemes: ["toutes les données"] };
  const data: Record<string, unknown> = { ...raw };
  const problemes: string[] = [];
  for (const k of [...LISTES_ESSENTIELLES, ...LISTES]) {
    const v = raw[k];
    if (v === undefined) {
      if ((LISTES_ESSENTIELLES as readonly string[]).includes(k)) data[k] = [];
      continue;
    }
    if (!Array.isArray(v)) {
      problemes.push(NOMS[k]);
      data[k] = [];
      continue;
    }
    const ok = v.filter((x) => ligneLisible(k, x));
    if (ok.length !== v.length) {
      const n = v.length - ok.length;
      problemes.push(`${n} ligne${n > 1 ? "s" : ""} dans ${NOMS[k]}`);
      data[k] = ok;
    }
  }
  for (const k of FICHES) {
    const v = raw[k];
    if (v !== undefined && v !== null && !estObjet(v)) {
      problemes.push(NOMS[k]);
      delete data[k];
    }
  }
  return { data: data as Nettoyage["data"], problemes };
}

export type Lecture =
  | { ok: true; data: Record<string, unknown>; settings?: Record<string, unknown>; versionDonnees: number; versionReglages: number | null }
  | { ok: false; raison: string };

const versionDe = (x: unknown): number | null => {
  const v = estObjet(x) ? x.version : undefined;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
};

/**
 * Une sauvegarde à reprendre : faite par « Exporter mes données », et
 * entière. Sinon elle est refusée avec la raison, et rien n'est remplacé.
 * Elle dit la version de ses données (format 3, lib/sauvegarde) ; un fichier
 * d'avant est pris en version 4. Un fichier fait par une version plus
 * récente de l'app (`max`) est refusé : cette app ne sait pas le lire.
 */
export function lireSauvegarde(texte: string, max: { donnees: number; reglages: number } = { donnees: Infinity, reglages: Infinity }): Lecture {
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return { ok: false, raison: "Ce fichier n’est pas une sauvegarde Be Stable. Choisis celui créé avec « Faire une sauvegarde »." };
  }
  if (!estObjet(json) || json.app !== "be-stable" || !estObjet(json["be-stable-data"]) || !estObjet((json["be-stable-data"] as Record<string, unknown>).state)) {
    return { ok: false, raison: "Ce fichier n’est pas une sauvegarde Be Stable. Choisis celui créé avec « Faire une sauvegarde »." };
  }
  const versionDonnees = versionDe(json["be-stable-data"]) ?? 4;
  const versionReglages = versionDe(json["be-stable-settings"]);
  if (versionDonnees > max.donnees || (versionReglages ?? 0) > max.reglages) {
    return { ok: false, raison: "Cette sauvegarde vient d’une version plus récente de Be Stable. Recharge l’app pour la mettre à jour, puis reprends-la. Rien n’a changé." };
  }
  const state = (json["be-stable-data"] as Record<string, unknown>).state as Record<string, unknown>;
  const n = nettoyer(state);
  if (n.problemes.length) {
    return { ok: false, raison: `Cette sauvegarde est abîmée (${n.problemes.join(", ")}). Rien n’a changé dans l’app.` };
  }
  const st = json["be-stable-settings"];
  const settings = estObjet(st) && estObjet(st.state) ? (st.state as Record<string, unknown>) : undefined;
  return { ok: true, data: n.data, settings, versionDonnees, versionReglages };
}
