import { describe, expect, it } from "vitest";

/**
 * Question 18, réponse A : avant de numéroter, l'app relit la copie en ligne.
 * Le téléphone et l'ordinateur ne donnent jamais le même numéro ; sans
 * réseau, la facture est faite mais provisoire, et prend son numéro au
 * retour du réseau, dans l'ordre.
 */
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
g.window = Object.assign(globalThis, { location: { assign: () => {}, search: "" } });

// Le serveur « tiroirs » (comme tests/unit/account/nuage.test.ts), qu'on peut couper.
const serveur = { tiroirs: new Map<string, { rev: number; contenu: string; modifie: string }>(), coupe: false };
g.fetch = (async (_url: string, init: RequestInit) => {
  if (serveur.coupe) throw new TypeError("Failed to fetch");
  const rep = (status: number, body: unknown) => ({ status, json: async () => body }) as Response;
  if (init.method === "GET") return rep(200, { tiroirs: [...serveur.tiroirs].map(([nom, l]) => ({ nom, ...l })) });
  const b = JSON.parse(String(init.body)) as { nom: string; contenu: string; rev: number; modifie: string };
  if (init.method === "POST") return rep(200, { ok: true });
  const cur = serveur.tiroirs.get(b.nom);
  if ((cur?.rev ?? 0) !== b.rev) return rep(409, { tiroir: cur ? { nom: b.nom, ...cur } : null });
  serveur.tiroirs.set(b.nom, { rev: b.rev + 1, contenu: b.contenu, modifie: b.modifie });
  return rep(200, { rev: b.rev + 1 });
}) as unknown as typeof fetch;

const { setSession } = await import("@/lib/account/session");
const nuage = await import("@/lib/account/nuage");
const { useDataStore } = await import("@/stores/data-store");
const { brouillon } = await import("@/lib/domain/facture");
const { AvoirSansReseau } = await import("@/lib/account/numeroter");
const { ecrituresFaites } = await import("@/lib/account/vault");

const cle = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
const compte = { kind: "compte" as const, userId: 7, email: "g@x.fr", prenom: "Julie", token: "t", dataKey: cle, at: "" };
const oct = { year: 2026, month: 10 };
const today = "2026-10-20";
const CLIENTS = ["Marie", "Hugo", "Léa", "Inès"];

const appareils = { pc: new Mem(), tel: new Mem() };
/** Passer sur un appareil : son stockage, l'écran relit ses données. */
async function sur(nom: keyof typeof appareils) {
  g.localStorage = appareils[nom];
  nuage._reinitialiser();
  setSession(compte);
  await useDataStore.persist.rehydrate();
}
const contenu = (nom: string) => brouillon(useDataStore.getState(), nom, oct).facture!;
const numeros = () => (useDataStore.getState().invoices ?? []).map((i) => i.number);

