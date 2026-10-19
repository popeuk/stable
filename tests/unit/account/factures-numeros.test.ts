import { describe, expect, it } from "vitest";

// Un localStorage minimal et une fenêtre qui ne recharge rien (comme essai.test.ts).
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
}
const store = new Mem();
(globalThis as unknown as { localStorage: Mem }).localStorage = store;
(globalThis as unknown as { window: object }).window = Object.assign(globalThis, { location: { assign: () => {}, search: "" } });

const { ouvrirEssai } = await import("@/components/bs/essayer");
const { useDataStore } = await import("@/stores/data-store");
const { brouillon, fusionFactures } = await import("@/lib/domain/facture");
const { compteurAppareil } = await import("@/lib/account/factures-seq");
const { scopedKey } = await import("@/lib/account/session");
type Invoice = import("@/lib/domain/types").Invoice;

const oct = { year: 2026, month: 10 };
const today = "2026-10-20";

/** Une écurie avec trois clients qui ont chacun un cours en octobre. */
function poser() {
  useDataStore.setState({
    horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false }],
    revenues: ["Marie", "Hugo", "Léa", "Inès"].map((n, i) => ({ id: `r${i}`, stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual" as const, payer: n, seanceId: `s${i}` })),
    revenueCategories: [{ id: "cc", name: "Cours" }],
    people: ["Marie", "Hugo", "Léa", "Inès"].map((n, i) => ({ id: `p${i}`, name: n, role: "cavalier" as const, active: true, statut: "particulier" as const, nomComplet: `${n} Durand` })),
    billing: { legalName: "Les Pommiers", address: "1 rue du Pré", siret: "12345678900012", vat: "franchise" },
    invoices: [],
    invoiceSeq: {},
    payments: [],
  });
}
const contenu = (nom: string) => brouillon(useDataStore.getState(), nom, oct).facture!;
const stocke = () => JSON.parse(store.getItem(scopedKey("be-stable-data"))!) as { state: { invoices: Invoice[]; invoiceSeq: Record<string, number> } };

describe("les numéros de facture ne reviennent jamais", () => {
  it("après la reprise d'une sauvegarde, le numéro suivant ne réutilise pas un numéro déjà donné", async () => {
    await ouvrirEssai();
    poser();
    const [a] = await useDataStore.getState().issueInvoices([contenu("Marie")], today);
    expect(a.number).toBe("2026-0001");
    expect(compteurAppareil()).toEqual({ "2026": 1 });
    // La sauvegarde reprise ne connaissait aucune facture : le compteur de l'appareil, lui, s'en souvient.
    useDataStore.setState({ invoices: [], invoiceSeq: {} });
    store.setItem(scopedKey("be-stable-data"), JSON.stringify({ state: { ...stocke().state, invoices: [], invoiceSeq: {} }, version: 4 }));
    const [b] = await useDataStore.getState().issueInvoices([contenu("Hugo")], today);
    expect(b.number).toBe("2026-0002");
  });

  it("la reprise d'une sauvegarde garde les factures faites depuis", () => {
    const avant = useDataStore.getState();
    const repris = { invoices: [] as Invoice[], invoiceSeq: {} };
    const f = fusionFactures(repris, avant, compteurAppareil());
    expect(f.invoices.map((i) => i.number)).toContain("2026-0002");
    expect(f.invoiceSeq["2026"]).toBe(2);
  });

  it("un autre onglet vient de faire une facture : elle est relue avant de numéroter, aucune ne se perd", async () => {
    const st = stocke();
    const autre: Invoice = { ...st.state.invoices[st.state.invoices.length - 1], id: "autre-onglet", number: "2026-0003", seq: 3, payer: "Léa", revenueIds: ["r2"] };
    store.setItem(scopedKey("be-stable-data"), JSON.stringify({ state: { ...st.state, invoices: [...st.state.invoices, autre], invoiceSeq: { "2026": 3 } }, version: 4 }));
    // Cet onglet n'a pas encore vu la facture de Léa, et prépare la sienne pour Léa et Inès.
    const pourLea = contenu("Léa");
    const [c, d] = await useDataStore.getState().issueInvoices([pourLea, contenu("Inès")], today);
    // Léa est déjà facturée ailleurs : pas de seconde facture ; Inès reçoit le numéro suivant.
    expect(c.payer).toBe("Inès");
    expect(c.number).toBe("2026-0004");
    expect(d).toBeUndefined();
    const nums = useDataStore.getState().invoices!.map((i) => i.number);
    expect(nums).toEqual(expect.arrayContaining(["2026-0002", "2026-0003", "2026-0004"]));
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("un avoir prend le numéro suivant de la même suite", async () => {
    const inv = useDataStore.getState().invoices!.find((i) => i.number === "2026-0004")!;
    const a = await useDataStore.getState().issueAvoir(inv.number, inv.lines.map((l) => l.qty), today);
    expect(a).toMatchObject({ kind: "avoir", number: "2026-0005", totalTTC: -25 });
    expect(compteurAppareil()["2026"]).toBe(5);
  });

  it("un avoir d'un montant libre prend lui aussi le numéro suivant", async () => {
    const inv = useDataStore.getState().invoices!.find((i) => i.number === "2026-0003")!;
    const a = await useDataStore.getState().issueAvoirMontant(inv.number, 10, "Absence", today);
    expect(a).toMatchObject({ kind: "avoir", number: "2026-0006", totalTTC: -10, avoirDe: { number: "2026-0003" } });
    expect(await useDataStore.getState().issueAvoirMontant(inv.number, inv.totalTTC, "Trop", today)).toBeNull();
  });
});
