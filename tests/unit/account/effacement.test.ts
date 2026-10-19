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

  it("plus de place pour la copie de secours : mettreDeCote le dit (rien n'est promis)", async () => {
    setSession(compte(key()));
    await vault.setItem("be-stable-data", '{"state":{"horses":["A"]}}');
    const set = store.setItem.bind(store);
    store.setItem = (k: string, v: string) => {
      if (k.startsWith("bs-avant-effacement")) throw Object.assign(new Error("plein"), { name: "QuotaExceededError" });
      set(k, v);
    };
    try {
      expect(await eff.mettreDeCote()).toBe(false);
      expect(eff.ecurieEffacee()).toBeNull();
    } finally {
      store.setItem = set;
    }
  });

  it("une récupération qui manque de place ne laisse rien à moitié : l'écurie d'après reste, la copie aussi", async () => {
    setSession(compte(key()));
    await vault.setItem("be-stable-data", '{"state":{"horses":["Sirius"]}}');
    await vault.setItem("be-stable-settings", '{"state":{"stableName":"Le Clos"}}');
    expect(await eff.mettreDeCote()).toBe(true);
    await vault.setItem("be-stable-data", '{"state":{"horses":[]}}');
    await vault.setItem("be-stable-settings", '{"state":{"stableName":"Neuf"}}');
    const set = store.setItem.bind(store);
    store.setItem = (k: string, v: string) => {
      if (k.startsWith("be-stable-settings")) throw Object.assign(new Error("plein"), { name: "QuotaExceededError" });
      set(k, v);
    };
    try {
      expect(await eff.recupererEcurie()).toBe(false);
    } finally {
      store.setItem = set;
    }
    expect(await vault.getItem("be-stable-data")).toBe('{"state":{"horses":[]}}');
    expect(eff.ecurieEffacee()).not.toBeNull();
    _reinitialiser();
  });

  it("les factures et avoirs faits depuis l'effacement restent, et la suite des numéros ne recule pas", async () => {
    setSession(compte(key()));
    const fa = (id: string, seq: number, kind?: "avoir") => ({ id, number: `2026-000${seq}`, year: 2026, seq, payer: "Claire", month: "2026-10", revenueIds: [], ...(kind ? { kind } : {}) });
    await vault.setItem("be-stable-data", JSON.stringify({ state: { horses: ["Sirius"], invoices: [fa("a", 1)], invoiceSeq: { "2026": 1 } }, version: 5 }));
    expect(await eff.mettreDeCote()).toBe(true);
    // Après l'effacement, la 0002 et son avoir 0003.
    await vault.setItem("be-stable-data", JSON.stringify({ state: { horses: [], invoices: [fa("a", 1), fa("b", 2), fa("c", 3, "avoir")], invoiceSeq: { "2026": 3 } }, version: 5 }));
    expect(await eff.recupererEcurie()).toBe(true);
    const lu = JSON.parse((await vault.getItem("be-stable-data"))!) as { state: { horses: string[]; invoices: { number: string }[]; invoiceSeq: Record<string, number> }; version: number };
    expect(lu.state.horses).toEqual(["Sirius"]);
    expect(lu.state.invoices.map((i) => i.number)).toEqual(["2026-0001", "2026-0002", "2026-0003"]);
    expect(lu.state.invoiceSeq).toEqual({ "2026": 3 });
    expect(lu.version).toBe(5);
    _reinitialiser();
  });

  it("avecFacturesDepuis : rien de neuf, le texte reste tel quel", () => {
    const clair = '{"state":{"invoices":[{"id":"a","year":2026,"seq":1}],"invoiceSeq":{"2026":1}}}';
    expect(eff.avecFacturesDepuis(clair, { invoices: [], invoiceSeq: { "2026": 1 } })).toBe(clair);
    expect(eff.avecFacturesDepuis("pas du json", { invoices: [] })).toBe("pas du json");
    // Le compteur de l'appareil, plus haut, compte aussi.
    expect(JSON.parse(eff.avecFacturesDepuis(clair, { invoices: [] }, { "2026": 4 })).state.invoiceSeq).toEqual({ "2026": 4 });
  });

  it("la fenêtre de 7 jours", () => {
    const t = Date.parse("2026-10-19T10:00:00Z");
    expect(eff.encoreRecuperable("2026-10-19T09:00:00Z", t)).toBe(true);
    expect(eff.encoreRecuperable("2026-10-12T11:00:00Z", t)).toBe(true);
    expect(eff.encoreRecuperable("2026-10-12T09:00:00Z", t)).toBe(false);
    expect(eff.encoreRecuperable("n'importe quoi", t)).toBe(false);
  });
});
