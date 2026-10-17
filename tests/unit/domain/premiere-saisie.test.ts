import { describe, expect, it } from "vitest";
import { aDejaSaisi, nouvelleSaisie } from "@/lib/premiere-saisie";

type C = Parameters<typeof aDejaSaisi>[0];
const cheval = (id: string, name: string, ownerName?: string) => ({ id, name, ownerName, stableId: "s", isArchived: false }) as C["horses"][number];
const pension = { id: "rev1", stableId: "s", horseId: "h1", amount: 450, date: "2026-10-01", source: "recurring" } as C["revenues"][number];

/** L'écurie juste après le parcours : des chevaux, leurs pensions postées, les frais en un total. */
const apresParcours = (): C => ({
  horses: [cheval("h1", "Cheval 1"), cheval("h2", "Cheval 2")],
  revenues: [pension],
  directExpenses: [],
  sharedExpenses: [],
  recurringExpenses: [{ id: "rec1" } as NonNullable<C["recurringExpenses"]>[number]],
  seances: [],
  payments: [],
  tasks: [],
  careEvents: [],
  rhythms: [],
});

describe("la première vraie saisie", () => {
  it("le parcours seul ne compte pas : chevaux, pensions de l'autopilote, frais de l'écurie", () => {
    expect(aDejaSaisi(apresParcours())).toBe(false);
  });

  it("une séance, un paiement, un soin, une tâche ou une dépense notés comptent", () => {
    const a = apresParcours();
    expect(nouvelleSaisie(a, { ...a, seances: [{ id: "s1" } as never] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, payments: [{ id: "p1" } as never] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, careEvents: [{ id: "c1" } as never] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, tasks: [{ id: "t1" } as never] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, directExpenses: [{ id: "d1" } as never] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, sharedExpenses: [{ id: "sh1" } as never] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, revenues: [...a.revenues, { ...pension, id: "rev2", source: "manual" }] })).toBe(true);
  });

  it("un cheval renommé, ajouté ou qui reçoit son propriétaire compte", () => {
    const a = apresParcours();
    expect(nouvelleSaisie(a, { ...a, horses: [cheval("h1", "Tornado"), a.horses[1]] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, horses: [...a.horses, cheval("h3", "Ulysse")] })).toBe(true);
    expect(nouvelleSaisie(a, { ...a, horses: [cheval("h1", "Cheval 1", "Hugo L."), a.horses[1]] })).toBe(true);
  });

  it("l'autopilote ne compte pas : une pension de plus le mois suivant", () => {
    const a = apresParcours();
    expect(nouvelleSaisie(a, { ...a, revenues: [...a.revenues, { ...pension, id: "rev2", date: "2026-11-01" }] })).toBe(false);
  });

  it("un carnet remplacé en entier (autre écurie, chargement) ne compte pas", () => {
    const a = apresParcours();
    const autre: C = { ...a, horses: [cheval("x1", "Pirate")], seances: [{ id: "s9" } as never] };
    expect(nouvelleSaisie(a, autre)).toBe(false);
  });

  it("une écurie déjà utilisée avant le changement garde son bandeau", () => {
    expect(aDejaSaisi({ ...apresParcours(), seances: [{ id: "s1" } as never] })).toBe(true);
  });
});
