import { describe, expect, it } from "vitest";
import { CLE_RECHARGE, estChargementRate, rechargerUneFois } from "@/lib/erreur";

function rangement() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("écran d'erreur : morceau de code introuvable après une mise en ligne", () => {
  it("reconnaît ChunkLoadError et « Loading chunk »", () => {
    const e = new Error("Loading chunk 123 failed.");
    expect(estChargementRate(e)).toBe(true);
    const c = new Error("x");
    c.name = "ChunkLoadError";
    expect(estChargementRate(c)).toBe(true);
    expect(estChargementRate(new TypeError("Failed to fetch dynamically imported module: /a.js"))).toBe(true);
  });

  it("ne confond pas un bug ordinaire avec une mise en ligne", () => {
    expect(estChargementRate(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(estChargementRate(null)).toBe(false);
    expect(rechargerUneFois(new Error("boum"), rangement())).toBe(false);
  });

  it("recharge une seule fois, puis laisse l'écran d'erreur (pas de boucle)", () => {
    const r = rangement();
    const e = new Error("Loading chunk 7 failed");
    expect(rechargerUneFois(e, r, 1_000_000)).toBe(true);
    expect(r.m.get(CLE_RECHARGE)).toBe("1000000");
    expect(rechargerUneFois(e, r, 1_010_000)).toBe(false);
    // Bien plus tard (une autre mise en ligne), on peut recharger de nouveau.
    expect(rechargerUneFois(e, r, 1_000_000 + 120_000)).toBe(true);
  });

  it("sans rangement utilisable, ne recharge pas", () => {
    const e = new Error("Loading chunk 7 failed");
    expect(rechargerUneFois(e, null)).toBe(false);
    const casse = { getItem: () => { throw new Error("bloqué"); }, setItem: () => {} };
    expect(rechargerUneFois(e, casse)).toBe(false);
  });
});
