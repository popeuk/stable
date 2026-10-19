"use client";

import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { currentPeriod } from "@/lib/utils/period";
import { estimationDuPoste, recurringDue } from "@/lib/domain/recurring";
import { relire, type Connu } from "@/lib/domain/montant-saisi";
import type { MontantSaisi } from "@/lib/domain/types";
import { nomAffiche } from "@/lib/domain/noms-categories";
import { A_MOI, OBSTACLE_META, estAMoi, useParcours } from "@/components/bs/parcours-base";

export { A_MOI, OBSTACLE_META, estAMoi, useParcours };

/* ---------- Installer vite : un nombre de chevaux, un total de frais ---------- */

/** La charge commune « en un total » : une seule catégorie, un seul libellé. */
export const FRAIS_CAT = "Frais communs";
export const FRAIS_LABEL = "Frais communs en un total";
/** Les noms d'avant octobre 2026 (« Frais fixes ») : toujours retrouvés, lus sous le nouveau nom. */
const ANCIENS_CAT = ["Frais fixes"];
const ANCIENS_LABEL = ["Frais fixes (foin, loyer, salaires)"];
export const estFraisCat = (name: string) => name === FRAIS_CAT || ANCIENS_CAT.includes(name);
/** Un seul mot pour les frais de l'écurie : l'ancien libellé du total se lit « Frais communs en un total ». */
/** Le libellé affiché : les anciens noms enregistrés et celui du parcours se lisent « frais de l'écurie ». */
export const libelleFrais = (label: string) => (label === FRAIS_LABEL || ANCIENS_LABEL.includes(label) || ANCIENS_CAT.includes(label) ? "Frais de l’écurie, en un total" : nomAffiche(label));

type Data = ReturnType<typeof useDataStore.getState>;

type Per = { year: number; month: number };
const NUMERO = /^Cheval (\d+)$/;

/**
 * Le nombre de chevaux, plutôt que leurs noms : « Cheval 1 » … « Cheval N »
 * à la pension moyenne donnée, présents depuis le début du mois (la pension
 * du mois est comptée), à la suite des chevaux déjà numérotés. La pension
 * devient aussi le tarif de pension. Rend le nombre de chevaux ajoutés.
 */
export function ajouterChevaux(nombre: number, pension: number, today = localToday()): number {
  const d = useDataStore.getState();
  const month = today.slice(0, 7);
  const n = Math.max(1, Math.min(60, Math.round(nombre)));
  const p = Math.max(0, Math.round(pension * 100) / 100);
  const deja = d.horses.reduce((m, h) => Math.max(m, Number(NUMERO.exec(h.name.trim())?.[1] ?? 0)), 0);
  for (let i = 1; i <= n; i++) d.addHorse({ name: `Cheval ${deja + i}`, pension: p || undefined, entryDate: `${month}-01` });
  if (p) d.setTariff("pension", p);
  useDataStore.getState().runAutopilot(today);
  return n;
}

/** Tes chevaux à toi, d'un coup : « Mon cheval 1 » … « Mon cheval N », sans pension. Rend le nombre ajouté. */
export function ajouterMiens(nombre: number, today = localToday()): number {
  const d = useDataStore.getState();
  const n = Math.max(0, Math.min(30, Math.round(nombre)));
  const deja = d.horses.reduce((m, h) => Math.max(m, Number(/^Mon cheval (\d+)$/.exec(h.name.trim())?.[1] ?? 0)), 0);
  for (let i = 1; i <= n; i++) d.addHorse({ name: `Mon cheval ${deja + i}`, pensionType: A_MOI, entryDate: `${today.slice(0, 7)}-01` });
  return n;
}

/** La pension commune : tous les chevaux présents paient le tarif de pension. Sinon null. */
export function pensionCommune(data: Pick<Data, "horses" | "tariffs">): number | null {
  const act = data.horses.filter((h) => !h.isArchived && !estAMoi(h));
  const p = data.tariffs?.pension;
  if (!act.length || !p) return null;
  return act.every((h) => h.pension === p) ? p : null;
}

