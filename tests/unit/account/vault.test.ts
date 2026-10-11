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
(globalThis as unknown as { localStorage: Mem; window: object }).localStorage = store;
(globalThis as unknown as { window: object }).window = globalThis;

const { vault, adoptLegacy } = await import("@/lib/account/vault");
const { setSession, clearSession } = await import("@/lib/account/session");

const key = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = (userId: number, dataKey: string) => ({ kind: "compte" as const, userId, email: `${userId}@x.fr`, prenom: "A", token: "t", dataKey, at: "" });

describe("le coffre des comptes", () => {
  beforeEach(() => {
    store.m.clear();
    clearSession();
  });

  it("chiffre les données d'un compte et les relit avec sa clé", async () => {
    const k = key();
    setSession(compte(1, k));
    await vault.setItem("be-stable-data", '{"state":{"horses":["Sirius"]}}');
    const brut = store.getItem("be-stable-data@u1")!;
    expect(brut.startsWith("bs-enc1:")).toBe(true);
    expect(brut).not.toContain("Sirius");
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":["Sirius"]}}');
  });

  it("un autre compte ne lit rien, même avec le tiroir du premier sous les yeux", async () => {
    setSession(compte(1, key()));
    await vault.setItem("be-stable-data", '{"secret":1}');
    // Le compte 2 tente de lire le tiroir du compte 1 avec sa propre clé.
    store.setItem("be-stable-data@u2", store.getItem("be-stable-data@u1")!);
    setSession(compte(2, key()));
    expect(await vault.getItem("be-stable-data")).toBeNull();
  });

  it("sans session, rien ne se lit ni ne s'écrit", async () => {
    setSession(compte(1, key()));
    await vault.setItem("be-stable-data", '{"x":1}');
    clearSession();
    expect(await vault.getItem("be-stable-data")).toBeNull();
    await vault.setItem("be-stable-data", '{"y":2}');
    expect(store.getItem("be-stable-data")).toBeNull();
  });

  it("la démo a son propre tiroir, en clair", async () => {
    setSession({ kind: "demo" });
    await vault.setItem("be-stable-data", '{"demo":true}');
    expect(store.getItem("be-stable-data@demo")).toBe('{"demo":true}');
  });

  it("les données d'avant les comptes passent dans le tiroir chiffré et disparaissent en clair", async () => {
    store.setItem("be-stable-data", '{"ancien":true}');
    const k = key();
    setSession(compte(7, k));
    expect(await adoptLegacy()).toBe(true);
    expect(store.getItem("be-stable-data")).toBeNull();
    expect(await vault.getItem("be-stable-data")).toBe('{"ancien":true}');
  });
});
