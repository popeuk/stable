import { describe, expect, it } from "vitest";

// Le portier et les réglages importent la session (localStorage) : un minimum suffit.
(globalThis as unknown as { localStorage: object }).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { gateTarget } = await import("@/components/ed/onboarding-gate");
const { settingsAtOpen, DEMO_OBJECTIVE, hasObjective } = await import("@/stores/settings-store");

const rien = { chevaux: false, tarifs: false, factures: false };
const fini = { chevaux: true, tarifs: true, factures: true };

describe("« Juste regarder l'écurie d'exemple »", () => {
  it("la démo s'ouvre avec un parcours fini, sur l'accueil", () => {
    const p = settingsAtOpen("demo", true)!;
    expect(Object.values(p.parcours!).every(Boolean)).toBe(true);
    expect(p.arrived).toBe(true);
    expect(p.objective).toBe(DEMO_OBJECTIVE);
  });
  it("une démo déjà ouverte avant le correctif voit aussi son parcours fini", () => {
    const p = settingsAtOpen("demo", false)!;
    expect(Object.values(p.parcours!).every(Boolean)).toBe(true);
    expect(p.objective).toBeUndefined();
  });
  it("le portier ne renvoie jamais la démo vers /parcours", () => {
    expect(gateTarget("demo", rien, false, "/accueil")).toBeNull();
  });
  it("l'essai sans compte et le vrai compte passent toujours par le parcours", () => {
    expect(gateTarget("locale", rien, false, "/accueil")).toBe("/parcours");
    expect(gateTarget("compte", rien, false, "/accueil")).toBe("/parcours");
    expect(gateTarget("compte", fini, false, "/accueil")).toBeNull();
    expect(gateTarget("locale", rien, true, "/accueil")).toBeNull();
    expect(gateTarget("locale", rien, false, "/parcours/tarifs")).toBeNull();
    expect(gateTarget(null, fini, false, "/accueil")).toBe("/bienvenue");
  });
  it("un compte neuf ou un essai neuf démarrent sans objectif", () => {
    expect(settingsAtOpen("locale", true)!.objective).toBe(0);
    expect(settingsAtOpen("compte", true, { prenom: "Léa" })!.objective).toBe(0);
    expect(settingsAtOpen("compte", true, { prenom: "Léa" })!.gerant).toBe("Léa");
    expect(settingsAtOpen("locale", false)).toBeNull();
    expect(hasObjective(0)).toBe(false);
    expect(hasObjective(800)).toBe(true);
  });
});
