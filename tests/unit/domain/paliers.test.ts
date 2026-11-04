import { describe, expect, it } from "vitest";
import { PALIERS_DEPART, manquePour, moisDuSuivi, palierAtteint, palierVise, paliersValables, paliersVides, type Palier } from "@/lib/domain/paliers";

// Des paliers d'exemple : les vrais sont posés par le gérant dans l'app.
const P: Palier[] = [
  { nom: "Un", fin: "2026-12", seuil: 0, pensions: 5 },
  { nom: "Deux", fin: "2027-04", seuil: 1000, pensions: 7 },
  { nom: "Trois", fin: "2027-09", seuil: 2000, pensions: 9 },
  { nom: "Quatre", fin: "2027-10", seuil: 3000, pensions: 11 },
];

describe("les paliers", () => {
  it("rien n'est posé d'avance", () => {
    expect(PALIERS_DEPART).toEqual([]);
    expect(paliersVides()).toHaveLength(4);
    expect(paliersValables(paliersVides())).toBe(false);
  });
  it("le palier visé suit le calendrier", () => {
    expect(palierVise(P, { year: 2026, month: 10 })).toBe(0);
    expect(palierVise(P, { year: 2026, month: 12 })).toBe(0);
    expect(palierVise(P, { year: 2027, month: 1 })).toBe(1);
    expect(palierVise(P, { year: 2027, month: 5 })).toBe(2);
    expect(palierVise(P, { year: 2027, month: 10 })).toBe(3);
    expect(palierVise(P, { year: 2028, month: 3 })).toBe(3);
    expect(palierVise([], { year: 2027, month: 1 })).toBe(-1);
  });
  it("le palier atteint suit le résultat du mois", () => {
    expect(palierAtteint(P, -10)).toBe(-1);
    expect(palierAtteint(P, 0)).toBe(0);
    expect(palierAtteint(P, 999)).toBe(0);
    expect(palierAtteint(P, 1000)).toBe(1);
    expect(palierAtteint(P, 5000)).toBe(3);
  });
  it("le manque est arrondi et jamais négatif", () => {
    expect(manquePour(P, 1, 600.4)).toBe(400);
    expect(manquePour(P, 0, 300)).toBe(0);
    expect(manquePour(P, 9, 0)).toBe(0);
  });
  it("le suivi va de septembre 2026 au dernier mois du dernier palier", () => {
    const m = moisDuSuivi(P);
    expect(m).toHaveLength(14);
    expect(m[0]).toEqual({ year: 2026, month: 9 });
    expect(m[13]).toEqual({ year: 2027, month: 10 });
    expect(moisDuSuivi([])).toEqual([]);
  });
  it("refuse des paliers mal formés", () => {
    expect(paliersValables(P)).toBe(true);
    expect(paliersValables([])).toBe(false);
    expect(paliersValables([{ nom: "", fin: "2027-01", seuil: 0, pensions: 1 }])).toBe(false);
    expect(paliersValables([{ nom: "A", fin: "2027-13", seuil: 0, pensions: 1 }])).toBe(false);
    expect(paliersValables([{ nom: "A", fin: "2027-05", seuil: 0, pensions: 1 }, { nom: "B", fin: "2027-01", seuil: 1, pensions: 1 }])).toBe(false);
  });
});
