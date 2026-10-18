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
const { currentPeriod } = await import("@/lib/utils/period");
const { corrigerRecurrente, factureDeLigne, ligneRemplie, messageFacturee } = await import("@/lib/domain/corriger");

const st = () => useDataStore.getState();

describe("corriger une ligne d'argent", () => {
  it("une recette : montant et jour corrigés à sa place", () => {
    st().startEmpty();
    st().addRevenue({ horseId: "", amount: 800, date: localToday(), note: "PAC", source: "manual" });
    const id = st().revenues[0].id;
    expect(ligneRemplie(st(), { t: "rev", id })).toMatchObject({ sens: "in", amount: 800, pour: "hors", label: "PAC" });
    st().updateRevenue(id, { amount: 850 });
    expect(st().revenues).toHaveLength(1);
    expect(st().revenues[0]).toMatchObject({ id, amount: 850, note: "PAC" });
  });

  it("une dépense refacturée : la recette du propriétaire et le soin suivent le montant", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Diva", entryDate: "2020-01-01", ownerName: "Inès R." });
    st().addDirectExpense({ horseId: hid, label: "Ferrure", amount: 60, date: localToday(), source: "manual" });
    const eid = st().directExpenses[0].id;
    st().rebillExpense(eid);
    st().updateDirectExpense(eid, { amount: 75 });
    expect(st().directExpenses[0].amount).toBe(75);
    expect(billsFor(st(), currentPeriod()).find((b) => b.payer === "Inès R.")?.total).toBe(75);
  });

  it("une dépense de l'écurie", () => {
    st().startEmpty();
    st().addSharedExpense({ label: "Foin", totalAmount: 120, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [] });
    const sid = st().sharedExpenses[0].id;
    st().updateSharedExpense(sid, { totalAmount: 140 });
    expect(st().sharedExpenses[0]).toMatchObject({ id: sid, totalAmount: 140, label: "Foin" });
  });

  it("une ligne facturée ne se corrige pas : on dit la facture et l'avoir", () => {
    const d = {
      invoices: [{ number: "2026-0001", kind: undefined, revenueIds: ["r1"] }],
      directExpenses: [{ id: "e1", rebillRevenueId: "r1" }],
    } as unknown as Parameters<typeof factureDeLigne>[0];
    expect(factureDeLigne(d, { t: "rev", id: "r1" })).toBe("2026-0001");
    expect(factureDeLigne(d, { t: "dir", id: "e1" })).toBe("2026-0001");
    expect(factureDeLigne(d, { t: "rev", id: "r2" })).toBeUndefined();
    expect(messageFacturee("2026-0001")).toBe("Elle est sur la facture n° 2026-0001 : fais un avoir.");
  });
});

describe("corriger ce qui revient chaque mois : le passé ne bouge pas", () => {
  const pension = [{ id: "p", amount: 350, startDate: "2026-01-01", endDate: null, frequency: "monthly", label: "Pension" }];

  it("commencée avant ce mois : l'ancienne s'arrête fin du mois dernier, la corrigée reprend au 1er", () => {
    const out = corrigerRecurrente(pension, "p", { amount: 380 }, "2026-10-19", "p2");
    expect(out).toEqual([
      { id: "p", amount: 350, startDate: "2026-01-01", endDate: "2026-09-30", frequency: "monthly", label: "Pension" },
      { id: "p2", amount: 380, startDate: "2026-10-01", endDate: null, frequency: "monthly", label: "Pension" },
    ]);
  });

  it("le nom seul, ou commencée ce mois-ci : corrigée à sa place", () => {
    expect(corrigerRecurrente(pension, "p", { label: "Pension travail" }, "2026-10-19", "p2")).toEqual([{ ...pension[0], label: "Pension travail" }]);
    const neuve = [{ ...pension[0], startDate: "2026-10-05" }];
    expect(corrigerRecurrente(neuve, "p", { amount: 380 }, "2026-10-19", "p2")).toEqual([{ ...neuve[0], amount: 380 }]);
  });

  it("dans le magasin : une rentrée qui revient corrigée garde ses mois passés", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Sirius", entryDate: "2020-01-01", ownerName: "Léa B." });
    st().addRecurringRevenue({ horseId: hid, amount: 100, frequency: "monthly", startDate: "2020-01-01", endDate: null, source: "manual", label: "Demi-pension" });
    const rid = st().recurringRevenues![0].id;
    st().updateRecurringRevenue(rid, { amount: 120 }, "2026-10-19");
    expect(st().recurringRevenues!.map((r) => [r.amount, r.startDate, r.endDate])).toEqual([
      [100, "2020-01-01", "2026-09-30"],
      [120, "2026-10-01", null],
    ]);
  });
});
