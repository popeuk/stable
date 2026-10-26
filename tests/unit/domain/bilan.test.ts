import { describe, expect, it } from "vitest";
import { lireBilan } from "@/lib/domain/bilan";

// L'écurie de la maquette : 9 pensions à 390 €, un cheval à soi, 12 places, 4 400 € de frais en un total.
const base = {
  sharedTotal: 4400,
  direct: 0,
  horseCount: 10,
  pensions: 9,
  miens: 1,
  aCouvrir: 4400,
  contribution: 390,
  seuil: 4400 / 390,
  shared: [{ label: "Frais de l’écurie", amount: 4400 }],
};

describe("lireBilan", () => {
  const l = lireBilan(base, { pension: 390, pensionsDuMois: 3510, cours: 0, capacity: 12 });

  it("dit ce que coûte un cheval face à la pension", () => {
    expect(l.coutCheval).toBe(440);
    expect(l.ecart).toBe(50);
  });

  it("voit que même pleine, la pension ne paie pas les frais", () => {
    expect(l.memePlein).toEqual({ places: 11, manque: 110 });
  });

  it("compte les places libres sans le cheval du gérant", () => {
    expect(l.libres).toBe(2);
    expect(l.coutMiens).toBe(440);
  });

  it("pose la hausse à côté d'un départ", () => {
    expect(l.hausse).toEqual({ pas: 20, gain: 180, depart: 390 });
  });

  it("sait que des frais en un total ne disent pas ce que coûte un cheval de plus", () => {
    expect(l.fraisEnUnTotal).toBe(true);
  });

  it("ne parle pas de places sans nombre de places", () => {
    const s = lireBilan(base, { pension: 390, pensionsDuMois: 3510, cours: 0, capacity: 0 });
    expect(s.libres).toBeNull();
    expect(s.memePlein).toBeNull();
  });

  it("prend la moyenne des pensions sans tarif", () => {
    const s = lireBilan(base, { pensionsDuMois: 3600, cours: 0, capacity: 12 });
    expect(s.pension).toBe(400);
  });
});
