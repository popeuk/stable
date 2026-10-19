import { describe, expect, it } from "vitest";
import { changerProprio, partPension } from "@/lib/domain/proprio";
import { billsFor } from "@/lib/domain/billing";
import type { Invoice, StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };

/** Willow, 390 € de pension en octobre, à Julien ; il passe à Anne le 15. */
function data(): StableData {
  return {
    horses: [{ id: "h1", stableId: "s", name: "Willow", entryDate: "2024-01-01", isArchived: false, ownerName: "Julien B.", pension: 390 }],
    revenues: [
      { id: "rev-pension-h1-2026-10", stableId: "s", horseId: "h1", categoryId: "cp", amount: 390, date: "2026-10-01", source: "recurring" },
      { id: "c1", stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: "2026-10-08", source: "manual" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [
      { id: "cp", name: "Pension" },
      { id: "cc", name: "Cours" },
    ],
    expenseCategories: [],
    people: [{ id: "p1", name: "Julien B.", role: "proprietaire", active: true }],
  };
}
const du = (d: StableData, qui: string) => billsFor(d, oct).find((b) => b.payer === qui)?.total ?? 0;

describe("un cheval change de propriétaire en cours de mois", () => {
  it("la pension se partage au prorata des jours : Julien du 1er au 14, Anne du 15 au 31", () => {
    const c = changerProprio(data(), "h1", "Anne M.", "2026-10-15", () => "p2");
    const d = { ...data(), ...c };
    // 14 jours sur 31 : 176,13 € ; le reste, 213,87 €.
    expect(du(d, "Julien B.")).toBe(r(176.13 + 25));
    expect(du(d, "Anne M.")).toBe(213.87);
    expect(du(d, "Julien B.") + du(d, "Anne M.")).toBe(415);
    expect(c.revenues.find((x) => x.id === "rev-pension-h1-2026-10")?.note).toBe("Pension du 1er au 14 octobre");
    expect(c.added[0]).toMatchObject({ id: "rev-pension-h1-2026-10-suite", note: "Pension du 15 au 31 octobre", date: "2026-10-15" });
  });

  it("déjà facturée, la pension reste en entier à l'ancien", () => {
    const inv = { id: "i1", number: "2026-0001", payer: "Julien B.", month: "2026-10", revenueIds: ["rev-pension-h1-2026-10"], lines: [] } as unknown as Invoice;
    const d0 = { ...data(), invoices: [inv] };
    const c = changerProprio(d0, "h1", "Anne M.", "2026-10-15", () => "p2");
    const d = { ...d0, ...c };
    expect(du(d, "Julien B.")).toBe(415);
    expect(du(d, "Anne M.")).toBe(0);
    expect(c.added).toEqual([]);
  });

  it("changé le 1er : tout le mois au nouveau", () => {
    const c = changerProprio(data(), "h1", "Anne M.", "2026-10-01", () => "p2");
    const d = { ...data(), ...c };
    expect(du(d, "Anne M.")).toBe(415);
    expect(du(d, "Julien B.")).toBe(0);
  });

  it("un cheval arrivé le 10 : le prorata compte à partir de son arrivée", () => {
    expect(partPension({ id: "rev-pension-h1-2026-10", amount: 220, date: "2026-10-10" }, "h1", "2026-10-21")).toMatchObject({ ancien: 110, nouveau: 110 });
  });

  it("une pension d'un autre mois ne se partage pas", () => {
    expect(partPension({ id: "rev-pension-h1-2026-09", amount: 390, date: "2026-09-01" }, "h1", "2026-10-15")).toBeNull();
  });
});

function r(n: number) {
  return Math.round(n * 100) / 100;
}
