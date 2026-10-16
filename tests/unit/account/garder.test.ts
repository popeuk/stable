import { beforeEach, describe, expect, it } from "vitest";

// Un localStorage minimal, comme dans le navigateur.
class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}
const store = new Mem();
(globalThis as unknown as { localStorage: Mem }).localStorage = store;
(globalThis as unknown as { window: object }).window = globalThis;

const { vault, adoptLocale, mergeLocaleSettings, resumeEssai, resumeLocale } = await import("@/lib/account/vault");
const { setSession, clearSession, scopeOf, hasLocaleData } = await import("@/lib/account/session");

const key = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = (userId: number, dataKey: string, title?: string) => ({
  kind: "compte" as const,
  userId,
  email: `${userId}@x.fr`,
  prenom: "Julien",
  token: "t",
  dataKey,
  listing: title ? { id: 1, title, status: "validee" as const } : null,
  at: "",
});
const locale = { kind: "locale" as const, at: "" };

const essai = JSON.stringify({
  state: {
    horses: [
      { id: "h1", name: "Cheval 1", pension: 450, isArchived: false },
      { id: "h2", name: "Cheval 2", pension: 450, isArchived: false },
      { id: "h3", name: "Cheval 3", pension: 450, isArchived: false },
    ],
    recurringExpenses: [{ id: "r1", label: "Frais fixes (foin, loyer, salaires)", amount: 3500, isShared: true, categoryId: "c" }],
    seances: [{ id: "s1" }, { id: "s2" }],
    careEvents: [],
  },
  version: 2,
});
const reglagesEssai = JSON.stringify({ state: { stableName: "Mon écurie", gerant: "", objective: 1000, parcours: { chevaux: true, tarifs: true, factures: true, journee: false } }, version: 5 });

describe("l'écurie essayée sans compte", () => {
  beforeEach(() => {
    store.m.clear();
    clearSession();
  });

  it("a son propre tiroir, en clair", async () => {
    setSession(locale);
    expect(scopeOf()).toBe("locale");
    await vault.setItem("be-stable-data", essai);
    expect(store.getItem("be-stable-data@locale")).toBe(essai);
    expect(hasLocaleData()).toBe(true);
    expect(await vault.getItem("be-stable-data")).toBe(essai);
  });

  it("se résume pour l'écran « On garde tout pour demain. »", () => {
    expect(resumeEssai(essai)).toEqual({ chevaux: 3, pension: 450, frais: 3500, seances: 2 });
    expect(resumeEssai(null)).toBeNull();
    expect(resumeEssai("pas du json")).toBeNull();
    store.setItem("be-stable-data@locale", essai);
    expect(resumeLocale()?.chevaux).toBe(3);
  });

  it("passe chiffrée dans un compte vide, puis disparaît de l'appareil", async () => {
    store.setItem("be-stable-data@locale", essai);
    store.setItem("be-stable-settings@locale", reglagesEssai);
    setSession(compte(4, key(), "Les Trois Pommiers"));
    expect(await adoptLocale("locale")).toBe(true);

    expect(store.getItem("be-stable-data@locale")).toBeNull();
    expect(store.getItem("be-stable-settings@locale")).toBeNull();
    expect(hasLocaleData()).toBe(false);

    const brut = store.getItem("be-stable-data@u4")!;
    expect(brut.startsWith("bs-enc1:")).toBe(true);
    expect(brut).not.toContain("Cheval 1");
    expect(await vault.getItem("be-stable-data")).toBe(essai);

    const reglages = JSON.parse((await vault.getItem("be-stable-settings"))!);
    // Le nom de la fiche et le prénom du compte remplacent les valeurs d'essai.
    expect(reglages.state.stableName).toBe("Les Trois Pommiers");
    expect(reglages.state.gerant).toBe("Julien");
    expect(reglages.state.parcours.chevaux).toBe(true);
    expect(reglages.version).toBe(5);
  });

  it("garde l'écurie du compte si on le choisit, et efface l'essai", async () => {
    const k = key();
    setSession(compte(5, k));
    await vault.setItem("be-stable-data", '{"state":{"horses":["Sirius"]}}');
    store.setItem("be-stable-data@locale", essai);
    store.setItem("be-stable-settings@locale", reglagesEssai);
    expect(await adoptLocale("compte")).toBe(true);
    expect(hasLocaleData()).toBe(false);
    expect(store.getItem("be-stable-settings@locale")).toBeNull();
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":["Sirius"]}}');
  });

  it("remplace l'écurie du compte si on garde l'essai, sans perdre ses réglages", async () => {
    setSession(compte(6, key()));
    await vault.setItem("be-stable-data", '{"state":{"horses":["Sirius"]}}');
    await vault.setItem("be-stable-settings", JSON.stringify({ state: { stableName: "La Pommeraie", objective: 2000, parcours: { chevaux: true, tarifs: false, factures: false, journee: true } }, version: 5 }));
    store.setItem("be-stable-data@locale", essai);
    store.setItem("be-stable-settings@locale", reglagesEssai);
    await adoptLocale("locale");
    expect(await vault.getItem("be-stable-data")).toBe(essai);
    const r = JSON.parse((await vault.getItem("be-stable-settings"))!);
    expect(r.state.stableName).toBe("La Pommeraie");
    expect(r.state.objective).toBe(2000);
    expect(r.state.parcours).toEqual({ chevaux: true, tarifs: true, factures: true, journee: true });
  });

  it("ne fait rien sans compte connecté", async () => {
    store.setItem("be-stable-data@locale", essai);
    setSession(locale);
    expect(await adoptLocale("locale")).toBe(false);
    expect(hasLocaleData()).toBe(true);
  });

  it("fusionne les réglages sans rien inventer", () => {
    expect(mergeLocaleSettings(null, null)).toBeNull();
    const garde = JSON.parse(mergeLocaleSettings(JSON.stringify({ state: { stableName: "Le Haras", gerant: "Léa" }, version: 5 }), null, { stableName: "Fiche", gerant: "Julien" })!);
    expect(garde.state).toEqual({ stableName: "Le Haras", gerant: "Léa" });
  });
});
