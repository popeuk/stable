import { beforeEach, describe, expect, it } from "vitest";

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

// Le serveur « tiroirs », tel que la fonction Supabase le fait.
interface Ligne {
  rev: number;
  contenu: string;
  modifie: string;
}
const serveur = { tiroirs: new Map<string, Ligne>(), versions: [] as { nom: string; contenu: string; raison: string }[], appels: 0 };
g.fetch = (async (_url: string, init: RequestInit) => {
  serveur.appels++;
  const rep = (status: number, body: unknown) => ({ status, json: async () => body }) as Response;
  if (init.method === "GET") return rep(200, { tiroirs: [...serveur.tiroirs].map(([nom, l]) => ({ nom, ...l })) });
  const b = JSON.parse(String(init.body)) as { nom: string; contenu: string; rev: number; modifie: string; garder?: boolean };
  if (init.method === "POST") {
    serveur.versions.push({ nom: b.nom, contenu: b.contenu, raison: "conflit" });
    return rep(200, { ok: true });
  }
  const cur = serveur.tiroirs.get(b.nom);
  if ((cur?.rev ?? 0) !== b.rev) return rep(409, { tiroir: cur ? { nom: b.nom, ...cur } : null });
  if (cur) serveur.versions.push({ nom: b.nom, contenu: cur.contenu, raison: "remplacee" });
  serveur.tiroirs.set(b.nom, { rev: b.rev + 1, contenu: b.contenu, modifie: b.modifie });
  return rep(200, { rev: b.rev + 1 });
}) as unknown as typeof fetch;

const { vault } = await import("@/lib/account/vault");
const { setSession } = await import("@/lib/account/session");
const nuage = await import("@/lib/account/nuage");

const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = { kind: "compte" as const, userId: 7, email: "g@x.fr", prenom: "Claire", token: "t", dataKey: cle, at: "" };

/** Un appareil : son propre stockage, la même session, la copie en ligne allumée. */
function appareil() {
  const m = new Mem();
  return {
    m,
    entrer() {
      g.localStorage = m;
      nuage._reinitialiser();
      setSession(compte);
      m.setItem("bs-nuage", "1");
    },
  };
}
const attendre = () => new Promise((r) => setTimeout(r, 0));
const donnees = (horses: string[], invoices: { id: string; year: number; seq: number }[] = []) => JSON.stringify({ state: { horses, invoices, invoiceSeq: {} }, version: 5 });
const lire = async () => JSON.parse((await vault.getItem("be-stable-data")) as string).state;

describe("la copie en ligne des tiroirs", () => {
  beforeEach(() => {
    serveur.tiroirs.clear();
    serveur.versions = [];
    serveur.appels = 0;
  });

  it("un téléphone neuf retrouve les chevaux de l'ordinateur", async () => {
    const pc = appareil();
    pc.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(1);
    // Le serveur ne garde que du chiffré.
    expect(serveur.tiroirs.get("be-stable-data")?.contenu).not.toContain("Sirius");

    const tel = appareil();
    tel.entrer();
    const changes = await nuage.synchroniser();
    expect(changes.has("be-stable-data")).toBe(true);
    expect((await lire()).horses).toEqual(["Sirius"]);
  });

  it("rien ne part avant la première lecture du serveur", async () => {
    const tel = appareil();
    tel.entrer();
    await vault.setItem("be-stable-data", donnees([]));
    await attendre();
    await nuage.envoyer();
    expect(serveur.appels).toBe(0);
  });

  it("un appareil neuf ne remplace jamais la copie en ligne, et sa version est gardée", async () => {
    const pc = appareil();
    pc.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();

    const tel = appareil();
    tel.entrer();
    // L'app ouverte écrit une écurie vide avant d'avoir lu le serveur.
    await vault.setItem("be-stable-data", donnees([]));
    await attendre();
    await nuage.synchroniser();
    expect((await lire()).horses).toEqual(["Sirius", "Opale"]);
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(1);
    expect(serveur.versions.some((v) => v.raison === "conflit")).toBe(true);
  });

  it("deux appareils modifiés hors ligne : le plus récent gagne, l'autre version reste au serveur", async () => {
    const pc = appareil();
    const tel = appareil();
    pc.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    tel.entrer();
    await nuage.synchroniser();

    // Hors ligne : le PC modifie d'abord, le téléphone ensuite.
    pc.entrer();
    nuage._reinitialiser();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius", "Opale"]));
    await attendre();
    await new Promise((r) => setTimeout(r, 5));
    tel.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius", "Tango"]));
    await attendre();

    pc.entrer();
    await nuage.synchroniser();
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(2);

    tel.entrer();
    await nuage.synchroniser();
    expect((await lire()).horses).toEqual(["Sirius", "Tango"]);
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(3);
    expect(serveur.versions.length).toBeGreaterThan(0);

    pc.entrer();
    await nuage.synchroniser();
    expect((await lire()).horses).toEqual(["Sirius", "Tango"]);
  });

  it("les factures faites des deux côtés sont toutes gardées", async () => {
    const pc = appareil();
    const tel = appareil();
    pc.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    tel.entrer();
    await nuage.synchroniser();

    pc.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius"], [{ id: "f-pc", year: 2026, seq: 1 }]));
    await attendre();
    await new Promise((r) => setTimeout(r, 5));
    tel.entrer();
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius"], [{ id: "f-tel", year: 2026, seq: 2 }]));
    await attendre();

    pc.entrer();
    await nuage.synchroniser();
    tel.entrer();
    await nuage.synchroniser();
    const st = await lire();
    expect(st.invoices.map((i: { id: string }) => i.id).sort()).toEqual(["f-pc", "f-tel"]);
    expect(st.invoiceSeq).toEqual({ "2026": 2 });
  });

  it("éteinte, la copie en ligne ne contacte pas le serveur", async () => {
    const pc = appareil();
    pc.entrer();
    pc.m.removeItem("bs-nuage");
    await nuage.synchroniser();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    expect(serveur.appels).toBe(0);
  });
});
