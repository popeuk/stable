import { describe, expect, it } from "vitest";
import { dayItems, isEmptySeance, revenuesForSeance, seanceAmount, seanceToValidate, toValidate } from "@/lib/domain/seances";
import { paniers } from "@/lib/domain/paniers";
import { monthBreakdown } from "@/lib/domain/ticket";
import type { Seance, StableData } from "@/lib/domain/types";

const vide: Seance = {
  id: "v1", prestationId: "p", title: "Cours collectif", format: "collectif", places: 6,
  participants: [], horseIds: [], date: "2026-10-10", start: "18:00", end: "19:00", status: "planned", unitPrice: 25, rev: 1,
};

const data = (seances: Seance[], extra: Partial<StableData> = {}): StableData => ({
  horses: [{ id: "h1", stableId: "s", name: "Sirius", entryDate: "2026-01-01", isArchived: false, ownerName: "Léa" }],
  revenues: [], directExpenses: [], sharedExpenses: [], revenueCategories: [{ id: "c", name: "Cours" }], expenseCategories: [],
  people: [{ id: "p1", name: "Emma", role: "cavalier", active: true }],
  seances,
  ...extra,
});

describe("séance sans cavalier ni cheval", () => {
  it("ne rapporte rien et n'attend aucune validation", () => {
    expect(isEmptySeance(vide)).toBe(true);
    expect(seanceAmount(vide)).toBe(0);
    expect(seanceToValidate(vide, "2026-10-11", "08:00")).toBe(false);
    const d = data([vide]);
    expect(toValidate(d, "2026-10-11", "08:00")).toHaveLength(0);
    expect(paniers(d, "2026-10-11", "08:00")).toHaveLength(0);
  });

  it("validée quand même, elle ne crée aucune recette", () => {
    let n = 0;
    expect(revenuesForSeance({ ...vide, status: "done" }, data([]), () => `r${n++}`, "st")).toEqual([]);
  });

  it("apparaît dans la journée, places libres", () => {
    const [it] = dayItems(data([vide]), "2026-10-10", "2026-10-10", "12:00");
    expect(it.title).toBe("Cours collectif");
    expect(it.sub).toContain("personne d’inscrit pour l’instant");
    expect(it.sub).toContain("6 places libres");
    expect(it.money).toBeUndefined();
  });

  it("un inscrit sans cheval : la recette est à lui, hors des tickets", () => {
    const s: Seance = { ...vide, participants: [{ personId: "p1" }], status: "done" };
    expect(seanceAmount(s)).toBe(25);
    let n = 0;
    const revs = revenuesForSeance(s, data([]), () => `r${n++}`, "st");
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ horseId: "", payer: "Emma", amount: 25 });
    const m = monthBreakdown(data([], { revenues: revs }), { year: 2026, month: 10 });
    expect(m.net).toBe(25);
  });
});

describe("rendez-vous", () => {
  it("apparaît dans la journée à son heure, avec sa fin et son lieu", () => {
    const d = data([], {
      taskLists: [{ id: "l1", title: "À faire" }, { id: "l2", title: "Fait", isDone: true }],
      tasks: [
        { id: "t1", kind: "rdv", title: "Visite du véto", listId: "l1", labels: [], forWho: [], due: "2026-10-10T14:30", end: "15:15", lieu: "Dr Martin", checklist: [], comments: [], sort: 1 },
        // Une ancienne carte sans `kind` : une tâche.
        { id: "t2", title: "Clôture", listId: "l1", labels: [], forWho: [], due: "2026-10-10", checklist: [], comments: [], sort: 2 },
      ],
    });
    const its = dayItems(d, "2026-10-10", "2026-10-10", "08:00");
    const rdv = its.find((i) => i.key === "t1")!;
    expect(rdv).toMatchObject({ type: "task", start: "14:30", end: "15:15" });
    expect(rdv.sub).toContain("Dr Martin");
    const t = its.find((i) => i.key === "t2")!;
    expect(t.start).toBeUndefined();
    expect(t.end).toBeUndefined();
  });
});
