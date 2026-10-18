import { describe, expect, it } from "vitest";
import { EcuriesTexte, ecuriesTexte } from "@/lib/annuaire";

describe("le nombre d'écuries de l'annuaire", () => {
  it("arrondit au millier du dessous (12 138 donne plus de 12 000)", () => {
    expect(ecuriesTexte(12138)).toBe("plus de 12 000 écuries");
    expect(ecuriesTexte(12999)).toBe("plus de 12 000 écuries");
  });
  it("un millier tout rond ne dit pas « plus de »", () => {
    expect(ecuriesTexte(13000)).toBe("13 000 écuries");
  });
  it("sans réseau ou sans chiffre : des milliers", () => {
    expect(ecuriesTexte(null)).toBe("des milliers d’écuries");
    expect(ecuriesTexte(undefined)).toBe("des milliers d’écuries");
    expect(ecuriesTexte(Number.NaN)).toBe("des milliers d’écuries");
    expect(ecuriesTexte(0)).toBe("des milliers d’écuries");
  });
  it("en début de phrase, une majuscule", () => {
    expect(EcuriesTexte(12138)).toBe("Plus de 12 000 écuries");
    expect(EcuriesTexte(null)).toBe("Des milliers d’écuries");
  });
});
