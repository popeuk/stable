import { describe, expect, it } from "vitest";
import { DUREE_CHOIX_MS, MESURE_POSEE, choixValable, gaValide, mesurer, pixelValide } from "@/lib/mesure";

describe("la mesure d'audience et le consentement", () => {
  it("éteinte par défaut : sans identifiant, rien n'est posé ni mesuré", () => {
    expect(MESURE_POSEE).toBe(false);
    expect(() => mesurer("compte_cree")).not.toThrow();
  });
  it("un identifiant mal formé ne passe pas (il ne doit jamais finir dans une adresse de script)", () => {
    expect(gaValide("G-ABC123XYZ")).toBe(true);
    expect(gaValide('G-1"><script>')).toBe(false);
    expect(gaValide("UA-1234")).toBe(false);
    expect(pixelValide("123456789012345")).toBe(true);
    expect(pixelValide("12ab")).toBe(false);
  });
  it("le choix vaut 6 mois, puis on redemande", () => {
    const quand = new Date(2026, 0, 1).toISOString();
    const brut = JSON.stringify({ audience: false, pub: false, quand });
    const t0 = Date.parse(quand);
    expect(choixValable(brut, t0 + 1000)).toEqual({ audience: false, pub: false, quand });
    expect(choixValable(brut, t0 + DUREE_CHOIX_MS - 1)).not.toBeNull();
    expect(choixValable(brut, t0 + DUREE_CHOIX_MS)).toBeNull();
  });
  it("un choix abîmé ou absent : on redemande", () => {
    expect(choixValable(null)).toBeNull();
    expect(choixValable("{")).toBeNull();
    expect(choixValable(JSON.stringify({ audience: "oui", pub: false, quand: new Date().toISOString() }))).toBeNull();
  });
});
