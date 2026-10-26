import { describe, expect, it } from "vitest";
import { activiteDite, typeDeLigne } from "@/lib/domain/activite";
import { FACTURATION } from "@/lib/fonctions";
import type { StableData } from "@/lib/domain/types";

const data = {
  prestations: [
    { id: "p-cours", label: "Cours d’équitation", price: 25, active: true },
    { id: "p-balade", label: "Balade encadrée", price: 20, active: true },
    { id: "p-stage", label: "Stage de Toussaint", price: 90, active: true },
    { id: "p-travail", label: "Travail du cheval", price: 30, active: true },
  ],
  seances: [
    { id: "s1", prestationId: "p-cours", title: "Cours du soir" },
    { id: "s2", prestationId: "p-balade", title: "Balade du dimanche" },
    { id: "s3", prestationId: "p-stage", title: "Stage" },
    { id: "s4", prestationId: "p-travail", title: "Travail de Tango" },
    { id: "s5", prestationId: "p-cours", title: "Cours de Sirius" },
  ],
} as unknown as StableData;

describe("l'activité d'un client sur un mois", () => {
  it("range chaque ligne : pension, cours, balade, stage, travail, soin, autre", () => {
    expect(typeDeLigne(data, { label: "Pension" })).toBe("pension");
    expect(typeDeLigne(data, { label: "Cours d’équitation", seanceId: "s1" })).toBe("cours");
    expect(typeDeLigne(data, { label: "Balade encadrée", seanceId: "s2" })).toBe("balade");
    expect(typeDeLigne(data, { label: "Stage", seanceId: "s3" })).toBe("stage");
    expect(typeDeLigne(data, { label: "Travail du cheval", seanceId: "s4" })).toBe("travail");
    expect(typeDeLigne(data, { label: "Ostéo", rebillOf: "e1" })).toBe("soin");
    expect(typeDeLigne(data, { label: "Transport concours" })).toBe("autre");
  });
  it("le dit en mots, dans un ordre fixe : « 1 pension, 2 cours, 1 soin »", () => {
    const lignes = [
      { label: "Cours", seanceId: "s1" },
      { label: "Ostéo", rebillOf: "e1" },
      { label: "Pension" },
      { label: "Cours", seanceId: "s5" },
    ];
    expect(activiteDite(data, lignes)).toBe("1 pension, 2 cours, 1 soin");
    expect(activiteDite(data, [])).toBe("");
  });
});

describe("l'interrupteur de la facturation", () => {
  it("est éteint depuis le 26 octobre 2026 : l'app parle de ce que rapporte un client, pas de ce qu'il doit", () => {
    expect(FACTURATION).toBe(false);
  });
});
