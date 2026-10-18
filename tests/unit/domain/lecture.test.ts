import { describe, expect, it } from "vitest";
import { barreDuMois, montantCommun, pensionsQuiManquent, phraseSeuil } from "@/lib/domain/lecture";

describe("chevaux qui laissent tous la même chose", () => {
  it("regroupe quand tous ont le même montant à l'euro près", () => {
    expect(montantCommun([17, 17.2, 16.8, 17])).toBe(17);
  });
  it("garde la liste dès qu'un cheval diffère, ou avec un seul cheval", () => {
    expect(montantCommun([17, 17, 40])).toBeNull();
    expect(montantCommun([17])).toBeNull();
    expect(montantCommun([])).toBeNull();
  });
});

describe("pensions qui manquent pour tout payer", () => {
  it("un nombre entier de chevaux", () => {
    expect(pensionsQuiManquent(7.5, 6)).toBe(2);
    expect(pensionsQuiManquent(9, 9)).toBe(0);
    expect(pensionsQuiManquent(9, 12)).toBe(0);
    expect(pensionsQuiManquent(Infinity, 4)).toBeNull();
  });
  it("une phrase par cas", () => {
    expect(phraseSeuil(9, 9)).toBe("Avec 9 pensions, tout est payé.");
    expect(phraseSeuil(0.5, 1)).toBe("Avec 1 pension, tout est payé.");
    expect(phraseSeuil(7.5, 6)).toBe("Il te manque 2 pensions pour tout payer.");
    expect(phraseSeuil(6.2, 6)).toBe("Il te manque 1 pension pour tout payer.");
    expect(phraseSeuil(Infinity, 3)).toMatch(/ne paient même pas les soins/);
  });
});

describe("barre du mois", () => {
  it("remplie jusqu'à aujourd'hui, avec les jours qui restent", () => {
    const b = barreDuMois("2026-10-17");
    expect(b.pct).toBeCloseTo((17 / 31) * 100);
    expect(b.debut).toBe("1 oct.");
    expect(b.fin).toBe("31 oct.");
    expect(b.aria).toBe("17 octobre, encore 14 jours dans le mois");
  });
  it("le dernier jour", () => {
    expect(barreDuMois("2026-02-28").aria).toBe("28 février, dernier jour du mois");
    expect(barreDuMois("2026-10-30").aria).toBe("30 octobre, encore 1 jour dans le mois");
  });
});
