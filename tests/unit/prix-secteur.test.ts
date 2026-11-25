import { describe, expect, it } from "vitest";
import { departementDe, lirePrix, placeDe, secteurDe, surAxe } from "@/lib/prix-secteur";

describe("prix du secteur (Te choisir)", () => {
  it("trouve le département d'un code postal", () => {
    expect(departementDe("49125")).toBe("49");
    expect(departementDe("20000")).toBe("2A");
    expect(departementDe("20200")).toBe("2B");
    expect(departementDe("97400")).toBe("974");
    expect(departementDe("4912")).toBeNull();
    expect(departementDe(undefined)).toBeNull();
  });

  it("lit un prix écrit à la main", () => {
    expect(lirePrix("450")).toBe(450);
    expect(lirePrix("450 €")).toBe(450);
    expect(lirePrix("1 200")).toBe(1200);
    expect(lirePrix("À partir de 380 €/mois")).toBe(380);
    expect(lirePrix("")).toBeNull();
    expect(lirePrix("sur demande")).toBeNull();
  });

  it("place un prix dans la fourchette du département", () => {
    const s = { code: "49", nom: "Maine-et-Loire", releves: 40, mediane: 260, bas: 200, haut: 340 };
    expect(placeDe(150, s)).toBe("sous");
    expect(placeDe(200, s)).toBe("dans");
    expect(placeDe(340, s)).toBe("dans");
    expect(placeDe(590, s)).toBe("dessus");
    const a = surAxe(590, s);
    expect(a.pct(a.min)).toBe(0);
    expect(a.pct(a.max)).toBe(100);
    expect(a.pct(590)).toBeLessThan(100);
  });

  it("lit l'Observatoire", () => {
    const s = secteurDe("01000");
    expect(s?.nom).toBe("Ain");
    expect(s && s.bas <= s.mediane && s.mediane <= s.haut).toBe(true);
  });
});
