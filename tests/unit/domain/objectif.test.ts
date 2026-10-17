import { describe, expect, it } from "vitest";
import { hasObjective, objectifManque, objectifPct, phraseObjectif, phraseObjectifMois, phrasePistes } from "@/lib/domain/objectif";

describe("objectif du mois : 0 veut dire « pas d'objectif »", () => {
  it("sans objectif, aucun manque ni pourcentage", () => {
    expect(hasObjective(0)).toBe(false);
    expect(objectifManque(64, 0)).toBeNull();
    expect(objectifPct(64, 0)).toBeNull();
    expect(phraseObjectif(64, 0)).toBe("");
    expect(phraseObjectifMois(64, 0, true)).toBe("");
    expect(phraseObjectifMois(64, 0, false)).toBe("");
    expect(phrasePistes(64, 0)).toBe("Avec ces idées, jusqu’à");
  });
  it("avec un objectif, le manque et l'atteinte", () => {
    expect(objectifManque(64, 1000)).toBe(936);
    expect(phraseObjectif(64, 1000).replace(/\s/g, " ")).toBe("Il te manque 936 € pour ton objectif de 1 000 €.");
    expect(phraseObjectif(1200, 1000)).toMatch(/atteint/);
    expect(phrasePistes(64, 1000)).toMatch(/^Il te manque 936/);
    expect(objectifPct(500, 1000)).toBe(50);
  });
});
