import { describe, expect, it } from "vitest";
import { Fenetre, MAX, Memoire, contenuChiffre, jetonBienForme, versionsEnTrop } from "@/supabase/functions/tiroirs/regles";

const hex = "a".repeat(64);

describe("la fonction tiroirs : ses garde-fous", () => {
  it("n'accepte que le jeton de mon-ecurie.fr (numéro, point, 64 hexadécimaux)", () => {
    expect(jetonBienForme(`42.${hex}`)).toBe(true);
    expect(jetonBienForme("abc")).toBe(false);
    expect(jetonBienForme(hex)).toBe(false);
    expect(jetonBienForme(`42.${"A".repeat(64)}`)).toBe(false);
    expect(jetonBienForme(`42.${hex}0`)).toBe(false);
    expect(jetonBienForme(`x.${hex}`)).toBe(false);
  });

  it("refuse un contenu qui n'est pas chiffré par l'app", () => {
    expect(contenuChiffre("bs-enc1:iv.ct")).toBe(true);
    expect(contenuChiffre('{"state":{}}')).toBe(false);
    expect(contenuChiffre("bs-enc1:")).toBe(false);
    expect(MAX).toBe(2_000_000);
  });

  it("au plus 6 envois par minute et par compte, puis ça repart", () => {
    const f = new Fenetre(6, 60_000);
    for (let i = 0; i < 6; i++) expect(f.depasse("7", 1000 + i)).toBe(false);
    expect(f.depasse("7", 2000)).toBe(true);
    expect(f.depasse("8", 2000)).toBe(false);
    expect(f.depasse("7", 61_001)).toBe(false);
  });

  it("garde un refus quelques minutes, puis l'oublie", () => {
    const m = new Memoire<true>(5 * 60_000);
    m.poser("t", true, 0);
    expect(m.lire("t", 4 * 60_000)).toBe(true);
    expect(m.lire("t", 5 * 60_000)).toBeUndefined();
  });

  it("ne garde que les 30 versions les plus récentes", () => {
    const ids = Array.from({ length: 33 }, (_, i) => ({ id: 100 - i }));
    expect(versionsEnTrop(ids)).toEqual([70, 69, 68]);
    expect(versionsEnTrop(ids.slice(0, 30))).toEqual([]);
  });
});
