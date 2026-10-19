import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { useDataStore } = await import("@/stores/data-store");
const { ensurePensions, pensionDuMois, pensionRevenueId } = await import("@/lib/domain/autopilot");
const { textePensionArrivee } = await import("@/lib/domain/pension-arrivee");
const { billsFor } = await import("@/lib/domain/billing");

const st = () => useDataStore.getState();
const RID = (hid: string) => pensionRevenueId(hid, "2026-10");
const pension = (hid: string) => st().revenues.find((r) => r.id === RID(hid));
const periode = { year: 2026, month: 10 };

describe("la pension au prorata le mois de l'arrivée (règle)", () => {
  it("entière un 1er ; sinon des jours de l'arrivée au dernier du mois, au centime, avec sa note", () => {
    expect(pensionDuMois(450, "2026-10-01")).toEqual({ amount: 450 });
    expect(pensionDuMois(450, "2026-10-12")).toEqual({ amount: 290.32, note: "Pension du 12 au 31 octobre" });
    expect(pensionDuMois(310, "2026-10-31")).toEqual({ amount: 10, note: "Pension du 31 au 31 octobre" });
    expect(pensionDuMois(280, "2026-02-15")).toEqual({ amount: 140, note: "Pension du 15 au 28 février" });
  });

  it("l'autopilote la poste ainsi, et entière les mois suivants", () => {
    const h = { id: "h", stableId: "s", name: "Sirius", entryDate: "2026-09-20", isArchived: false, pension: 300, exitDate: null, stays: [{ entry: "2026-09-20", countFrom: "2026-09-20" }] };
    const out = ensurePensions({ horses: [h], revenues: [], revenueCategories: [{ id: "cp", name: "Pension" }] }, "2026-10-19", [], "2026-09");
    expect(out.map((r) => [r.id, r.date, r.amount, r.note])).toEqual([
      ["rev-pension-h-2026-09", "2026-09-20", 110, "Pension du 20 au 30 septembre"],
      ["rev-pension-h-2026-10", "2026-10-01", 300, undefined],
    ]);
  });

  it("la fiche le dit, accordé au mois ; déjà facturée, elle le dit aussi", () => {
    expect(textePensionArrivee(450, "2026-10-12", "2026-10-19")).toBe("Arrivée en cours de mois : sa pension d’octobre est comptée au prorata, du 12 au 31 octobre (290,32 €).");
    expect(textePensionArrivee(450, "2026-10-12", "2026-10-19", true)).toBe("Sa pension d’octobre est déjà facturée : elle ne change pas.");
    expect(textePensionArrivee(450, "2026-10-01", "2026-10-19")).toBe("");
    expect(textePensionArrivee(450, "2026-09-12", "2026-10-19")).toBe("");
    expect(textePensionArrivee(undefined, "2026-10-12", "2026-10-19")).toBe("");
  });
});

describe("dans le carnet (19 octobre 2026)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T10:00:00"));
  });
  afterAll(() => vi.useRealTimers());

  it("un cheval arrivé le 12 paie 12 à 31 ; sa facture et sa fiche client le comptent", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", pension: 450, entryDate: "2026-10-12", ownerName: "Léa B." });
    expect(pension(hid)).toMatchObject({ date: "2026-10-12", amount: 290.32, note: "Pension du 12 au 31 octobre" });
    expect(billsFor(st(), periode).find((b) => b.payer === "Léa B.")?.total).toBe(290.32);
  });

  it("changer son prix ce mois-ci garde le prorata", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", pension: 450, entryDate: "2026-10-12", ownerName: "Léa B." });
    st().updateHorse(hid, { pension: 310 });
    expect(pension(hid)).toMatchObject({ amount: 200, note: "Pension du 12 au 31 octobre" });
  });

  it("corriger l'arrivée recompte le mois ; au 1er, la pension redevient entière", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", pension: 450, entryDate: "2026-10-12", ownerName: "Léa B." });
    st().updateHorse(hid, { entryDate: "2026-10-05" });
    expect(pension(hid)).toMatchObject({ date: "2026-10-05", amount: 391.94, note: "Pension du 5 au 31 octobre" });
    st().updateHorse(hid, { entryDate: "2026-10-01" });
    expect(pension(hid)?.amount).toBe(450);
    expect(pension(hid)?.note).toBeUndefined();
  });

  it("déjà facturée : la pension du mois ne bouge pas", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", pension: 450, entryDate: "2026-10-12", ownerName: "Léa B." });
    useDataStore.setState({ invoices: [{ id: "i1", number: "2026-0001", kind: "facture", payer: "Léa B.", month: "2026-10", revenueIds: [RID(hid)], lines: [] } as never] });
    st().updateHorse(hid, { entryDate: "2026-10-05" });
    expect(pension(hid)).toMatchObject({ date: "2026-10-12", amount: 290.32 });
  });

  it("puis un changement de propriétaire partage la part du mois (partPension), sans rien perdre", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", pension: 450, entryDate: "2026-10-12", ownerName: "Léa B." });
    st().setOwner(hid, "Anne M.");
    const parts = st().revenues.filter((r) => r.id === RID(hid) || r.id === `${RID(hid)}-suite`);
    expect(parts).toHaveLength(2);
    expect(Math.round(parts.reduce((t, r) => t + r.amount, 0) * 100) / 100).toBe(290.32);
  });

  it("un cheval là depuis avant ce mois paie le mois entier", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", pension: 390, entryDate: "2025-03-14", ownerName: "Julien B." });
    expect(pension(hid)).toMatchObject({ date: "2026-10-01", amount: 390 });
  });
});
