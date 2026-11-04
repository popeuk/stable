import { describe, expect, it } from "vitest";
import { chevalDuCavalier } from "@/lib/domain/seances";

describe("le cheval d'un client inscrit", () => {
  it("son cheval s'il est de la séance", () => {
    expect(chevalDuCavalier(["keene"], ["keene", "mambo"], 1)).toBe("keene");
  });
  it("un cheval de la séance s'il en monte un autre que le sien", () => {
    expect(chevalDuCavalier(["keene"], ["mambo"], 0)).toBe("mambo");
  });
  it("plusieurs clients sur le même cheval de l'écurie", () => {
    expect([0, 1, 2].map((i) => chevalDuCavalier([], ["mambo"], i))).toEqual(["mambo", "mambo", "mambo"]);
  });
  it("sans cheval à la séance : le sien, sinon aucun", () => {
    expect(chevalDuCavalier(["keene"], [], 0)).toBe("keene");
    expect(chevalDuCavalier([], [], 0)).toBeUndefined();
  });
});
