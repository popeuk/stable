import { describe, it, expect } from "vitest";
import type { Category, Horse, Person, PensionContrat, Revenue, Seance, StableData } from "@/lib/domain/types";
import { avecLien, chevauxDe, liensDuCheval } from "@/lib/domain/liens";
import { avecPrixClient, figerPrixPropres, prixPropre } from "@/lib/domain/prix-client";
import { ensurePensionsContrats, montantDuMois, pensionCourt, pensionContratRevenueId } from "@/lib/domain/pensions-contrats";
import { ensurePensions } from "@/lib/domain/autopilot";
import { revenuesForSeance, seanceAmount } from "@/lib/domain/seances";
import { tvaDans, tvaDuMois } from "@/lib/domain/tva";
import { nettoyer } from "@/lib/domain/valider";

const CATS: Category[] = [
  { id: "cat-pension", name: "Pension" },
  { id: "cat-cours", name: "Cours" },
];
const horse = (p: Partial<Horse> = {}): Horse => ({ id: "h1", stableId: "s", name: "Tornade", entryDate: "2026-01-01", exitDate: null, isArchived: false, ...p });
const people: Person[] = [
  { id: "p-claire", name: "Claire", role: "proprietaire", active: true },
  { id: "p-margot", name: "Margot", role: "cavalier", active: true },
];
const base = (p: Partial<StableData> = {}): StableData => ({
  horses: [horse({ ownerName: "Claire" })],
  revenues: [],
  directExpenses: [],
  sharedExpenses: [],
  revenueCategories: CATS,
  expenseCategories: [],
  people,
  ...p,
});

describe("liens client et cheval", () => {
  it("déduit le propriétaire du nom quand aucun lien n'est noté", () => {
    expect(liensDuCheval(base(), "h1")).toEqual([{ id: "p-claire|h1", personId: "p-claire", horseId: "h1", role: "proprietaire" }]);
  });
  it("garde le propriétaire noté et ajoute une demi-pension, propriétaire d'abord", () => {
    const horseLinks = avecLien(undefined, "p-margot", "h1", "demi-pension");
    const l = liensDuCheval(base({ horseLinks }), "h1");
    expect(l.map((x) => [x.personId, x.role])).toEqual([["p-claire", "proprietaire"], ["p-margot", "demi-pension"]]);
    expect(chevauxDe(base({ horseLinks }), "p-margot").map((x) => x.role)).toEqual(["demi-pension"]);
  });
  it("un seul lien par personne et par cheval, retiré avec un rôle nul", () => {
    let links = avecLien(undefined, "p-margot", "h1", "cavalier");
    links = avecLien(links, "p-margot", "h1", "demi-pension");
    expect(links).toHaveLength(1);
    expect(avecLien(links, "p-margot", "h1", null)).toEqual([]);
  });
});

describe("prix propre à un client", () => {
  const prixClients = avecPrixClient(undefined, "p-margot", "equitation", 35);
  it("se pose, se lit et se retire", () => {
    expect(prixPropre({ prixClients }, "p-margot", "equitation")).toBe(35);
    expect(avecPrixClient(prixClients, "p-margot", "equitation", null)).toEqual([]);
  });
  it("se fige sur l'inscrit sans toucher les autres", () => {
    const ps = figerPrixPropres([{ personId: "p-margot" }, { personId: "p-claire" }], { prixClients }, "equitation");
    expect(ps).toEqual([{ personId: "p-margot", unitPrice: 35 }, { personId: "p-claire" }]);
  });
  it("une séance rapporte le prix de chacun, et la recette porte le taux de la prestation", () => {
    const s: Seance = {
      id: "se1", prestationId: "equitation", title: "Cours", participants: [{ personId: "p-margot", unitPrice: 35, horseId: "h1" }, { personId: "p-claire", horseId: "h1" }],
      horseIds: ["h1"], date: "2026-11-10", start: "10:00", end: "11:00", status: "done", unitPrice: 25, rev: 1,
    };
    expect(seanceAmount(s)).toBe(60);
    let n = 0;
    const revs = revenuesForSeance(s, { people, revenueCategories: CATS, prestations: [{ id: "equitation", label: "Cours", price: 25, active: true, vatRate: 5.5 }] }, () => `r${n++}`, "s");
    expect(revs.map((r) => [r.payer, r.amount, r.vatRate])).toEqual([["Margot", 35, 5.5], ["Claire", 25, 5.5]]);
  });
});

