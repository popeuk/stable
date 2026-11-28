import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const g = globalThis as unknown as { localStorage: Mem; window: object; fetch: typeof fetch };
g.localStorage = new Mem();
g.window = globalThis;

// Le serveur « tiroirs » : rend un canal dans son GET.
const serveur = { canal: "ecurie-0123456789abcdef01234567" as unknown, rev: 0, gets: 0 };
g.fetch = (async (_url: string, init: RequestInit) => {
  const rep = (status: number, body: unknown) => ({ status, json: async () => body }) as Response;
  if (init.method === "GET") serveur.gets++;
  if (init.method === "GET") return rep(200, { tiroirs: [], formats: ["bs-clair2:"], canal: serveur.canal });
  return rep(200, { rev: ++serveur.rev });
}) as unknown as typeof fetch;

const { vault } = await import("@/lib/account/vault");
const { setSession, clearSession } = await import("@/lib/account/session");
const nuage = await import("@/lib/account/nuage");
const { ecouterCanal, brancherCanal, canalBranche, freiner, lireMessage } = await import("@/lib/account/canal");
void vault;

const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = { kind: "compte" as const, userId: 7, email: "g@x.fr", prenom: "Claire", token: "t", dataKey: cle, at: "" };

/** Un faux client Realtime : garde les abonnements, `emettre` diffuse à ceux qui écoutent encore. */
function fauxClient() {
  const abonnes: { nom: string; rappel: (m: { payload?: unknown }) => void; ouvert: boolean; etat: (e: string) => void }[] = [];
  return {
    abonnes,
    channel(nom: string) {
      const a = { nom, rappel: (() => {}) as (m: { payload?: unknown }) => void, ouvert: false, etat: (() => {}) as (e: string) => void };
      abonnes.push(a);
      return {
        on(_type: "broadcast", _f: { event: string }, rappel: (m: { payload?: unknown }) => void) {
          a.rappel = rappel;
          return this;
        },
        subscribe(etat?: (e: string) => void) {
          a.ouvert = true;
          if (etat) a.etat = etat;
          return this;
        },
        unsubscribe() {
          a.ouvert = false;
          return Promise.resolve("ok");
        },
      };
    },
    emettre(payload: unknown, nom?: string) {
      for (const a of abonnes) if (a.ouvert && (!nom || a.nom === nom)) a.rappel({ payload });
    },
    /** Le serveur Realtime dit où en est l'abonnement (SUBSCRIBED à chaque (re)connexion). */
    etat(e: string) {
      for (const a of abonnes) a.etat(e);
    },
    ouverts() {
      return abonnes.filter((a) => a.ouvert).map((a) => a.nom);
    },
  };
}
let faux = fauxClient();

beforeEach(() => {
  g.localStorage = new Mem();
  nuage._reinitialiser();
  setSession(compte);
  faux = fauxClient();
  serveur.canal = "ecurie-0123456789abcdef01234567";
});
afterEach(() => {
  brancherCanal(null, () => {});
  vi.useRealTimers();
});

