import { describe, it, expect } from "vitest";
import { scopeOf, scopedKey, type AccountSession } from "@/lib/account/session";

const base: AccountSession = { kind: "compte", userId: 33, email: "fabien@example.com", prenom: "Fabien", token: "33.x", dataKey: "a2V5", at: "2026-11-27" };

describe("l'écurie ouverte en équipe", () => {

  it("garde son propre tiroir sur l'appareil, séparé de celui du compte", () => {
    expect(scopeOf(base)).toBe("u33");
    const enEquipe = { ...base, espace: { id: 32, nom: "L’écurie de Claire", gerant: "Claire", dataKey: "Y2xl" } };
    expect(scopeOf(enEquipe)).toBe("u33-e32");
    expect(scopedKey("be-stable-data", enEquipe)).toBe("be-stable-data@u33-e32");
  });
  it("revient au tiroir du compte quand l'écurie est refermée", () => {
    expect(scopeOf({ ...base, espace: null })).toBe("u33");
  });
});
