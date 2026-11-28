import { beforeEach, describe, expect, it, vi } from "vitest";

// Le canal d'erreur (vers Samuel), observé sans rien envoyer.
const erreurs = vi.hoisted(() => [] as unknown[][]);
vi.mock("@/lib/suivi-erreurs", () => ({ signalerErreur: async (...a: unknown[]) => (erreurs.push(a), true) }));

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
const { depuisDistant } = await import("@/lib/account/format-clair");
const { etatNuage } = await import("@/lib/account/etat-copie");

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
      m.removeItem("bs-nuage");
    },
  };
}
const attendre = () => nuage.notesFaites();
/** Une synchronisation suivie de la relecture des tiroirs par l'écran, comme dans l'app. */
const sync = async () => {
  const c = await nuage.synchroniser();
  for (const n of nuage.TIROIRS) await vault.getItem(n);
  return c;
};
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
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(1);
    // Le serveur garde le contenu en clair, mais compressé : le nom n'y est pas lisible tel quel.
    expect(serveur.tiroirs.get("be-stable-data")?.contenu).not.toContain("Sirius");

    const tel = appareil();
    tel.entrer();
    const changes = await sync();
    expect(changes.has("be-stable-data")).toBe(true);
    expect((await lire()).horses).toEqual(["Sirius"]);
  });

  it("Mon compte voit les changements en attente, puis l'heure de la copie à jour", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", donnees(["A"]));
    await attendre();
    await vault.setItem("be-stable-data", donnees(["A", "B"]));
    await attendre();
    await vault.setItem("be-stable-settings", JSON.stringify({ state: { stableName: "X" } }));
    await attendre();
    const avant = etatNuage();
    expect(avant.attente).toBe(true);
    expect(avant.changements).toBe(3);
    await nuage.envoyer();
    const apres = etatNuage();
    expect(apres.attente).toBe(false);
    expect(apres.changements).toBe(0);
    expect(apres.aJour).not.toBeNull();
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
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();

    const tel = appareil();
    tel.entrer();
    // L'app ouverte écrit une écurie vide avant d'avoir lu le serveur.
    await vault.setItem("be-stable-data", donnees([]));
    await attendre();
    await sync();
    expect((await lire()).horses).toEqual(["Sirius", "Opale"]);
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(1);
    expect(serveur.versions.some((v) => v.raison === "conflit")).toBe(true);
  });

  it("deux appareils modifiés hors ligne : le plus récent gagne, l'autre version reste au serveur", async () => {
    const pc = appareil();
    const tel = appareil();
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    tel.entrer();
    await sync();

    // Hors ligne : le PC modifie d'abord, le téléphone ensuite.
    pc.entrer();
    nuage._reinitialiser();
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius", "Opale"]));
    await attendre();
    await new Promise((r) => setTimeout(r, 5));
    tel.entrer();
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius", "Tango"]));
    await attendre();

    pc.entrer();
    await sync();
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(2);

    tel.entrer();
    await sync();
    expect((await lire()).horses).toEqual(["Sirius", "Tango"]);
    expect(serveur.tiroirs.get("be-stable-data")?.rev).toBe(3);
    expect(serveur.versions.length).toBeGreaterThan(0);

    pc.entrer();
    await sync();
    expect((await lire()).horses).toEqual(["Sirius", "Tango"]);
  });

  it("les factures faites des deux côtés sont toutes gardées", async () => {
    const pc = appareil();
    const tel = appareil();
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    tel.entrer();
    await sync();

    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius"], [{ id: "f-pc", year: 2026, seq: 1 }]));
    await attendre();
    await new Promise((r) => setTimeout(r, 5));
    tel.entrer();
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius"], [{ id: "f-tel", year: 2026, seq: 2 }]));
    await attendre();

    pc.entrer();
    await sync();
    tel.entrer();
    await sync();
    const st = await lire();
    expect(st.invoices.map((i: { id: string }) => i.id).sort()).toEqual(["f-pc", "f-tel"]);
    expect(st.invoiceSeq).toEqual({ "2026": 2 });
  });

  it("une écriture automatique sur un appareil en retard n'efface pas ce qui a été saisi ailleurs", async () => {
    const pc = appareil();
    const tel = appareil();
    const etat = (horses: string[], extra: Record<string, unknown> = {}) => JSON.stringify({ state: { horses: horses.map((n) => ({ id: n, name: n })), invoices: [], invoiceSeq: {}, ...extra }, version: 5 });
    const noms = async () => (await lire()).horses.map((h: { name: string }) => h.name);
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", etat(["Sirius"], { compte: 0 }));
    await attendre();
    await nuage.envoyer();
    tel.entrer();
    await sync();

    // Le téléphone ajoute un cheval et l'envoie.
    await vault.setItem("be-stable-data", etat(["Sirius", "Opale"], { compte: 0 }));
    await attendre();
    await nuage.envoyer();

    // Plus tard, l'ordinateur revient au premier plan : l'autopilote écrit sur ses données d'avant.
    await new Promise((r) => setTimeout(r, 5));
    pc.entrer();
    await vault.setItem("be-stable-data", etat(["Sirius"], { compte: 1 }));
    await attendre();
    await sync();

    expect(await noms()).toEqual(["Sirius", "Opale"]);
    expect((await lire()).compte).toBe(1);
    tel.entrer();
    await sync();
    expect(await noms()).toEqual(["Sirius", "Opale"]);
    expect((await lire()).compte).toBe(1);
  });

  it("une écriture faite avant que l'écran ait relu la copie arrivée est ignorée", async () => {
    const pc = appareil();
    const tel = appareil();
    const etat = (horses: string[]) => JSON.stringify({ state: { horses: horses.map((n) => ({ id: n, name: n })), invoices: [], invoiceSeq: {} }, version: 5 });
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", etat(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    tel.entrer();
    await sync();
    await vault.setItem("be-stable-data", etat(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();

    pc.entrer();
    await nuage.synchroniser();
    // L'écran a encore l'ancienne écurie en mémoire et l'écrit avant de relire.
    await vault.setItem("be-stable-data", etat(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    const st = await lire();
    expect(st.horses.map((h: { name: string }) => h.name)).toEqual(["Sirius", "Opale"]);
    // Relue, l'écran écrit de nouveau normalement.
    await vault.setItem("be-stable-data", etat(["Sirius", "Opale", "Tango"]));
    await attendre();
    expect((await lire()).horses.length).toBe(3);
  });

  it("éteinte, la copie en ligne ne contacte pas le serveur", async () => {
    const pc = appareil();
    pc.entrer();
    pc.m.setItem("bs-nuage", "0");
    await sync();
    await vault.setItem("be-stable-data", donnees(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    expect(serveur.appels).toBe(0);
  });
});

describe("la copie en ligne en clair (décision du 28 novembre 2026)", () => {
  beforeEach(() => {
    serveur.tiroirs.clear();
    serveur.versions = [];
    serveur.appels = 0;
  });

  /** Ce qui est rangé sur l'appareil pour le tiroir des données. */
  const range = (a: ReturnType<typeof appareil>) => [...a.m.m.entries()].find(([k]) => k.startsWith("be-stable-data@"))?.[1] ?? "";
  /** Le tiroir des données tel que le serveur le garde, relu. */
  const auServeur = async () => JSON.parse((await depuisDistant(serveur.tiroirs.get("be-stable-data")!.contenu, async () => null))!).state;
  const ecurie = (horses: string[], clients: string[] = []) =>
    JSON.stringify({ state: { horses: horses.map((n) => ({ id: n, name: n })), clients: clients.map((n) => ({ id: n, name: n })), invoices: [], invoiceSeq: {} }, version: 5 });
  /** Un contenu scellé comme le faisait le coffre en « bs-enc2: » (gzip puis AES-GCM), avec la clé du compte. */
  async function scelleV2(clair: string): Promise<string> {
    const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
    const key = await crypto.subtle.importKey("raw", Buffer.from(cle, "base64"), "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const gz = new Uint8Array(await new Response(new Blob([new TextEncoder().encode(clair)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, gz));
    return `bs-enc2:${b64(iv)}.${b64(ct)}`;
  }

  it("ce qui part est en clair compressé, jamais scellé", async () => {
    const a = appareil();
    a.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")!.contenu.startsWith("bs-clair2:")).toBe(true);
    expect((await auServeur()).horses.map((h: { name: string }) => h.name)).toEqual(["Sirius"]);
    // L'appareil, lui, reste scellé.
    expect(range(a).startsWith("bs-enc")).toBe(true);
  });

  it("B lit la copie en clair et l'écrit scellée sur son appareil", async () => {
    const a = appareil();
    a.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();
    const b = appareil();
    b.entrer();
    const changes = await sync();
    expect(changes.has("be-stable-data")).toBe(true);
    expect(range(b).startsWith("bs-enc")).toBe(true);
    expect((await lire()).horses.map((h: { name: string }) => h.name)).toEqual(["Sirius", "Opale"]);
    // Rien à renvoyer : B est aligné.
    expect(etatNuage().attente).toBe(false);
  });

  it("une copie distante encore chiffrée (bs-enc2) est lue, puis renvoyée en clair", async () => {
    serveur.tiroirs.set("be-stable-data", { rev: 4, contenu: await scelleV2(ecurie(["Câline"])), modifie: "2026-11-27T10:00:00Z" });
    const b = appareil();
    b.entrer();
    await sync();
    await nuage.envoyer();
    expect((await lire()).horses.map((h: { name: string }) => h.name)).toEqual(["Câline"]);
    expect(range(b).startsWith("bs-enc")).toBe(true);
    const l = serveur.tiroirs.get("be-stable-data")!;
    expect(l.contenu.startsWith("bs-clair2:")).toBe(true);
    expect(l.rev).toBe(5);
    expect((await auServeur()).horses.map((h: { name: string }) => h.name)).toEqual(["Câline"]);
  });

  it("un appareil déjà aligné sur une copie encore chiffrée la renvoie en clair", async () => {
    const a = appareil();
    a.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    // La copie en ligne est remise dans l'ancien format, même version (comme avant la bascule).
    const l = serveur.tiroirs.get("be-stable-data")!;
    serveur.tiroirs.set("be-stable-data", { ...l, contenu: await scelleV2(ecurie(["Sirius"])) });
    await sync();
    expect(serveur.tiroirs.get("be-stable-data")!.contenu.startsWith("bs-clair2:")).toBe(true);
    expect(serveur.tiroirs.get("be-stable-data")!.rev).toBe(l.rev + 1);
  });

  it("deux appareils qui écrivent hors ligne gardent les deux changements (fusion)", async () => {
    const a = appareil();
    const b = appareil();
    a.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    b.entrer();
    await sync();

    // Hors ligne : A ajoute un cheval, B un client.
    a.entrer();
    await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
    await attendre();
    b.entrer();
    await vault.setItem("be-stable-data", ecurie(["Sirius"], ["Hugo"]));
    await attendre();

    a.entrer();
    await sync();
    b.entrer();
    await sync();
    a.entrer();
    await sync();
    const st = await auServeur();
    expect(st.horses.map((h: { name: string }) => h.name)).toEqual(["Sirius", "Opale"]);
    expect(st.clients.map((c: { name: string }) => c.name)).toEqual(["Hugo"]);
    expect(serveur.tiroirs.get("be-stable-data")!.contenu.startsWith("bs-clair2:")).toBe(true);
    expect((await lire()).clients.map((c: { name: string }) => c.name)).toEqual(["Hugo"]);
  });

  it("la copie perdante d'un conflit est gardée en clair dans les versions", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();
    const tel = appareil();
    tel.entrer();
    await vault.setItem("be-stable-data", ecurie(["Tango"]));
    await attendre();
    await sync();
    const conflits = serveur.versions.filter((v) => v.raison === "conflit");
    expect(conflits.length).toBeGreaterThan(0);
    expect(conflits.every((v) => v.contenu.startsWith("bs-clair2:"))).toBe(true);
    expect(JSON.parse((await depuisDistant(conflits[0].contenu, async () => null))!).state.horses.map((h: { name: string }) => h.name)).toEqual(["Tango"]);
  });

  for (const manque of ["CompressionStream", "DecompressionStream"] as const) {
    it(`sans ${manque} (Safari iOS avant 16.4), rien ne se synchronise, les données restent sur l'appareil et c'est signalé`, async () => {
      // Une copie en ligne existe déjà, écrite par un appareil à jour.
      const pc = appareil();
      pc.entrer();
      await sync();
      await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
      await attendre();
      await nuage.envoyer();
      const enLigne = serveur.tiroirs.get("be-stable-data")!;
      const appels = serveur.appels;
      erreurs.length = 0;

      const g2 = globalThis as Record<string, unknown>;
      const garde = g2[manque];
      const tel = appareil();
      try {
        delete g2[manque];
        tel.entrer();
        await vault.setItem("be-stable-data", ecurie(["Tango"]));
        await attendre();
        await sync();
        await nuage.envoyer();
        await nuage.envoyerMaintenant();
        // Aucun appel au serveur, la copie en ligne n'a pas bougé, aucune version gardée.
        expect(serveur.appels).toBe(appels);
        expect(serveur.tiroirs.get("be-stable-data")).toEqual(enLigne);
        expect(serveur.versions.filter((v) => v.raison === "conflit")).toEqual([]);
        // Les données du téléphone restent les siennes, scellées.
        expect((await lire()).horses.map((h: { name: string }) => h.name)).toEqual(["Tango"]);
        expect(range(tel).startsWith("bs-enc")).toBe(true);
        // Signalé une fois, avec la phrase pour la gérante ; Mon compte le sait.
        expect(erreurs).toEqual([["copie", nuage.TEXTE_TROP_ANCIEN]]);
        expect(nuage.TEXTE_TROP_ANCIEN).toBe("Ton téléphone est trop ancien pour la copie en ligne : mets-le à jour pour partager avec ton équipe.");
        expect(etatNuage()).toMatchObject({ allume: false, tropAncien: true });
      } finally {
        g2[manque] = garde;
      }
      // Remis à jour, le même téléphone synchronise de nouveau, sans écraser la copie en ligne d'un appareil neuf.
      tel.entrer();
      expect(etatNuage().tropAncien).toBe(false);
      await sync();
      expect(serveur.appels).toBeGreaterThan(appels);
    });
  }
});

describe("rien de noté ne se perd, pas de réessai en boucle (relecture, tour 1)", () => {
  beforeEach(() => {
    serveur.tiroirs.clear();
    serveur.versions = [];
    serveur.appels = 0;
  });
  const ecurie = (horses: string[], clients: string[] = []) =>
    JSON.stringify({ state: { horses: horses.map((n) => ({ id: n, name: n })), clients: clients.map((n) => ({ id: n, name: n })), invoices: [], invoiceSeq: {} }, version: 5 });
  const enClair = async (c: string) => (await depuisDistant(c, async () => null)) ?? "";

  it("un téléphone aligné, devenu trop ancien, garde ses changements jusqu'à sa remise à jour", async () => {
    const tel = appareil();
    tel.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    const pc = appareil();
    pc.entrer();
    await sync();

    // Le téléphone ne sait plus décompresser : la gérante ajoute Hugo, rien ne part.
    const g2 = globalThis as Record<string, unknown>;
    const garde = g2.DecompressionStream;
    tel.entrer();
    try {
      delete g2.DecompressionStream;
      await vault.setItem("be-stable-data", ecurie(["Sirius"], ["Hugo"]));
      await attendre();
      await sync();
      expect(etatNuage().attente).toBe(true);
    } finally {
      g2.DecompressionStream = garde;
    }
    // L'ordinateur écrit entre-temps.
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();

    // Le téléphone est remis à jour : Hugo et Opale sont partout.
    tel.entrer();
    await sync();
    const st = await lire();
    expect(st.clients.map((c: { name: string }) => c.name)).toEqual(["Hugo"]);
    expect(st.horses.map((h: { name: string }) => h.name)).toEqual(["Sirius", "Opale"]);
    const enLigne = JSON.parse(await enClair(serveur.tiroirs.get("be-stable-data")!.contenu)).state;
    expect(enLigne.clients.map((c: { name: string }) => c.name)).toEqual(["Hugo"]);
    expect(enLigne.horses.map((h: { name: string }) => h.name)).toEqual(["Sirius", "Opale"]);
  });

  it("un changement jamais noté n'est pas écrasé par une copie en ligne plus récente", async () => {
    const tel = appareil();
    tel.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius"]));
    await attendre();
    await nuage.envoyer();
    const pc = appareil();
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();
    // Sur le téléphone, une écriture a échappé au suivi (Hugo est rangé, mais l'état dit « propre »).
    tel.entrer();
    const etat = (k: string) => [...tel.m.m.keys()].find((x) => x.startsWith(k))!;
    const cleEtat = etat("bs-nuage@");
    const avant = tel.m.getItem(cleEtat)!;
    await vault.setItem("be-stable-data", ecurie(["Sirius"], ["Hugo"]));
    await attendre();
    tel.m.setItem(cleEtat, avant);
    await sync();
    expect((await lire()).clients.map((c: { name: string }) => c.name)).toEqual(["Hugo"]);
    expect((await lire()).horses.map((h: { name: string }) => h.name)).toEqual(["Sirius", "Opale"]);
  });

  it("la copie en ligne qui gagne ne s'écrit pas (place pleine) : pas de réessai en boucle, la copie de l'appareil gardée une fois", async () => {
    const pc = appareil();
    pc.entrer();
    await sync();
    await vault.setItem("be-stable-data", ecurie(["Sirius", "Opale"]));
    await attendre();
    await nuage.envoyer();

    // Un téléphone neuf écrit avant d'avoir lu, puis n'a plus de place pour ranger la copie en ligne.
    const tel = appareil();
    tel.entrer();
    await vault.setItem("be-stable-data", ecurie(["Tango"]));
    await attendre();
    const ranger = tel.m.setItem.bind(tel.m);
    tel.m.setItem = (k: string, v: string) => {
      if (k.startsWith("be-stable-data@")) throw Object.assign(new Error("plein"), { name: "QuotaExceededError" });
      ranger(k, v);
    };
    try {
      await nuage.synchroniser();
      const appels = serveur.appels;
      await new Promise((r) => setTimeout(r, 1500));
      // Ni PUT ni POST de plus : le prochain essai est dans une minute.
      expect(serveur.appels).toBe(appels);
      expect(serveur.versions.filter((v) => v.raison === "conflit")).toHaveLength(1);
      expect(serveur.tiroirs.get("be-stable-data")!.rev).toBe(1);
      // Une relance tout de suite ne garde pas une seconde fois la même copie.
      await nuage.envoyer();
      expect(serveur.versions.filter((v) => v.raison === "conflit")).toHaveLength(1);
    } finally {
      tel.m.setItem = ranger;
      nuage._reinitialiser();
    }
  });
});
