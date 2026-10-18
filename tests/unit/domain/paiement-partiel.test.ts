import { describe, expect, it } from "vitest";
import { repartirPaiement, suggestionsPartielles } from "@/lib/domain/paiement";

describe("le paiement partiel", () => {
  it("des suggestions en puces, toutes sous ce qui est dû", () => {
    expect(suggestionsPartielles(26)).toEqual([13, 20]);
    expect(suggestionsPartielles(350)).toEqual([20, 50, 100, 175]);
    expect(suggestionsPartielles(15)).toEqual([8]);
  });
});

describe("un paiement sur plusieurs mois dus", () => {
  const dus = [
    { month: "2026-10", due: 400 },
    { month: "2026-09", due: 120 },
  ];
  it("le plus ancien d'abord", () => {
    expect(repartirPaiement(dus, 500)).toEqual([
      { month: "2026-09", amount: 120 },
      { month: "2026-10", amount: 380 },
    ]);
  });
  it("tout payé : chaque mois soldé", () => {
    expect(repartirPaiement(dus, 520)).toEqual([
      { month: "2026-09", amount: 120 },
      { month: "2026-10", amount: 400 },
    ]);
  });
  it("une petite somme ne touche que le plus ancien", () => {
    expect(repartirPaiement(dus, 50)).toEqual([{ month: "2026-09", amount: 50 }]);
  });
});
