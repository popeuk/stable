import { beforeEach, describe, expect, it } from "vitest";

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

const { ApiError } = await import("@/lib/account/api");
const { getSession, setSession } = await import("@/lib/account/session");
const sup = await import("@/lib/account/suppression");
const { SAUVEGARDE_NON_PROTEGEE } = await import("@/lib/sauvegarde");

const compte = { kind: "compte" as const, userId: 42, email: "lea@ecurie.fr", prenom: "Léa", nom: "Martin", token: "t", dataKey: "k", at: "" };
const autour = { ecran: "/moi?s=compte", version: "abc", navigateur: "UA", appareil: "écran 390 × 844" };

describe("supprimer mon compte", () => {
  beforeEach(() => {
    store.m.clear();
    setSession(compte);
    store.setItem("be-stable-data@u42", "chiffré");
    store.setItem("bs-nuage-base:be-stable-data@u42", "base");
    store.setItem("be-stable-data@u7", "un autre compte");
    store.setItem("be-stable-data@locale", "l'essai");
  });

  it("la demande a un sujet clair et de quoi retrouver le compte, sans chiffre de l'écurie", () => {
    const d = sup.demandeSuppression(compte, { ...autour, ecurie: "Les Tilleuls" });
    expect(d.sujet).toBe("Suppression du compte");
    expect(d.message.split("\n")[0]).toBe("Suppression du compte");
    expect(d.message).toContain("Compte n° 42");
    expect(d.message).toContain("E-mail : lea@ecurie.fr");
    expect(d.message).toContain("Nom : Léa Martin");
    expect(d.message).toContain("Écurie : Les Tilleuls");
    expect(d).toMatchObject(autour);
    expect(d.message).not.toMatch(/\u2014/);
  });

  it("partie : l'écurie de ce compte est effacée de l'appareil et le compte déconnecté", async () => {
    let parti = false;
    let deco = false;
    const r = await sup.demanderLaSuppression(compte, async () => (parti = true), { deconnexion: async () => (deco = true) });
    expect(r.issue).toBe("demandee");
    expect(parti && deco).toBe(true);
    expect(getSession()).toBeNull();
    expect(store.getItem("be-stable-data@u42")).toBeNull();
    expect(store.getItem("bs-nuage-base:be-stable-data@u42")).toBeNull();
    // Rien d'autre ne bouge : un autre compte, l'essai sans compte.
    expect(store.getItem("be-stable-data@u7")).toBe("un autre compte");
    expect(store.getItem("be-stable-data@locale")).toBe("l'essai");
    expect(sup.MESSAGE_SUPPRESSION_FAITE).toBe("C’est demandé. Ton compte et ta copie en ligne seront supprimés sous 30 jours ; tu recevras un e-mail.");
  });

  it("sans la route (404) : repli par contact@bestable.fr, rien n'est effacé", async () => {
    const r = await sup.demanderLaSuppression(compte, async () => {
      throw new ApiError("rest_no_route", "Aucune route", 404);
    });
    expect(r.issue).toBe("repli");
    expect(getSession()).not.toBeNull();
    expect(store.getItem("be-stable-data@u42")).toBe("chiffré");
    const lien = sup.mailtoSuppression(compte);
    expect(lien.startsWith("mailto:contact@bestable.fr?subject=Suppression%20du%20compte&body=")).toBe(true);
    expect(decodeURIComponent(lien)).toContain("Compte n° 42");
  });

  it("pas partie (hors ligne) : rien n'est effacé, on peut réessayer", async () => {
    const r = await sup.demanderLaSuppression(compte, async () => {
      throw new ApiError("hors_ligne", "Impossible de joindre bestable.fr.");
    });
    expect(r).toEqual({ issue: "erreur", message: "Impossible de joindre bestable.fr." });
    expect(getSession()).not.toBeNull();
    expect(store.getItem("be-stable-data@u42")).toBe("chiffré");
  });

  it("la sauvegarde proposée d'abord le dit : le fichier n'est pas protégé", () => {
    expect(SAUVEGARDE_NON_PROTEGEE).toBe("Ce fichier n’est pas protégé : range-le en lieu sûr.");
  });
});
