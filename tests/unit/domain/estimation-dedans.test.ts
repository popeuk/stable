import { describe, expect, it } from "vitest";
import { horsePnl, stablePnl } from "@/lib/domain/calculations";
import { monthBreakdown } from "@/lib/domain/ticket";
import { estimationDuPoste, montantsDuMois, partDuMois } from "@/lib/domain/recurring";
import { questionDedans } from "@/lib/domain/estimation";
import { ligneRemplie } from "@/lib/domain/corriger";
import type { SharedExpense, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };

/** Deux chevaux, une estimation de foin à 900 € par mois (Mes frais), une livraison de foin de 120 €. */
function data(livraison?: Partial<SharedExpense>): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Belle", entryDate: "2026-01-01", isArchived: false },
      { id: "h2", stableId: "s", name: "Sirius", entryDate: "2026-01-01", isArchived: false },
    ],
    revenues: [],
    directExpenses: [],
    sharedExpenses: livraison
      ? [{ id: "se1", stableId: "s", categoryId: "foin", label: "Foin", totalAmount: 120, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [], ...livraison }]
      : [],
    revenueCategories: [],
    expenseCategories: [{ id: "foin", name: "Foin", isDirect: false }],
    recurringExpenses: [
      { id: "rec-foin", stableId: "s", label: "Foin", amount: 900, categoryId: "foin", isShared: true, distributionMode: "equal", frequency: "monthly", startDate: "2026-01-01", endDate: null, source: "manual" },
    ],
  };
}

describe("une vraie dépense d'un poste déjà estimé", () => {
  it("« Oui, c'est dedans » : le mois compte 900 € en tout, 120 réels et 780 estimés", () => {
    const d = data({ dansEstimation: true });
    expect(stablePnl(d, oct).sharedCosts).toBe(900);
    expect(montantsDuMois(d, oct).get("rec-foin")).toBe(780);
    const m = monthBreakdown(d, oct);
    expect(m.shared.find((x) => x.label === "Foin")?.amount).toBe(900);
    expect(m.sharedTotal).toBe(900);
    // Le détail des frais : chaque cheval porte la moitié des 900 €.
    expect(horsePnl(d, "h1", oct).sharedCosts).toBe(450);
  });

  it("« Non, c'est en plus » : elle s'ajoute à l'estimation", () => {
    const d = data({});
    expect(stablePnl(d, oct).sharedCosts).toBe(1020);
    expect(monthBreakdown(d, oct).shared.find((x) => x.label === "Foin")?.amount).toBe(1020);
  });

  it("plus de vraies dépenses que l'estimation : l'estimation tombe à zéro, le réel compte en entier", () => {
    const d = data({ dansEstimation: true, totalAmount: 1000 });
    expect(stablePnl(d, oct).sharedCosts).toBe(1000);
    expect(montantsDuMois(d, oct).get("rec-foin")).toBe(0);
  });

  it("le mois d'après, l'estimation compte de nouveau en entier", () => {
    const d = data({ dansEstimation: true });
    expect(stablePnl(d, { year: 2026, month: 11 }).sharedCosts).toBe(900);
  });

  it("Mes frais montre l'estimation saisie, jamais la somme avec le réel", () => {
    expect(estimationDuPoste(data({ dansEstimation: true }), "foin", oct)).toBe(900);
    expect(estimationDuPoste(data({}), "foin", oct)).toBe(900);
  });

  it("la question dit le poste et son estimation", () => {
    expect(questionDedans("Foin", "900 €")).toBe("Ce foin fait partie de tes 900 € par mois ?");
    expect(questionDedans("Paille", "300 €")).toBe("Cette paille fait partie de tes 300 € par mois ?");
    expect(questionDedans("Granulés", "200 €")).toBe("Ces granulés font partie de tes 200 € par mois ?");
    expect(questionDedans("MSA (cotisations sociales)", "250 €")).toBe("Cette dépense, « MSA (cotisations sociales) », fait partie de tes 250 € par mois ?");
  });

  it("accorde les postes connus et reste neutre pour un nom inconnu", () => {
    expect(questionDedans("Eau", "80 €")).toBe("Cette eau fait partie de tes 80 € par mois ?");
    expect(questionDedans("Électricité", "120 €")).toBe("Cette électricité fait partie de tes 120 € par mois ?");
    expect(questionDedans("Assurance", "150 €")).toBe("Cette assurance fait partie de tes 150 € par mois ?");
    expect(questionDedans("Entretien", "300 €")).toBe("Cet entretien fait partie de tes 300 € par mois ?");
    expect(questionDedans("Personnel", "2 000 €")).toBe("Ces salaires font partie de tes 2 000 € par mois ?");
    expect(questionDedans("Fournitures", "50 €")).toBe("Ces fournitures font partie de tes 50 € par mois ?");
    expect(questionDedans("Abreuvoirs", "40 €")).toBe("Cette dépense, « Abreuvoirs », fait partie de tes 40 € par mois ?");
    expect(questionDedans("Ostéo", "60 €")).toBe("Cette dépense, « Ostéo », fait partie de tes 60 € par mois ?");
    expect(questionDedans("Frais communs", "900 €")).toBe("Cette dépense, « Frais de l’écurie », fait partie de tes 900 € par mois ?");
  });
});

describe("un achat « dedans » pour plusieurs mois", () => {
  const mois = (k: number) => ({ year: 2026 + Math.floor((9 + k) / 12), month: ((9 + k) % 12) + 1 });

  it("5 400 € de foin pour 6 mois : 900 € décomptés chaque mois, l'année ne compte pas double", () => {
    const d = data({ dansEstimation: true, totalAmount: 5400, dansMois: 6 });
    expect(stablePnl(d, oct).sharedCosts).toBe(5400);
    for (let k = 1; k < 6; k++) expect(stablePnl(d, mois(k)).sharedCosts).toBe(0);
    // Le septième mois, l'estimation revient.
    expect(stablePnl(d, mois(6)).sharedCosts).toBe(900);
    const six = [0, 1, 2, 3, 4, 5].reduce((t, k) => t + stablePnl(d, mois(k)).sharedCosts, 0);
    expect(six).toBe(6 * 900);
  });

  it("Corriger reprend le choix : la feuille se rouvre sur « 6 mois »", () => {
    expect(ligneRemplie(data({ dansEstimation: true, dansMois: 6 }), { t: "sh", id: "se1" })?.dansMois).toBe(6);
    expect(ligneRemplie(data({ dansEstimation: true }), { t: "sh", id: "se1" })?.dansMois).toBe(1);
    expect(ligneRemplie(data({}), { t: "sh", id: "se1" })?.dansMois).toBeUndefined();
  });

  it("pour un seul mois (le choix par défaut) : comme avant", () => {
    const d = data({ dansEstimation: true, totalAmount: 5400, dansMois: 1 });
    expect(stablePnl(d, mois(1)).sharedCosts).toBe(900);
  });

  it("le décompte tombe juste au centime : 100 € sur 3 mois", () => {
    const se = { totalAmount: 100, periodYear: 2026, periodMonth: 10, dansMois: 3 };
    expect([0, 1, 2, 3].map((k) => partDuMois(se, mois(k)))).toEqual([33.33, 33.33, 33.34, 0]);
    expect(partDuMois(se, { year: 2026, month: 9 })).toBe(0);
  });
});
