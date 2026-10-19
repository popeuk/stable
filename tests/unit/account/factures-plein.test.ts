import { describe, expect, it } from "vitest";

// Un localStorage qui peut devenir plein, comme un téléphone sans place.
class Mem {
  m = new Map<string, string>();
  plein = false;
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.plein) throw Object.assign(new Error("plein"), { name: "QuotaExceededError" });
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
(globalThis as unknown as { window: object }).window = Object.assign(globalThis, { location: { assign: () => {}, search: "" } });

const { ouvrirEssai } = await import("@/components/bs/essayer");
const { useDataStore } = await import("@/stores/data-store");
const { brouillon } = await import("@/lib/domain/facture");
const { compteurAppareil } = await import("@/lib/account/factures-seq");
const { FactureNonEnregistree, messageNonEnregistree } = await import("@/lib/account/numeroter");
const { scopedKey } = await import("@/lib/account/session");

const oct = { year: 2026, month: 10 };
const today = "2026-10-20";

function poser() {
  useDataStore.setState({
    horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", exitDate: null, isArchived: false }],
    revenues: ["Marie", "Hugo"].map((n, i) => ({ id: `r${i}`, stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual" as const, payer: n, seanceId: `s${i}` })),
    revenueCategories: [{ id: "cc", name: "Cours" }],
    people: ["Marie", "Hugo"].map((n, i) => ({ id: `p${i}`, name: n, role: "cavalier" as const, active: true, statut: "particulier", address: "3 allée des Saules" as const, nomComplet: `${n} Durand` })),
    billing: { legalName: "Les Pommiers", statut: "ei", address: "1 rue du Pré", siret: "12345678900012", vat: "franchise" },
    invoices: [],
    invoiceSeq: {},
    payments: [],
  });
}
const contenu = (nom: string) => brouillon(useDataStore.getState(), nom, oct).facture!;

describe("téléphone plein : rien n'est numéroté sans être enregistré", () => {
  it("la facture ne reçoit pas de numéro, l'écran le dit, et le numéro reste libre", async () => {
    await ouvrirEssai();
    poser();
    const c = contenu("Marie");
    store.plein = true;
    const err = await useDataStore
      .getState()
      .issueInvoices([c], today)
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(FactureNonEnregistree);
    expect((err as InstanceType<typeof FactureNonEnregistree>).plein).toBe(true);
    expect(messageNonEnregistree(err as InstanceType<typeof FactureNonEnregistree>)).toMatch(/^Ton téléphone est plein : la facture n’a pas reçu de numéro/);
    // Rien à l'écran, rien d'enregistré, le compteur de l'appareil n'a pas bougé.
    expect(useDataStore.getState().invoices).toEqual([]);
    expect(useDataStore.getState().invoiceSeq ?? {}).toEqual({});
    expect(compteurAppareil()).toEqual({});
    // De la place revient : la facture prend le premier numéro, il n'a pas été brûlé.
    store.plein = false;
    const [a] = await useDataStore.getState().issueInvoices([contenu("Marie")], today);
    expect(a.number).toBe("2026-0001");
    const st = JSON.parse(store.getItem(scopedKey("be-stable-data"))!).state;
    expect(st.invoices.map((i: { number: string }) => i.number)).toEqual(["2026-0001"]);
  });

  it("un avoir fait sur un téléphone plein n'est pas fait non plus", async () => {
    const n = useDataStore.getState().invoices![0].number;
    store.plein = true;
    const err = await useDataStore
      .getState()
      .issueAvoir(n, [1], today)
      .then(() => null, (e: unknown) => e);
    store.plein = false;
    expect(err).toBeInstanceOf(FactureNonEnregistree);
    expect(useDataStore.getState().invoices!.map((i) => i.number)).toEqual(["2026-0001"]);
    const a = await useDataStore.getState().issueAvoir(n, [1], today);
    expect(a?.number).toBe("2026-0002");
  });
});