describe("deux appareils, un seul compte : des numéros qui ne se croisent jamais", () => {
  it("l'ordinateur fait la 0001 ; le téléphone, sans avoir rien relu, fait la 0002 (il relit la copie en ligne avant)", async () => {
    await sur("pc");
    useDataStore.setState({
      horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false }],
      revenues: CLIENTS.map((n, i) => ({ id: `r${i}`, stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual" as const, payer: n, seanceId: `s${i}` })),
      revenueCategories: [{ id: "cc", name: "Cours" }],
      people: CLIENTS.map((n, i) => ({ id: `p${i}`, name: n, role: "cavalier" as const, active: true, statut: "particulier", address: "3 allée des Saules" as const, nomComplet: `${n} Durand` })),
      billing: { legalName: "Les Pommiers", statut: "ei", address: "1 rue du Pré", siret: "12345678900012", vat: "franchise" },
      invoices: [],
      invoiceSeq: {},
      payments: [],
    });
    await ecrituresFaites("be-stable-data");
    await nuage.synchroniser();
    const [a] = await useDataStore.getState().issueInvoices([contenu("Marie")], today);
    expect(a.number).toBe("2026-0001");
    await nuage.notesFaites();
    await nuage.envoyer();
    expect(serveur.tiroirs.get("be-stable-data")).toBeTruthy();

    // Le téléphone avait la même écurie, mais n'a pas vu la facture de Marie.
    const avant = JSON.parse(JSON.stringify(useDataStore.getState()));
    await sur("tel");
    useDataStore.setState({ ...avant, invoices: [], invoiceSeq: {} });
    await ecrituresFaites("be-stable-data");
    await ecrituresFaites("be-stable-data");
    const [b] = await useDataStore.getState().issueInvoices([contenu("Hugo")], today);
    expect(b.number).toBe("2026-0002");
    expect(numeros()).toEqual(expect.arrayContaining(["2026-0001", "2026-0002"]));
  });

  it("sans réseau, la facture est faite mais provisoire, puis prend son numéro au retour du réseau, dans l'ordre", async () => {
    serveur.coupe = true;
    const [p1] = await useDataStore.getState().issueInvoices([contenu("Léa")], today);
    const [p2] = await useDataStore.getState().issueInvoices([contenu("Inès")], today);
    expect(p1.provisoire).toBeTruthy();
    expect(p1.seq).toBe(0);
    expect(p2.provisoire).toBeTruthy();
    // Ses lignes sont prises : elles ne repassent pas sur une autre facture.
    expect(brouillon(useDataStore.getState(), "Léa", oct).vide).toBe(true);
    // Toujours pas de réseau : rien ne change.
    expect(await useDataStore.getState().numeroterEnAttente("2026-10-21")).toEqual({ numerotees: [], retirees: [] });
    // Un avoir, lui, attend le réseau.
    await expect(useDataStore.getState().issueAvoir("2026-0002", [1], today)).rejects.toBeInstanceOf(AvoirSansReseau);

    serveur.coupe = false;
    const { numerotees: n } = await useDataStore.getState().numeroterEnAttente("2026-10-21");
    expect(n.map((i) => [i.payer, i.number, i.issuedAt])).toEqual([
      ["Léa", "2026-0003", "2026-10-21"],
      ["Inès", "2026-0004", "2026-10-21"],
    ]);
    expect((useDataStore.getState().invoices ?? []).some((i) => i.provisoire)).toBe(false);
  });

  it("au retour du réseau, une provisoire déjà facturée sur l'autre appareil est retirée, pas numérotée", async () => {
    const st = useDataStore.getState();
    const marie = st.invoices!.find((i) => i.payer === "Marie")!;
    const doublon = { ...marie, id: "tel-marie", number: "provisoire-tel-marie", seq: 0, provisoire: "2026-10-20T08:00:00.000Z" };
    useDataStore.setState({ invoices: [...st.invoices!, doublon] });
    await ecrituresFaites("be-stable-data");
    const { numerotees, retirees } = await useDataStore.getState().numeroterEnAttente("2026-10-21");
    expect(numerotees).toEqual([]);
    expect(retirees.map((r) => [r.facture.id, r.numeros])).toEqual([["tel-marie", [marie.number]]]);
    expect((useDataStore.getState().invoices ?? []).some((i) => i.id === "tel-marie")).toBe(false);
    expect(numeros().filter((n) => n === marie.number)).toHaveLength(1);
  });

  it("sans compte (essai), rien ne change : un seul appareil, le numéro tout de suite", async () => {
    serveur.coupe = true;
    const avant = JSON.parse(JSON.stringify(useDataStore.getState()));
    g.localStorage = new Mem();
    nuage._reinitialiser();
    setSession({ kind: "locale", at: "" });
    await useDataStore.persist.rehydrate();
    useDataStore.setState({ ...avant, invoices: [], invoiceSeq: {} });
    await ecrituresFaites("be-stable-data");
    const [a] = await useDataStore.getState().issueInvoices([contenu("Marie")], today);
    expect(a.provisoire).toBeUndefined();
    expect(a.number).toBe("2026-0001");
    serveur.coupe = false;
  });
});
