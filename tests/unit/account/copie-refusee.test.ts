import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Un localStorage minimal par appareil, comme dans le navigateur.
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

// La fonction « tiroirs », avec ses refus : trop gros (413), mal formé (400).
const serveur = {
  tiroirs: new Map<string, { rev: number; contenu: string; modifie: string }>(),
  puts: [] as string[],
  max: 2_000_000,
  /** Les formats que le serveur annonce et accepte. */
  formats: ["bs-enc1:"] as string[],
};
g.fetch = (async (_url: string, init: RequestInit) => {
  const rep = (status: number, body: unknown) => ({ status, json: async () => body }) as Response;
  if (init.method === "GET") return rep(200, { tiroirs: [...serveur.tiroirs].map(([nom, l]) => ({ nom, ...l })), formats: serveur.formats });
  const b = JSON.parse(String(init.body)) as { nom: string; contenu: string; rev: number; modifie: string };
  if (init.method === "PUT") serveur.puts.push(b.contenu);
  if (b.contenu.length > serveur.max) return rep(413, { code: "trop_gros" });
  if (!serveur.formats.some((p) => b.contenu.startsWith(p))) return rep(400, { code: "invalide" });
  if (init.method === "POST") return rep(200, { ok: true });
  const cur = serveur.tiroirs.get(b.nom);
  if ((cur?.rev ?? 0) !== b.rev) return rep(409, { tiroir: cur ? { nom: b.nom, ...cur } : null });
  serveur.tiroirs.set(b.nom, { rev: b.rev + 1, contenu: b.contenu, modifie: b.modifie });
  return rep(200, { rev: b.rev + 1 });
}) as unknown as typeof fetch;

const { vault, _seuilCompression, SEUIL_COMPRESSION } = await import("@/lib/account/vault");
const { setSession } = await import("@/lib/account/session");
const nuage = await import("@/lib/account/nuage");
const { texteCopie } = await import("@/lib/account/etat-copie");
const { contenuChiffre } = await import("@/supabase/functions/tiroirs/regles");

const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = { kind: "compte" as const, userId: 7, email: "g@x.fr", prenom: "Claire", token: "t", dataKey: cle, at: "" };
function appareil() {
  const m = new Mem();
  return {
    m,
    entrer() {
      g.localStorage = m;
      nuage._reinitialiser();
      setSession(compte);
    },
  };
}
const sync = async () => {
  const c = await nuage.synchroniser();
  for (const n of nuage.TIROIRS) await vault.getItem(n);
  return c;
};
/** Des données qui se compressent bien : beaucoup de séances qui se ressemblent. */
const donnees = (n: number) => JSON.stringify({ state: { horses: [], seances: Array.from({ length: n }, (_, i) => ({ id: `s-${i}`, date: "2026-10-19", label: "Cours collectif", payer: "Hugo L.", amount: 25 })), invoices: [], invoiceSeq: {} }, version: 5 });
const ecrire = async (n: number) => {
  await vault.setItem("be-stable-data", donnees(n));
  await nuage.notesFaites();
};

describe("la copie en ligne refusée par le serveur", () => {
  beforeEach(() => {
    serveur.tiroirs.clear();
    serveur.puts = [];
    serveur.max = 2_000_000;
    serveur.formats = ["bs-enc1:"];
  });

  it("trop grosse : Mon compte le dit, et on ne renvoie plus pour rien", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    serveur.max = 1000;
    await ecrire(200);
    await nuage.envoyer();
    expect(nuage.etatNuage().refus).toBe("trop_gros");
    expect(nuage.refusCopie()).toBe("trop_gros");
    expect(texteCopie(nuage.etatNuage())).toBe("Ta copie en ligne ne part plus : ton écurie est trop grosse. Fais une sauvegarde.");
    const avant = serveur.puts.length;
    // Plus de séances : toujours trop gros, rien ne repart.
    await ecrire(220);
    await nuage.envoyer();
    expect(serveur.puts.length).toBe(avant);
    // L'écurie a rapetissé (une année retirée) et le serveur l'accepte : la copie repart, le refus s'en va.
    serveur.max = 2_000_000;
    await ecrire(1);
    await nuage.envoyer();
    expect(serveur.puts.length).toBe(avant + 1);
    expect(nuage.refusCopie()).toBeNull();
    expect(nuage.etatNuage().attente).toBe(false);
  });

  it("mal formée (400) : dite aussi, sans nouvel essai dans la journée", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    serveur.formats = ["bs-autre:"];
    await ecrire(3);
    await nuage.envoyer();
    expect(nuage.refusCopie()).toBe("invalide");
    expect(texteCopie(nuage.etatNuage())).toBe("Ta copie en ligne ne part plus. Fais une sauvegarde et écris-nous.");
    const avant = serveur.puts.length;
    await nuage.envoyer();
    expect(serveur.puts.length).toBe(avant);
  });

  it("le refus tient tant que rien n'a changé : trop gros jusqu'à ce qu'il rapetisse, mal formé un jour", () => {
    const t0 = Date.parse("2026-10-19T10:00:00Z");
    const gros = { code: "trop_gros" as const, taille: 100, prefixe: "bs-enc1:", quand: new Date(t0).toISOString() };
    expect(nuage.refusTient(gros, "x".repeat(100), t0)).toBe(true);
    expect(nuage.refusTient(gros, "x".repeat(99), t0)).toBe(false);
    const mal = { code: "invalide" as const, taille: 10, prefixe: "bs-enc1:", quand: new Date(t0).toISOString() };
    expect(nuage.refusTient(mal, "bs-enc1:abc", t0 + 3600_000)).toBe(true);
    expect(nuage.refusTient(mal, "bs-enc1:abc", t0 + 25 * 3600_000)).toBe(false);
    expect(nuage.refusTient(mal, "bs-enc2:abc", t0)).toBe(false);
    expect(nuage.refusTient(undefined, "x")).toBe(false);
  });
});

