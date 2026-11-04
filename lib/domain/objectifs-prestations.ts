import type { Period, StableData } from "./types";
import { chevauxDuMois } from "./presence";
import { estAuGerant } from "./ticket";
import { payingCount, seanceAmount } from "./seances";
import { dateInPeriod } from "@/lib/utils/period";

/**
 * Les objectifs par prestation (version interne du Clos, écran /paliers).
 *
 * Les prestations se lisent dans Mon argent, sans rien saisir de plus :
 * - pension:<formule> : les chevaux en pension ce mois-là, par formule
 *   (Pension, Pension travail, Retraite…), sans ceux du gérant ;
 * - seance:<prestation>:<format> : les places de cavalier des séances du mois
 *   (non annulées), par prestation et, pour un cours, particulier ou collectif ;
 * - recette:<catégorie> : les autres recettes notées (demi-pension, stage,
 *   visite…), comptées une par une.
 * Le gérant fixe, pour chaque palier, le nombre visé de chaque prestation.
 * Domaine pur.
 */
export type GroupePrestation = "pension" | "seance" | "recette";

export interface LignePrestation {
  cle: string;
  nom: string;
  groupe: GroupePrestation;
  /** Ce qu'on compte : « chevaux », « places », « fois ». */
  unite: string;
}

export interface RealisePrestation {
  nombre: number;
  montant: number;
}

/** Objectifs : pour chaque clé, un nombre visé par palier (dans l'ordre des paliers). */
export type ObjectifsPrestations = Record<string, number[]>;

const FORMULE_DEFAUT = "Pension";
const formuleDe = (t?: string) => (t ?? "").trim() || FORMULE_DEFAUT;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** La catégorie de recettes des pensions : la première dont le nom commence par « Pension ». */
export function categoriePension(data: Pick<StableData, "revenueCategories">): string | undefined {
  return data.revenueCategories.find((c) => /^pension\b/i.test(c.name.trim()))?.id;
}

/** Les prestations de l'écurie, dans l'ordre : pensions, séances, autres recettes. */
export function lignesPrestations(data: StableData): LignePrestation[] {
  const out: LignePrestation[] = [];
  const formules = [...new Set(data.horses.filter((h) => !h.isArchived && !estAuGerant(h) && (h.pension ?? 0) > 0).map((h) => formuleDe(h.pensionType)))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  for (const f of formules) out.push({ cle: `pension:${f}`, nom: f, groupe: "pension", unite: "chevaux" });
  for (const p of data.prestations ?? []) {
    if (!p.active) continue;
    if (p.hasFormat) {
      out.push({ cle: `seance:${p.id}:particulier`, nom: `${p.label}, particulier`, groupe: "seance", unite: "places" });
      out.push({ cle: `seance:${p.id}:collectif`, nom: `${p.label}, collectif`, groupe: "seance", unite: "places" });
    } else out.push({ cle: `seance:${p.id}:`, nom: p.label, groupe: "seance", unite: "places" });
  }
  const pension = categoriePension(data);
  for (const c of data.revenueCategories) {
    if (c.id === pension || /^(cours|refacturation)$/i.test(c.name.trim())) continue;
    out.push({ cle: `recette:${c.id}`, nom: c.name, groupe: "recette", unite: "fois" });
  }
  return out;
}

/** Ce que chaque prestation a fait ce mois-là : le nombre et l'argent. */
export function realisePrestations(data: StableData, p: Period): Record<string, RealisePrestation> {
  const out: Record<string, RealisePrestation> = {};
  const ajoute = (cle: string, nombre: number, montant: number) => {
    const x = (out[cle] ??= { nombre: 0, montant: 0 });
    x.nombre += nombre;
    x.montant = r2(x.montant + montant);
  };
  const pension = categoriePension(data);
  const revenus = data.revenues.filter((r) => dateInPeriod(r.date, p));

  // Les pensions : les chevaux du mois, par formule ; l'argent, leurs recettes de pension.
  const formuleDuCheval = new Map<string, string>();
  for (const h of chevauxDuMois(data, p)) {
    if (estAuGerant(h)) continue;
    const f = formuleDe(h.pensionType);
    formuleDuCheval.set(h.id, f);
    ajoute(`pension:${f}`, 1, 0);
  }
  for (const r of revenus) {
    if (r.categoryId && r.categoryId === pension && formuleDuCheval.has(r.horseId)) ajoute(`pension:${formuleDuCheval.get(r.horseId)}`, 0, r.amount);
  }

  // Les séances : les places de cavalier (ou les chevaux d'un travail), et ce qu'elles rapportent à la séance.
  const formatDe = new Map((data.prestations ?? []).map((x) => [x.id, !!x.hasFormat]));
  for (const s of data.seances ?? []) {
    if (s.status === "cancelled" || !dateInPeriod(s.date, p)) continue;
    const avecFormat = formatDe.get(s.prestationId) ?? false;
    const cle = `seance:${s.prestationId}:${avecFormat ? (s.format ?? "particulier") : ""}`;
    const places = s.participants.length ? s.participants.filter((x) => !(s.status === "done" && x.present === false)).length : payingCount(s);
    ajoute(cle, places, seanceAmount(s));
  }

  // Les autres recettes, une par une (sans les pensions, les séances, les forfaits ni les refacturations).
  for (const r of revenus) {
    if (!r.categoryId || r.categoryId === pension || r.seanceId || r.abonnementId || r.rebillOf) continue;
    ajoute(`recette:${r.categoryId}`, 1, r.amount);
  }
  return out;
}

/** L'objectif d'une prestation pour le palier i (0 s'il n'est pas posé). */
export const objectifDe = (o: ObjectifsPrestations, cle: string, i: number): number => (i >= 0 ? (o[cle]?.[i] ?? 0) : 0);

/** Les prestations à montrer : celles de l'écurie, plus celles qui ont un objectif sans exister encore. */
export function lignesAMontrer(lignes: LignePrestation[], o: ObjectifsPrestations): LignePrestation[] {
  const connues = new Set(lignes.map((l) => l.cle));
  const orphelines = Object.keys(o)
    .filter((k) => !connues.has(k) && (o[k] ?? []).some((n) => n > 0))
    .map((k): LignePrestation => {
      const [groupe, ...reste] = k.split(":");
      const g = (["pension", "seance", "recette"].includes(groupe) ? groupe : "recette") as GroupePrestation;
      return { cle: k, nom: reste.join(" ").trim() || k, groupe: g, unite: g === "pension" ? "chevaux" : g === "seance" ? "places" : "fois" };
    });
  return [...lignes, ...orphelines];
}
