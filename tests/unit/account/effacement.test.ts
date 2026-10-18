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

const { vault } = await import("@/lib/account/vault");
const { setSession, clearSession } = await import("@/lib/account/session");
const { _reinitialiser } = await import("@/lib/account/nuage");
const eff = await import("@/lib/account/effacement");

const key = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = (dataKey: string) => ({ kind: "compte" as const, userId: 5, email: "g@x.fr", prenom: "G", token: "t", dataKey, at: "" });

describe("effacer mon écurie partout, récupérable 7 jours", () => {
  beforeEach(() => {
    store.m.clear();
    clearSession();
    _reinitialiser();
  });

  it("met l'écurie de côté avant d'effacer, puis la remet et la marque à envoyer en ligne", async () => {
    setSession(compte(key()));
    await vault.setItem("be-stable-data", '{"state":{"horses":["Sirius"]}}');
    await vault.setItem("be-stable-settings", '{"state":{"stableName":"Le Clos"}}');
    expect(await eff.mettreDeCote()).toBe(true);
    // La copie mise de côté reste chiffrée.
    expect(store.getItem("bs-avant-effacement@u5")).not.toContain("Sirius");
    expect(eff.ecurieEffacee()).not.toBeNull();

    // L'effacement : l'écurie vide est écrite.
    await vault.setItem("be-stable-data", '{"state":{"horses":[]}}');
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":[]}}');

    expect(await eff.recupererEcurie()).toBe(true);
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":["Sirius"]}}');
    expect(await vault.getItem("be-stable-settings")).toBe('{"state":{"stableName":"Le Clos"}}');
    // À envoyer dans la copie en ligne.
    const etat = JSON.parse(store.getItem("bs-nuage@u5")!) as Record<string, { sale?: boolean }>;
    expect(etat["be-stable-data"].sale).toBe(true);
    // Une seule fois : la ligne disparaît.
    expect(eff.ecurieEffacee()).toBeNull();
    _reinitialiser();
  });

  it("au-delà de 7 jours, l'écurie d'avant n'est plus proposée et la copie s'en va", async () => {
    setSession(compte(key()));
    await vault.setItem("be-stable-data", '{"state":{"horses":["A"]}}');
    const il_y_a_8_jours = new Date(Date.now() - 8 * 86_400_000);
    await eff.mettreDeCote(il_y_a_8_jours);
    expect(eff.ecurieEffacee()).toBeNull();
    expect(store.getItem("bs-avant-effacement@u5")).toBeNull();
    expect(await eff.recupererEcurie()).toBe(false);
  });

  it("sans compte, rien n'est mis de côté (l'essai s'efface pour de bon)", async () => {
    setSession({ kind: "locale", at: "x" });
    await vault.setItem("be-stable-data", '{"state":{}}');
    expect(await eff.mettreDeCote()).toBe(false);
    expect(eff.ecurieEffacee()).toBeNull();
  });

  it("la fenêtre de 7 jours", () => {
    const t = Date.parse("2026-10-19T10:00:00Z");
    expect(eff.encoreRecuperable("2026-10-19T09:00:00Z", t)).toBe(true);
    expect(eff.encoreRecuperable("2026-10-12T11:00:00Z", t)).toBe(true);
    expect(eff.encoreRecuperable("2026-10-12T09:00:00Z", t)).toBe(false);
    expect(eff.encoreRecuperable("n'importe quoi", t)).toBe(false);
  });
});
