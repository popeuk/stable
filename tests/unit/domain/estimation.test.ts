import { describe, expect, it } from "vitest";
import { estEstimation } from "@/lib/domain/estimation";
import { selonSexe } from "@/lib/domain/registre";
import { draftFor, manque, type Habitudes } from "@/lib/domain/ajouter";
import type { StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };

function data(owner?: string, payments: StableData["payments"] = []): StableData {
  return {
    horses: [{ id: "h1", stableId: "s", name: "Cheval 1", ownerName: owner, entryDate: "2026-10-01", isArchived: false }],
    revenues: [{ id: "r1", stableId: "s", horseId: "h1", amount: 450, date: "2026-10-01", note: "Pension", source: "recurring" }],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    people: [],
    payments,
  };
}

describe("le chiffre du mois, estimation ou réel", () => {
  it("une écurie neuve sans propriétaire : estimation", () => {
    expect(estEstimation(data(), oct)).toBe(true);
  });
  it("un propriétaire à qui demander la pension : réel", () => {
    expect(estEstimation(data("Inès R."), oct)).toBe(false);
  });
  it("un paiement reçu ce mois : réel", () => {
    expect(estEstimation(data(undefined, [{ id: "p", payer: "Emma", month: "2026-10", amount: 30, at: "" }]), oct)).toBe(false);
  });
  it("rien qui rentre : pas d'estimation à dire", () => {
    expect(estEstimation({ ...data(), revenues: [] }, oct)).toBe(false);
  });
});

describe("l'accord d'un cheval", () => {
  it("jument au féminin, hongre au masculin, inconnu neutre", () => {
    expect(selonSexe({ sex: "femelle" }, "il", "elle", "ce cheval")).toBe("elle");
    expect(selonSexe({ sex: "hongre" }, "il", "elle", "ce cheval")).toBe("il");
    expect(selonSexe({}, "il", "elle", "ce cheval")).toBe("ce cheval");
  });
});

describe("la feuille Soin", () => {
  const h = { cours: [], soins: [{ kind: "ferrure", label: "Maréchal", price: 85, start: "09:30", habit: true }], quoi: [] } as unknown as Habitudes;
  it("ne coche aucun soin d'avance", () => {
    expect(draftFor("soin", h, "2026-10-17").care).toBeNull();
  });
  it("demande le soin avant d'enregistrer", () => {
    expect(manque(draftFor("soin", h, "2026-10-17"))).toBe(true);
    expect(manque(draftFor("soin", h, "2026-10-17", { care: "ferrure" }))).toBe(false);
  });
});