/** Change la pension commune : le tarif et chaque cheval présent, pension du mois comprise. */
export function changerPensionCommune(pension: number, today = localToday()) {
  const d = useDataStore.getState();
  const p = Math.max(0, Math.round(pension * 100) / 100);
  d.setTariff("pension", p || undefined);
  for (const h of d.horses) if (!h.isArchived && !estAMoi(h)) d.setPension(h.id, p, today.slice(0, 7));
}

/**
 * L'estimation d'un poste de frais communs pour le mois, telle que saisie
 * dans « Mes frais » : les charges qui reviennent, seulement. Les vraies
 * dépenses notées avec le + (une livraison de foin) n'y sont pas : le champ
 * « par mois, à peu près » montre toujours le chiffre tapé.
 */
export function chargeDuMois(data: Pick<Data, "recurringExpenses">, catId: string, period: Per): number {
  return estimationDuPoste(data, catId, period);
}

/**
 * Comment remontrer un poste dans son champ : par mois, sur l'année ou en
 * plusieurs fois, comme le gérant l'a tapé. Un poste fait d'une seule charge
 * qui revient garde sa façon d'être tapé ; sinon, c'est son total du mois.
 */
export function posteTape(data: Pick<Data, "sharedExpenses" | "recurringExpenses">, catId: string, period: Per): { mode: Connu; montant: number; fois: number } {
  const total = chargeDuMois(data, catId, period);
  const recs = (data.recurringExpenses ?? []).filter((r) => r.isShared && r.categoryId === catId && recurringDue(r, period));
  const seule = recs.length === 1 && recs[0].frequency === "monthly" && recs[0].amount === total ? recs[0] : undefined;
  return relire(total, seule?.saisi);
}

/** Les frais communs du mois : le total « en un chiffre » et la somme des autres postes. */
export function fraisDuMois(data: Pick<Data, "expenseCategories" | "sharedExpenses" | "recurringExpenses">, period: Per = currentPeriod()) {
  const cats = data.expenseCategories.filter((c) => !c.isDirect);
  const fixe = cats.find((c) => estFraisCat(c.name));
  const total = fixe ? chargeDuMois(data, fixe.id, period) : 0;
  const postes = cats.filter((c) => c !== fixe).reduce((t, c) => t + chargeDuMois(data, c.id, period), 0);
  return { total, postes, cats: cats.filter((c) => c !== fixe) };
}

/** « Un total » : foin, loyer, salaires en une seule charge commune mensuelle. 0 la retire. */
export function fraisEnUnTotal(montant: number, period: Per = currentPeriod(), saisi?: MontantSaisi) {
  const d = useDataStore.getState();
  let cat = d.expenseCategories.find((c) => estFraisCat(c.name) && !c.isDirect);
  if (!cat && montant <= 0) return;
  if (!cat) {
    d.addExpenseCategory(FRAIS_CAT, false);
    cat = useDataStore.getState().expenseCategories.find((c) => c.name === FRAIS_CAT && !c.isDirect);
  }
  if (cat) useDataStore.getState().setMonthlyCharge(cat.id, FRAIS_LABEL, montant, period, saisi);
}

/** Passer poste par poste après un total : le total ne compte plus. */
export const retirerTotal = (period: Per = currentPeriod()) => fraisEnUnTotal(0, period);

/** Revenir à un total après des postes : les postes du mois ne comptent plus. */
export function retirerPostes(period: Per = currentPeriod()) {
  const d = useDataStore.getState();
  for (const c of fraisDuMois(d, period).cats) if (chargeDuMois(useDataStore.getState(), c.id, period) > 0) useDataStore.getState().setMonthlyCharge(c.id, c.name, 0, period);
}