describe("la copie compressée avant d'être chiffrée", () => {
  beforeEach(() => {
    serveur.tiroirs.clear();
    serveur.puts = [];
    serveur.max = 2_000_000;
    // Ici, des écuries de quelques kilo-octets passent pour grosses.
    _seuilCompression(1000);
  });
  afterEach(() => _seuilCompression());

  it("la fonction tiroirs accepte le nouveau préfixe et garde l'ancien", () => {
    expect(contenuChiffre("bs-enc2:iv.ct")).toBe(true);
    expect(contenuChiffre("bs-enc1:iv.ct")).toBe(true);
    expect(contenuChiffre("bs-enc2:")).toBe(false);
    expect(contenuChiffre('{"state":{}}')).toBe(false);
  });

  it("tant que le serveur ne l'annonce pas, rien ne part compressé", async () => {
    serveur.formats = ["bs-enc1:"];
    const pc = appareil();
    pc.entrer();
    await sync();
    await ecrire(50);
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")?.contenu.startsWith("bs-enc1:")).toBe(true);
  });

  it("annoncé : l'envoi est 5 fois plus petit au moins, et l'autre appareil le relit", async () => {
    serveur.formats = ["bs-enc1:", "bs-enc2:"];
    const pc = appareil();
    pc.entrer();
    await sync();
    await ecrire(500);
    await nuage.envoyer();
    const envoye = serveur.tiroirs.get("be-stable-data")!.contenu;
    expect(envoye.startsWith("bs-enc2:")).toBe(true);
    expect(envoye).not.toContain("Hugo");
    // Sans compression, le même contenu chiffré ferait au moins 4/3 de sa taille en clair.
    expect(envoye.length * 5).toBeLessThan(donnees(500).length);
    const tel = appareil();
    tel.entrer();
    await sync();
    expect(JSON.parse((await vault.getItem("be-stable-data")) as string).state.seances).toHaveLength(500);
  });

  it("une écurie qui dépassait la limite repart, compressée", async () => {
    serveur.formats = ["bs-enc1:", "bs-enc2:"];
    serveur.max = 20_000;
    const pc = appareil();
    pc.entrer();
    await sync();
    expect(donnees(400).length).toBeGreaterThan(serveur.max);
    await ecrire(400);
    await nuage.envoyer();
    expect(nuage.refusCopie()).toBeNull();
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(1);
  });

  it("un serveur revenu à l'ancienne fonction : l'envoi repart dans l'ancien format", async () => {
    serveur.formats = ["bs-enc1:", "bs-enc2:"];
    const pc = appareil();
    pc.entrer();
    await sync();
    await ecrire(20);
    expect([...pc.m.m.values()].some((v) => v.startsWith("bs-enc2:"))).toBe(true);
    // La fonction est remise à l'ancienne version, avant que l'appareil le sache.
    serveur.formats = ["bs-enc1:"];
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")?.contenu.startsWith("bs-enc1:")).toBe(true);
    expect(nuage.refusCopie()).toBeNull();
    const tel = appareil();
    tel.entrer();
    await sync();
    expect(JSON.parse((await vault.getItem("be-stable-data")) as string).state.seances).toHaveLength(20);
  });
});

describe("compresser seulement quand c'est gros (les anciennes versions ne lisent que bs-enc1)", () => {
  beforeEach(() => {
    serveur.tiroirs.clear();
    serveur.puts = [];
    serveur.max = 4_000_000;
    serveur.formats = ["bs-enc1:", "bs-enc2:"];
  });

  it("annoncé par le serveur, mais sous 1,5 Mo : l'ancien format, sur l'appareil et en ligne", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    await ecrire(500);
    expect([...pc.m.m.values()].some((v) => v.startsWith("bs-enc2:"))).toBe(false);
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")?.contenu.startsWith("bs-enc1:")).toBe(true);
  });

  it("au-delà de 1,5 Mo : compressé", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    const n = Math.ceil(SEUIL_COMPRESSION / 90);
    expect(donnees(n).length).toBeGreaterThan(SEUIL_COMPRESSION);
    await ecrire(n);
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")?.contenu.startsWith("bs-enc2:")).toBe(true);
  });
});