describe("ecouterCanal", () => {
  it("prévient sur une écriture d'un autre appareil", () => {
    const vu: string[] = [];
    const stop = ecouterCanal("ecurie-x", (m) => vu.push(m.nom), faux);
    faux.emettre({ nom: "be-stable-data", rev: 4, appareil: "autre" });
    expect(vu).toEqual(["be-stable-data"]);
    stop();
  });

  it("ignore ce que cet appareil vient d'envoyer", () => {
    const vu: string[] = [];
    const stop = ecouterCanal("ecurie-x", (m) => vu.push(m.nom), faux);
    faux.emettre({ nom: "be-stable-data", rev: 4, appareil: nuage.appareil() });
    expect(vu).toEqual([]);
    stop();
  });

  it("se désabonne proprement", () => {
    const vu: string[] = [];
    const stop = ecouterCanal("ecurie-x", (m) => vu.push(m.nom), faux);
    stop();
    faux.emettre({ nom: "be-stable-data", rev: 4, appareil: "autre" });
    expect(vu).toEqual([]);
    expect(faux.ouverts()).toEqual([]);
    stop(); // deux fois : rien ne casse
  });

  it("ignore une version déjà connue de ce tiroir (inférieure ou égale)", () => {
    localStorage.setItem("bs-nuage@u7", JSON.stringify({ "be-stable-data": { rev: 5, vu: true } }));
    expect(nuage.revConnue("be-stable-data")).toBe(5);
    const vu: number[] = [];
    const stop = ecouterCanal("ecurie-x", (m) => vu.push(m.rev), faux);
    faux.emettre({ nom: "be-stable-data", rev: 4, appareil: "autre" });
    faux.emettre({ nom: "be-stable-data", rev: 5, appareil: "autre" });
    faux.emettre({ nom: "be-stable-data", rev: 6, appareil: "autre" });
    faux.emettre({ nom: "be-stable-settings", rev: 1, appareil: "autre" });
    expect(vu).toEqual([6, 1]);
    stop();
  });

  it("ignore sans lever un message mal formé", () => {
    const vu: unknown[] = [];
    const stop = ecouterCanal("ecurie-x", (m) => vu.push(m), faux);
    const mauvais: unknown[] = [
      undefined,
      null,
      "texte",
      42,
      {},
      { nom: "autre-tiroir", rev: 3, appareil: "a" },
      { nom: "be-stable-data", rev: "3", appareil: "a" },
      { nom: "be-stable-data", rev: 0, appareil: "a" },
      { nom: "be-stable-data", rev: -2, appareil: "a" },
      { nom: "be-stable-data", rev: 2.5, appareil: "a" },
      { nom: "be-stable-data", rev: Number.NaN, appareil: "a" },
      { nom: "be-stable-data", rev: 3 },
      { nom: "be-stable-data", rev: 3, appareil: null },
      { nom: "be-stable-data", rev: 3, appareil: 12 },
    ];
    expect(() => mauvais.forEach((p) => faux.emettre(p))).not.toThrow();
    expect(vu).toEqual([]);
    expect(lireMessage({ nom: "be-stable-settings", rev: 2, appareil: "a" })).toEqual({ nom: "be-stable-settings", rev: 2, appareil: "a" });
    stop();
  });
});

describe("reprise après une coupure", () => {
  it("relit à chaque SUBSCRIBED sauf le premier, rien après la fermeture", () => {
    let reprises = 0;
    const stop = ecouterCanal("ecurie-x", () => {}, faux, () => reprises++);
    faux.etat("SUBSCRIBED");
    expect(reprises).toBe(0);
    faux.etat("CHANNEL_ERROR");
    faux.etat("TIMED_OUT");
    expect(reprises).toBe(0);
    faux.etat("SUBSCRIBED");
    expect(reprises).toBe(1);
    faux.etat("SUBSCRIBED");
    expect(reprises).toBe(2);
    stop();
    faux.etat("SUBSCRIBED");
    expect(reprises).toBe(2);
  });

  it("brancherCanal passe la reprise", () => {
    let reprises = 0;
    brancherCanal("ecurie-a", () => {}, faux, () => reprises++);
    faux.etat("SUBSCRIBED");
    faux.etat("SUBSCRIBED");
    expect(reprises).toBe(1);
  });
});

describe("relecture demandée pendant une lecture", () => {
  it("attend la lecture en cours puis relit une fois de plus", async () => {
    await nuage.synchroniser();
    serveur.gets = 0;
    const premiere = nuage.synchroniser();
    const seconde = nuage.synchroniser();
    await Promise.all([premiere, seconde]);
    // Sans attente : la seconde se fond dans la première.
    expect(serveur.gets).toBe(1);
    serveur.gets = 0;
    const lecture = nuage.synchroniser();
    const canal = nuage.synchroniser(true);
    await Promise.all([lecture, canal]);
    expect(serveur.gets).toBe(2);
  });
});