describe("pensions saisies", () => {
  const p: PensionContrat = { id: "pe1", horseId: "h1", personId: "p-margot", label: "Demi-pension", amount: 160, vatRate: 20, startDate: "2026-09-15" };
  it("court du premier au dernier mois, au prorata des jours", () => {
    expect(pensionCourt(p, "2026-08")).toBe(false);
    expect(pensionCourt(p, "2026-09")).toBe(true);
    expect(montantDuMois(p, "2026-09")).toEqual({ amount: 85.33, debut: "2026-09-15", note: "Pension du 15 au 30 septembre" });
    expect(montantDuMois(p, "2026-10")).toEqual({ amount: 160, debut: "2026-10-01" });
    expect(montantDuMois({ ...p, endDate: "2026-11-10" }, "2026-11")?.amount).toBe(53.33);
  });
  it("se poste chaque mois avec son payeur et son taux, sans doublon", () => {
    const d = base({ pensions: [p] });
    const r = ensurePensionsContrats(d, "2026-11-20", [], "2026-09");
    expect(r.map((x) => [x.date, x.amount, x.payer, x.vatRate])).toEqual([
      ["2026-09-15", 85.33, "Margot", 20],
      ["2026-10-01", 160, "Margot", 20],
      ["2026-11-01", 160, "Margot", 20],
    ]);
    expect(ensurePensionsContrats({ ...d, revenues: r }, "2026-11-20", [], "2026-09")).toEqual([]);
    expect(ensurePensionsContrats(d, "2026-11-20", [pensionContratRevenueId("pe1", "2026-10")], "2026-10").map((x) => x.date)).toEqual(["2026-11-01"]);
  });
  it("sans payeur, c'est le propriétaire du cheval qui paie", () => {
    const r = ensurePensionsContrats(base({ pensions: [{ ...p, personId: undefined, startDate: "2026-11-01" }] }), "2026-11-20");
    expect(r[0].payer).toBe("Claire");
  });
  it("le cheval qui a une pension saisie ne poste plus Horse.pension", () => {
    const d = base({ horses: [horse({ ownerName: "Claire", pension: 390 })], pensions: [p] });
    expect(ensurePensions(d, "2026-11-20")).toEqual([]);
    expect(ensurePensions({ ...d, pensions: [] }, "2026-11-20")).toHaveLength(1);
  });
  it("le mois de la bascule, une pension déjà postée sans contrat n'est pas doublée", () => {
    const ancienne: Revenue = { id: "rev-pension-h1-2026-11", stableId: "s", horseId: "h1", categoryId: "cat-pension", amount: 390, date: "2026-11-01", source: "recurring" };
    const d = base({ revenues: [ancienne], pensions: [{ ...p, startDate: "2026-11-01" }] });
    expect(ensurePensionsContrats(d, "2026-11-20")).toEqual([]);
  });
});

describe("TVA du mois", () => {
  it("calcule la TVA comprise", () => {
    expect(tvaDans(120, 20)).toBe(20);
    expect(tvaDans(105.5, 5.5)).toBe(5.5);
    expect(tvaDans(100, 0)).toBe(0);
  });
  it("sépare ce qui a un taux de ce qui n'en a pas, et dit ce qu'il faut reverser", () => {
    const d = base({
      revenues: [
        { id: "r1", stableId: "s", horseId: "h1", amount: 120, date: "2026-11-01", source: "recurring", vatRate: 20 },
        { id: "r2", stableId: "s", horseId: "h1", amount: 50, date: "2026-11-02", source: "manual" },
        { id: "r3", stableId: "s", horseId: "h1", amount: 999, date: "2026-10-02", source: "manual", vatRate: 20 },
      ],
      directExpenses: [{ id: "d1", stableId: "s", horseId: "h1", label: "Maréchal", amount: 60, date: "2026-11-05", source: "manual", vatRate: 20 }],
      recurringExpenses: [{ id: "re1", stableId: "s", label: "Foin", amount: 110, isShared: true, frequency: "monthly", startDate: "2026-01-01", source: "manual", vatRate: 10 }],
    });
    const t = tvaDuMois(d, { year: 2026, month: 11 });
    expect(t).toEqual({ caTTC: 170, tvaCollectee: 20, recettesSansTaux: 50, fraisTTC: 170, tvaDeductible: 20, fraisSansTaux: 0, aReverser: 0 });
  });
});

describe("lecture des nouvelles listes", () => {
  it("garde les lignes lisibles et écarte les autres", () => {
    const n = nettoyer({
      ...base(),
      horseLinks: [{ id: "a|h1", personId: "a", horseId: "h1", role: "cavalier" }, { id: "b|h1", personId: "b", horseId: "h1", role: "voisin" }],
      pensions: [{ id: "pe1", horseId: "h1", amount: 160, startDate: "2026-09-01" }, { id: "pe2", horseId: "h1", amount: "cent", startDate: "2026-09-01" }],
      prixClients: [{ id: "a|x", personId: "a", prestationId: "x", price: 35 }],
    });
    expect((n.data.horseLinks as unknown[]).length).toBe(1);
    expect((n.data.pensions as unknown[]).length).toBe(1);
    expect((n.data.prixClients as unknown[]).length).toBe(1);
    expect(n.problemes).toEqual(["1 ligne dans les liens entre clients et chevaux", "1 ligne dans les pensions"]);
  });
});
