import { describe, expect, it } from "vitest";
import { essaiPossible, estOuverte, etatsBriques, jourEssai, type EtatCompte } from "@/lib/briques";

const compte = (p: Partial<EtatCompte> = {}): EtatCompte => ({ kind: "compte", ouvert: false, essaiDebut: null, aujourdhui: "2026-11-10", ...p });

describe("etatsBriques", () => {
  it("avant l'ouverture : Vitrine et Demandes ouvertes, le reste « bientôt »", () => {
    expect(etatsBriques(compte())).toEqual({ vitrine: "ouverte", demandes: "ouverte", argent: "bientot", planning: "bientot", site: "bientot", trouver: "bientot", choisir: "bientot" });
  });

  it("après l'ouverture, sans rien : cadenas", () => {
    const e = etatsBriques(compte({ ouvert: true }));
    expect(e.argent).toBe("cadenas");
    expect(e.planning).toBe("cadenas");
    expect(e.site).toBe("cadenas");
  });

  it("l'essai dure 7 jours, jour compris, puis cadenas, pour toute l'app", () => {
    expect(etatsBriques(compte({ ouvert: true, essaiDebut: "2026-11-10" })).argent).toBe("essai");
    expect(etatsBriques(compte({ ouvert: true, essaiDebut: "2026-11-04", aujourdhui: "2026-11-10" })).trouver).toBe("essai");
    expect(etatsBriques(compte({ ouvert: true, essaiDebut: "2026-11-03", aujourdhui: "2026-11-10" })).argent).toBe("cadenas");
  });

  it("un seul abonnement à 29,99 € ouvre tout : Mon argent, planning, site, Te trouver, Te choisir", () => {
    const e = etatsBriques(compte({ ouvert: true, essaiDebut: "2026-01-01", abonne: true }));
    expect([e.argent, e.planning, e.site, e.trouver, e.choisir].every((x) => x === "ouverte")).toBe(true);
  });

  it("un abonnement payé avant l'ouverture reste « bientôt » tant que ce n'est pas ouvert", () => {
    expect(etatsBriques(compte({ abonne: true })).argent).toBe("bientot");
  });

  it("la démo et l'écurie sans compte gardent tout ouvert", () => {
    expect(Object.values(etatsBriques(compte({ kind: "demo" }))).every((e) => e === "ouverte")).toBe(true);
    expect(Object.values(etatsBriques(compte({ kind: "locale" }))).every((e) => e === "ouverte")).toBe(true);
  });
});

describe("jourEssai, essaiPossible, estOuverte", () => {
  it("compte les jours de l'essai à partir de 1", () => {
    expect(jourEssai("2026-11-10", "2026-11-10")).toBe(1);
    expect(jourEssai("2026-11-10", "2026-11-16")).toBe(7);
  });

  it("l'essai ne commence qu'une fois, après l'ouverture, sans abonnement", () => {
    expect(essaiPossible(compte())).toBe(false);
    expect(essaiPossible(compte({ ouvert: true }))).toBe(true);
    expect(essaiPossible(compte({ ouvert: true, essaiDebut: "2026-11-01" }))).toBe(false);
    expect(essaiPossible(compte({ ouvert: true, abonne: true }))).toBe(false);
  });

  it("ouverte et essai donnent accès, cadenas et bientôt non", () => {
    expect([estOuverte("ouverte"), estOuverte("essai"), estOuverte("cadenas"), estOuverte("bientot")]).toEqual([true, true, false, false]);
  });
});
