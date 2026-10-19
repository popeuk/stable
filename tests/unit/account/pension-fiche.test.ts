import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { useDataStore } = await import("@/stores/data-store");
const { localToday } = await import("@/lib/utils/local-date");
const { billsFor } = await import("@/lib/domain/billing");
const { clientDues } = await import("@/lib/domain/clients");
const { currentPeriod, addMonths } = await import("@/lib/utils/period");
const { pensionRevenueId } = await import("@/lib/domain/autopilot");

const st = () => useDataStore.getState();
const mois = () => localToday().slice(0, 7);

describe("changer la pension dans la fiche du cheval", () => {
  it("vaut pour le mois en cours partout : la fiche du client, le bilan, la facture", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", entryDate: "2020-01-01", ownerName: "Julien B.", pension: 390 });
    const rid = pensionRevenueId(hid, mois());
    expect(st().revenues.find((r) => r.id === rid)?.amount).toBe(390);
    st().updateHorse(hid, { pension: 450 });
    expect(st().horses.find((h) => h.id === hid)?.pension).toBe(450);
    expect(st().revenues.find((r) => r.id === rid)?.amount).toBe(450);
    expect(billsFor(st(), currentPeriod()).find((b) => b.payer === "Julien B.")?.total).toBe(450);
    expect(clientDues(st(), currentPeriod()).find((c) => c.name === "Julien B.")?.due).toBe(450);
  });

  it("le passé ne bouge pas", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", entryDate: "2020-01-01", ownerName: "Julien B.", pension: 390 });
    const avant = `${addMonths(currentPeriod(), -1).year}-${String(addMonths(currentPeriod(), -1).month).padStart(2, "0")}`;
    const ancienne = { ...st().revenues.find((r) => r.id === pensionRevenueId(hid, mois()))!, id: pensionRevenueId(hid, avant), date: `${avant}-01` };
    useDataStore.setState((s) => ({ revenues: [...s.revenues, ancienne] }));
    st().updateHorse(hid, { pension: 450 });
    expect(st().revenues.find((r) => r.id === pensionRevenueId(hid, avant))?.amount).toBe(390);
  });

  it("une pension déjà facturée garde son prix ce mois-ci, le contrat change pour la suite", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", entryDate: "2020-01-01", ownerName: "Julien B.", pension: 390 });
    const rid = pensionRevenueId(hid, mois());
    useDataStore.setState({ invoices: [{ id: "i1", number: "2026-0001", kind: "facture", payer: "Julien B.", month: mois(), revenueIds: [rid], lines: [] } as never] });
    st().updateHorse(hid, { pension: 450 });
    expect(st().horses.find((h) => h.id === hid)?.pension).toBe(450);
    expect(st().revenues.find((r) => r.id === rid)?.amount).toBe(390);
  });

  it("une pension retirée ne compte plus ce mois-ci", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", entryDate: "2020-01-01", ownerName: "Julien B.", pension: 390 });
    st().updateHorse(hid, { pension: undefined });
    expect(st().revenues.some((r) => r.id === pensionRevenueId(hid, mois()))).toBe(false);
  });

  it("une pension posée sur un cheval qui n'en avait pas compte tout de suite", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", entryDate: "2020-01-01", ownerName: "Julien B." });
    st().updateHorse(hid, { pension: 420 });
    expect(st().revenues.find((r) => r.id === pensionRevenueId(hid, mois()))?.amount).toBe(420);
  });
});

describe("changer de propriétaire en cours de mois, puis annuler", () => {
  it("les deux parts font la pension ; annuler remet tout comme avant", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Willow", entryDate: "2020-01-01", ownerName: "Julien B.", pension: 390 });
    const rid = pensionRevenueId(hid, mois());
    const undo = st().setOwner(hid, "Anne M.");
    const parts = st().revenues.filter((r) => r.id === rid || r.id === `${rid}-suite`);
    expect(parts.reduce((t, r) => t + r.amount, 0)).toBe(390);
    undo();
    expect(st().revenues.filter((r) => r.id.startsWith(rid))).toHaveLength(1);
    expect(st().revenues.find((r) => r.id === rid)).toMatchObject({ amount: 390 });
    expect(st().revenues.find((r) => r.id === rid)?.payer).toBeUndefined();
  });
});
