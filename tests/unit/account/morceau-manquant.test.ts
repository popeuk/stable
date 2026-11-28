import { beforeEach, describe, expect, it, vi } from "vitest";

// Un morceau chargé à la demande qui ne se charge pas (404 après un déploiement, réseau coupé).
vi.mock("@/lib/account/format-clair", () => {
  throw new Error("Failed to load chunk");
});
vi.mock("@/lib/account/departager", () => {
  throw new Error("Failed to load chunk");
});
const erreurs = vi.hoisted(() => [] as unknown[][]);
vi.mock("@/lib/suivi-erreurs", () => ({ signalerErreur: async (...a: unknown[]) => (erreurs.push(a), true) }));

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
const g = globalThis as unknown as { localStorage: Mem; window: object; fetch: typeof fetch };
g.localStorage = new Mem();
g.window = globalThis;

const serveur = { tiroirs: [] as { nom: string; rev: number; contenu: string; modifie: string }[], puts: 0 };
g.fetch = (async (_url: string, init: RequestInit) => {
  const rep = (status: number, body: unknown) => ({ status, json: async () => body }) as Response;
  if (init.method === "GET") return rep(200, { tiroirs: serveur.tiroirs, formats: ["bs-clair2:"], canal: "ecurie-0123456789abcdef01234567" });
  serveur.puts++;
  return rep(200, { rev: 1 });
}) as unknown as typeof fetch;

const { vault } = await import("@/lib/account/vault");
const { setSession } = await import("@/lib/account/session");
const nuage = await import("@/lib/account/nuage");
const { etatNuage, texteCopie, TEXTE_RECHARGER } = await import("@/lib/account/etat-copie");

const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = { kind: "compte" as const, userId: 7, email: "g@x.fr", prenom: "Claire", token: "t", dataKey: cle, at: "" };

beforeEach(() => {
  g.localStorage = new Mem();
  nuage._reinitialiser();
  setSession(compte);
  erreurs.length = 0;
  serveur.tiroirs = [];
  serveur.puts = 0;
});

describe("un morceau qui ne se charge pas", () => {
  it("à l'envoi : ne dit pas « à jour », le signale, propose de recharger", async () => {
    await nuage.synchroniser();
    expect(nuage.morceauManquant()).toBe(false);
    let prevenu = 0;
    const off = nuage.ecouterRefus(() => prevenu++);
    await vault.setItem("be-stable-settings", JSON.stringify({ state: { a: 1 }, version: 0 }));
    await nuage.notesFaites();
    await nuage.envoyer();
    off();
    expect(serveur.puts).toBe(0);
    expect(nuage.morceauManquant()).toBe(true);
    expect(prevenu).toBe(1);
    const e = etatNuage();
    expect(e.derniere?.ok).toBe(false);
    expect(e.aJour).toBeNull();
    expect(e.recharger).toBe(true);
    expect(texteCopie(e)).toBe(TEXTE_RECHARGER);
    expect(erreurs.filter((a) => a[0] === "copie")).toHaveLength(1);
  });

  it("à la lecture : ne lève pas, ne touche à rien, ne dit pas « à jour »", async () => {
    await vault.setItem("be-stable-data", JSON.stringify({ state: { horses: [{ id: "1" }] }, version: 0 }));
    const avant = await vault.getItem("be-stable-data");
    serveur.tiroirs = [{ nom: "be-stable-data", rev: 3, contenu: "bs-clair2:AAAA", modifie: new Date().toISOString() }];
    await expect(nuage.synchroniser()).resolves.toEqual(new Set());
    expect(await vault.getItem("be-stable-data")).toBe(avant);
    expect(nuage.morceauManquant()).toBe(true);
    expect(etatNuage().aJour).toBeNull();
    expect(etatNuage().derniere?.ok).toBe(false);
    // Deux lectures, un seul signalement.
    await nuage.synchroniser();
    expect(erreurs.filter((a) => a[0] === "copie")).toHaveLength(1);
    // Avant un numéro de facture : « hors-ligne », comme sans réseau.
    await expect(nuage.relireAvantNumero()).resolves.toEqual({ etat: "hors-ligne", change: false });
  });
});