describe("freiner", () => {
  it("dix messages d'affilée ne donnent qu'une ou deux relectures", async () => {
    vi.useFakeTimers();
    let relectures = 0;
    let enCours = 0;
    let auPlus = 0;
    const frein = freiner(async () => {
      relectures++;
      enCours++;
      auPlus = Math.max(auPlus, enCours);
      await new Promise((r) => setTimeout(r, 300));
      enCours--;
    }, 2000);
    const stop = ecouterCanal("ecurie-x", () => frein.demander(), faux);
    for (let i = 1; i <= 10; i++) faux.emettre({ nom: "be-stable-data", rev: i, appareil: "autre" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(relectures).toBeGreaterThanOrEqual(1);
    expect(relectures).toBeLessThanOrEqual(2);
    expect(auPlus).toBe(1);
    stop();
    frein.arreter();
  });

  it("laisse au moins 2 secondes entre deux départs", async () => {
    vi.useFakeTimers();
    const departs: number[] = [];
    const frein = freiner(async () => void departs.push(Date.now()), 2000);
    frein.demander();
    await vi.advanceTimersByTimeAsync(10);
    frein.demander();
    frein.demander();
    await vi.advanceTimersByTimeAsync(1000);
    expect(departs.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1500);
    expect(departs.length).toBe(2);
    expect(departs[1] - departs[0]).toBeGreaterThanOrEqual(2000);
    frein.arreter();
    frein.demander();
    await vi.advanceTimersByTimeAsync(5000);
    expect(departs.length).toBe(2);
  });
});

describe("canal de l'écurie et abonnement unique", () => {
  it("garde le canal reçu du GET", async () => {
    expect(nuage.canalDeLEcurie()).toBeNull();
    await nuage.synchroniser();
    expect(nuage.canalDeLEcurie()).toBe("ecurie-0123456789abcdef01234567");
  });

  it("refuse un canal mal formé", async () => {
    serveur.canal = "ecurie-../../autre";
    await nuage.synchroniser();
    expect(nuage.canalDeLEcurie()).toBeNull();
  });

  it("aucun canal sans copie en ligne, ni pour une autre session", async () => {
    await nuage.synchroniser();
    localStorage.setItem("bs-nuage", "0");
    expect(nuage.canalDeLEcurie()).toBeNull();
    localStorage.removeItem("bs-nuage");
    setSession({ ...compte, espace: { id: 3, nom: "Les Prés", gerant: "Marc", dataKey: cle } });
    expect(nuage.canalDeLEcurie()).toBeNull();
    clearSession();
    expect(nuage.canalDeLEcurie()).toBeNull();
  });

  it("aucun canal sur un téléphone trop ancien", async () => {
    const avant = globalThis.CompressionStream;
    await nuage.synchroniser();
    (globalThis as { CompressionStream?: unknown }).CompressionStream = undefined;
    try {
      expect(nuage.navigateurTropAncien()).toBe(true);
      expect(nuage.canalDeLEcurie()).toBeNull();
    } finally {
      (globalThis as { CompressionStream?: unknown }).CompressionStream = avant;
    }
  });

  it("ferme l'ancien abonnement avant d'ouvrir le nouveau, plus rien à la déconnexion", () => {
    const vu: string[] = [];
    brancherCanal("ecurie-a", (m) => vu.push(`a${m.rev}`), faux);
    brancherCanal("ecurie-a", (m) => vu.push(`a${m.rev}`), faux); // même canal : rien ne change
    expect(faux.ouverts()).toEqual(["ecurie-a"]);
    brancherCanal("ecurie-b", (m) => vu.push(`b${m.rev}`), faux);
    expect(faux.ouverts()).toEqual(["ecurie-b"]);
    faux.emettre({ nom: "be-stable-data", rev: 1, appareil: "autre" });
    expect(vu).toEqual(["b1"]);
    brancherCanal(null, () => {}, faux);
    expect(canalBranche()).toBeNull();
    expect(faux.ouverts()).toEqual([]);
    faux.emettre({ nom: "be-stable-data", rev: 2, appareil: "autre" });
    expect(vu).toEqual(["b1"]);
  });
});

describe("envoi en équipe", () => {
  it("part au bout de 800 ms en équipe, 4 s seul", async () => {
    const { vault } = await import("@/lib/account/vault");
    const essai = async (session: typeof compte & { avecEquipe?: boolean }) => {
      g.localStorage = new Mem();
      nuage._reinitialiser();
      setSession(session);
      await nuage.synchroniser();
      const espion = vi.spyOn(globalThis, "setTimeout");
      await vault.setItem("be-stable-settings", JSON.stringify({ state: { n: Math.random() }, version: 0 }));
      await nuage.notesFaites();
      const delais = espion.mock.calls.map((c) => c[1]);
      espion.mockRestore();
      return delais;
    };
    expect(await essai({ ...compte, avecEquipe: true })).toContain(800);
    const seul = await essai(compte);
    expect(seul).toContain(4000);
    expect(seul).not.toContain(800);
  });
});
