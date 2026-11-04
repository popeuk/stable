import { describe, expect, it } from "vitest";
import { lignesAMontrer, lignesPrestations, objectifDe, realisePrestations } from "@/lib/domain/objectifs-prestations";
import type { Horse, Seance, StableData } from "@/lib/domain/types";

const cheval = (id: string, pensionType: string | undefined, pension = 400, extra: Partial<Horse> = {}): Horse =>
  ({ id, stableId: "s", name: id, isArchived: false, pensionType, pension, ...extra }) as Horse;

const seance = (id: string, prestationId: string, date: string, extra: Partial<Seance> = {}): Seance =>
  ({ id, prestationId, title: "", participants: [], horseIds: [], date, start: "10:00", end: "11:00", status: "done", unitPrice: 40, ...extra }) as Seance;

function donnees(): StableData {
  return {
    horses: [cheval("a", "Pension travail"), cheval("b", "Pension travail"), cheval("c", "Retraite", 450), cheval("m", "À moi", 0)],
    revenues: [
      { id: "r1", stableId: "s", horseId: "a", categoryId: "rev-0", amount: 490, date: "2026-11-01", source: "recurring" },
      { id: "r2", stableId: "s", horseId: "c", categoryId: "rev-0", amount: 450, date: "2026-11-01", source: "recurring" },
      { id: "r3", stableId: "s", horseId: "", categoryId: "rev-5", amount: 190, date: "2026-11-03", source: "manual" },
      { id: "r4", stableId: "s", horseId: "", categoryId: "rev-6", amount: 390, date: "2026-11-10", source: "manual" },
      { id: "r5", stableId: "s", horseId: "", categoryId: "rev-1", amount: 40, date: "2026-11-05", source: "manual", seanceId: "x" },
      { id: "r6", stableId: "s", horseId: "", categoryId: "rev-5", amount: 190, date: "2026-10-03", source: "manual" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [
      { id: "rev-0", name: "Pension" },
      { id: "rev-1", name: "Cours" },
      { id: "rev-5", name: "Demi-pension" },
      { id: "rev-6", name: "Stage de création" },
    ],
    expenseCategories: [],
    prestations: [
      { id: "cours", label: "Cours", price: 40, hasFormat: true, active: true },
      { id: "travail", label: "Travail du cheval", price: 30, active: true },
      { id: "vieux", label: "Ancien", price: 10, active: false },
    ],
    seances: [
      seance("s1", "cours", "2026-11-05", { format: "particulier", participants: [{ personId: "p1", present: true }] }),
      seance("s2", "cours", "2026-11-06", { format: "collectif", participants: [{ personId: "p1", present: true }, { personId: "p2", present: false }, { personId: "p3", present: true }] }),
      seance("s3", "cours", "2026-11-07", { format: "collectif", status: "cancelled", participants: [{ personId: "p1" }] }),
      seance("s4", "travail", "2026-11-08", { horseIds: ["a"], unitPrice: 30 }),
      seance("s5", "cours", "2026-10-30", { format: "particulier", participants: [{ personId: "p1", present: true }] }),
    ],
  };
}

describe("objectifs par prestation", () => {
  it("les prestations se lisent dans Mon argent", () => {
    const l = lignesPrestations(donnees());
    expect(l.map((x) => x.cle)).toEqual([
      "pension:Pension travail",
      "pension:Retraite",
      "seance:cours:particulier",
      "seance:cours:collectif",
      "seance:travail:",
      "recette:rev-5",
      "recette:rev-6",
    ]);
    expect(l.find((x) => x.cle === "seance:cours:collectif")?.nom).toBe("Cours, collectif");
  });

  it("le réalisé du mois : chevaux, places, recettes", () => {
    const r = realisePrestations(donnees(), { year: 2026, month: 11 });
    expect(r["pension:Pension travail"]).toEqual({ nombre: 2, montant: 490 });
    expect(r["pension:Retraite"]).toEqual({ nombre: 1, montant: 450 });
    expect(r["pension:À moi"]).toBeUndefined();
    expect(r["seance:cours:particulier"]).toEqual({ nombre: 1, montant: 40 });
    // Un absent ne compte pas, une séance annulée non plus.
    expect(r["seance:cours:collectif"]).toEqual({ nombre: 2, montant: 80 });
    expect(r["seance:travail:"]).toEqual({ nombre: 1, montant: 30 });
    expect(r["recette:rev-5"]).toEqual({ nombre: 1, montant: 190 });
    expect(r["recette:rev-6"]).toEqual({ nombre: 1, montant: 390 });
    // Une recette de séance ne se compte pas deux fois.
    expect(r["recette:rev-1"]).toBeUndefined();
  });

  it("les objectifs et les prestations disparues qui en gardent un", () => {
    const o = { "pension:Retraite": [0, 1, 1, 2], "recette:disparue": [0, 0, 3, 3], "recette:vide": [0, 0, 0, 0] };
    expect(objectifDe(o, "pension:Retraite", 3)).toBe(2);
    expect(objectifDe(o, "pension:Inconnue", 1)).toBe(0);
    expect(objectifDe(o, "pension:Retraite", -1)).toBe(0);
    const a = lignesAMontrer(lignesPrestations(donnees()), o).map((x) => x.cle);
    expect(a).toContain("recette:disparue");
    expect(a).not.toContain("recette:vide");
  });
});
