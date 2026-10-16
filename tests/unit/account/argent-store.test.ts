import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { useDataStore } = await import("@/stores/data-store");
const { localToday } = await import("@/lib/utils/local-date");
const { monthBreakdown } = await import("@/lib/domain/ticket");
const { currentPeriod } = await import("@/lib/utils/period");
const { billsFor } = await import("@/lib/domain/billing");

const st = () => useDataStore.getState();

describe("le magasin de données : l'argent reste juste", () => {
  it("un cheval ajouté compte sa pension tout de suite, sans rechargement (P2-2)", () => {
    st().startEmpty();
    st().addHorse({ name: "Sirius", pension: 450, entryDate: localToday(), ownerName: "Léa B." });
    expect(monthBreakdown(st(), currentPeriod()).revenue).toBe(450);
  });

  it("supprimer une dépense retire aussi sa refacturation au propriétaire (P2-14)", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Diva", entryDate: "2020-01-01", ownerName: "Inès R." });
    st().addDirectExpense({ horseId: hid, label: "Ferrure", amount: 60, date: localToday(), source: "manual" });
    const eid = st().directExpenses[0].id;
    st().rebillExpense(eid);
    expect(billsFor(st(), currentPeriod()).find((b) => b.payer === "Inès R.")?.total).toBe(60);
    st().deleteDirectExpense(eid);
    expect(st().revenues.some((r) => r.rebillOf === eid)).toBe(false);
    expect(billsFor(st(), currentPeriod()).find((b) => b.payer === "Inès R.")).toBeUndefined();
  });

  it("un cheval qui part reçoit sa date, reste dans la liste et peut revenir", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Pacha", pension: 490, entryDate: "2020-01-01", ownerName: "Julie P." });
    const net = monthBreakdown(st(), currentPeriod()).net;
    st().archiveHorse(hid);
    const h = st().horses.find((x) => x.id === hid)!;
    expect(h.isArchived).toBe(true);
    expect(h.exitDate).toBe(localToday());
    expect(monthBreakdown(st(), currentPeriod()).net).toBe(net);
    st().restoreHorse(hid);
    expect(st().horses.find((x) => x.id === hid)).toMatchObject({ isArchived: false, exitDate: null, entryDate: "2020-01-01" });
    expect(monthBreakdown(st(), currentPeriod()).revenue).toBe(490);
  });

  it("« Arrêter » une récurrente pose une date de fin au lieu de la supprimer (P1-6)", () => {
    st().startEmpty();
    st().addRecurringExpense({ label: "Assurance", amount: 120, isShared: true, distributionMode: "equal", frequency: "monthly", startDate: "2025-01-01", endDate: null, source: "manual" });
    const rid = st().recurringExpenses![0].id;
    st().stopRecurringExpense(rid);
    expect(st().recurringExpenses).toHaveLength(1);
    expect(st().recurringExpenses![0].endDate).toBe(localToday());
  });

  it("une charge commune à virgule n'est plus arrondie (P1-3)", () => {
    st().startEmpty();
    const cat = st().expenseCategories.find((c) => !c.isDirect)!;
    st().setMonthlyCharge(cat.id, cat.name, 333.33, currentPeriod());
    expect(st().recurringExpenses![0].amount).toBe(333.33);
  });
});
