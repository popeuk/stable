import type { Horse, ISODate } from "./types";

/**
 * Importer des chevaux depuis un tableau (version du Clos) : des lignes
 * copiées dans Excel ou Numbers (séparées par des tabulations), ou un fichier
 * CSV (point-virgule ou virgule). La première ligne donne les colonnes ; on
 * reconnaît leurs noms usuels, sans tenir compte des accents ni des majuscules.
 * Domaine pur : rien n'est écrit ici, l'écran ajoute les chevaux.
 */
export type ColonneCheval = "name" | "ownerName" | "pensionType" | "pension" | "entryDate" | "breed";

export interface LigneCheval {
  /** Le numéro de la ligne dans le tableau (2 = la première sous l'en-tête). */
  ligne: number;
  name: string;
  ownerName?: string;
  pensionType?: string;
  pension?: number;
  entryDate?: ISODate;
  breed?: string;
  /** Déjà dans l'écurie (même nom) : on ne l'ajoute pas une deuxième fois. */
  existe?: boolean;
}

export interface LectureTableau {
  lignes: LigneCheval[];
  /** Les colonnes reconnues, dans l'ordre du tableau. */
  colonnes: (ColonneCheval | null)[];
  erreurs: string[];
}

const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const NOMS: [ColonneCheval, RegExp][] = [
  ["ownerName", /^(proprietaire|proprio|client|cliente|owner|nom du client|nom du proprietaire|cavalier)( .*)?$/],
  ["pensionType", /^(formule|type|type de pension|offre)( .*)?$/],
  ["pension", /^(pension|prix|tarif|montant|loyer|prix paye|prix mensuel)( .*)?$/],
  ["entryDate", /^(arrivee|date d arrivee|date arrivee|entree|date d entree|depuis|debut)( .*)?$/],
  ["breed", /^(race)( .*)?$/],
  ["name", /^(nom|cheval|nom du cheval|chevaux|horse|name)( .*)?$/],
];

/** Le nom d'une colonne, reconnu (ou null). */
export function colonneDe(entete: string): ColonneCheval | null {
  const e = sansAccents(entete);
  if (!e) return null;
  return NOMS.find(([, re]) => re.test(e))?.[0] ?? null;
}

/** Les cellules d'une ligne, avec les guillemets d'un CSV. */
function cellules(ligne: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let entre = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entre) {
      if (c === '"' && ligne[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') entre = false;
      else cur += c;
    } else if (c === '"') entre = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Le séparateur du tableau : tabulation (copier-coller), sinon point-virgule (Excel français), sinon virgule. */
function separateur(premiere: string): string {
  if (premiere.includes("\t")) return "\t";
  if (premiere.includes(";")) return ";";
  return ",";
}

/** « 490 », « 490 € », « 1 234,50 », « 490.00 » ; null si ce n'est pas un montant. */
export function montantLu(s: string): number | null {
  const t = s.replace(/[\s  €]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** « 01/09/2024 », « 1/9/24 », « 2024-09-01 » ; null si ce n'est pas une date. */
export function dateLue(s: string): ISODate | null {
  const t = s.trim();
  let a: number, m: number, j: number;
  let x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (x) [a, m, j] = [Number(x[1]), Number(x[2]), Number(x[3])];
  else if ((x = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t))) [j, m, a] = [Number(x[1]), Number(x[2]), Number(x[3].length === 2 ? `20${x[3]}` : x[3])];
  else return null;
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

/** Lit le tableau collé ou le fichier CSV. `existants` : les chevaux déjà là, pour ne rien doubler. */
export function lireTableau(texte: string, existants: Pick<Horse, "name" | "isArchived">[] = []): LectureTableau {
  const brutes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!brutes.length) return { lignes: [], colonnes: [], erreurs: ["Le tableau est vide."] };
  const sep = separateur(brutes[0]);
  const colonnes = cellules(brutes[0], sep).map(colonneDe);
  const erreurs: string[] = [];
  if (!colonnes.includes("name")) {
    return { lignes: [], colonnes, erreurs: ["La première ligne doit donner le nom des colonnes, avec au moins une colonne « Nom » (ou « Cheval »)."] };
  }
  const deja = new Set(existants.filter((h) => !h.isArchived).map((h) => sansAccents(h.name)));
  const vus = new Set<string>();
  const lignes: LigneCheval[] = [];
  brutes.slice(1, 501).forEach((brute, i) => {
    const n = i + 2;
    const c = cellules(brute, sep);
    const val = (k: ColonneCheval) => {
      const idx = colonnes.indexOf(k);
      return idx >= 0 ? (c[idx] ?? "").trim() : "";
    };
    const name = val("name").slice(0, 80);
    if (!name) return;
    const l: LigneCheval = { ligne: n, name };
    const proprio = val("ownerName");
    if (proprio) l.ownerName = proprio.slice(0, 120);
    const formule = val("pensionType");
    if (formule) l.pensionType = /^(a moi|a nous|nous|moi|ecurie|au gerant)$/.test(sansAccents(formule)) ? "À moi" : formule.slice(0, 60);
    const prix = val("pension");
    if (prix) {
      const p = montantLu(prix);
      if (p === null) erreurs.push(`Ligne ${n} (${name}) : la pension « ${prix} » n’est pas un montant, elle est laissée vide.`);
      else if (p > 0) l.pension = p;
    }
    const arrivee = val("entryDate");
    if (arrivee) {
      const d = dateLue(arrivee);
      if (!d) erreurs.push(`Ligne ${n} (${name}) : la date « ${arrivee} » n’est pas lue, l’arrivée sera aujourd’hui.`);
      else l.entryDate = d;
    }
    const race = val("breed");
    if (race) l.breed = race.slice(0, 60);
    if (l.pensionType === "À moi") delete l.pension;
    const cle = sansAccents(name);
    if (deja.has(cle) || vus.has(cle)) l.existe = true;
    vus.add(cle);
    lignes.push(l);
  });
  if (brutes.length > 501) erreurs.push("Seules les 500 premières lignes sont lues.");
  return { lignes, colonnes, erreurs };
}
