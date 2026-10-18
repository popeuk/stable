import { describe, expect, it } from "vitest";
import { billsFor, dueOf, monthsBefore } from "@/lib/domain/billing";
import { accord, chezEcurie, clientDues, messageDu, prenomDe } from "@/lib/domain/clients";
import type { StableData } from "@/lib/domain/types";

const oct = { year: 2026, month: 10 };

/** Hugo (Tonnerre, au mois), Emma (cavalière, à la séance), Paul (à jour), Inès. */
function data(payments: StableData["payments"] = []): StableData {
  return {
    horses: [
      { id: "h1", stableId: "s", name: "Tonnerre", ownerName: "Hugo L.", entryDate: "2026-01-01", isArchived: false },
      { id: "h2", stableId: "s", name: "Mistral", ownerName: "Paul D.", entryDate: "2026-01-01", isArchived: false },
      { id: "h3", stableId: "s", name: "Diva", ownerName: "Inès R.", entryDate: "2026-01-01", isArchived: false },
    ],
    revenues: [
      { id: "r1", stableId: "s", horseId: "h1", amount: 579, date: "2026-10-01", note: "Pension travail de Tonnerre", source: "recurring" },
      { id: "r2", stableId: "s", horseId: "h1", amount: 25, date: "2026-10-02", note: "Cours de Tonnerre", source: "manual", seanceId: "s1" },
      { id: "r3", stableId: "s", horseId: "h1", amount: 25, date: "2026-10-06", note: "Cours de Tonnerre", source: "manual", seanceId: "s2" },
      { id: "r4", stableId: "s", horseId: "", amount: 50, date: "2026-10-05", note: "Balade", source: "manual", payer: "Emma", seanceId: "b1" },
      { id: "r5", stableId: "s", horseId: "", amount: 50, date: "2026-10-12", note: "Balade", source: "manual", payer: "Emma", seanceId: "b2" },
      { id: "r6", stableId: "s", horseId: "h2", amount: 579, date: "2026-10-01", note: "Pension travail de Mistral", source: "recurring" },
      { id: "r7", stableId: "s", horseId: "h3", amount: 483, date: "2026-10-01", note: "Pension box + paddock de Diva", source: "recurring" },
      { id: "r8", stableId: "s", horseId: "h3", amount: 78, date: "2026-10-12", note: "Ferrure de Diva, refacturée", source: "manual", rebillOf: "e1" },
      { id: "r9", stableId: "s", horseId: "h1", amount: 579, date: "2026-09-01", note: "Pension travail de Tonnerre", source: "recurring" },
      { id: "r10", stableId: "s", horseId: "h1", amount: 100, date: "2026-09-10", note: "Cours de Tonnerre", source: "manual" },
    ],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    people: [
      { id: "p1", name: "Emma", role: "cavalier", active: true, paieALaSeance: true },
      { id: "p2", name: "Hugo L.", role: "proprietaire", active: true, phone: "06 12 48 33 70" },
      { id: "p3", name: "Lou", role: "cavalier", active: true, paieALaSeance: true },
    ],
    payments: [
      { id: "x1", payer: "Hugo L.", month: "2026-10", amount: 590, at: "" },
      { id: "x2", payer: "Paul D.", month: "2026-10", amount: 579, at: "" },
      { id: "x3", payer: "Hugo L.", month: "2026-09", amount: 679, at: "" },
      ...(payments ?? []),
    ],
  };
}

describe("ce que chaque client te doit", () => {
  it("dû = ce qui a compté ce mois moins ce qu'il a payé", () => {
    expect(dueOf(data(), "Hugo L.", oct)).toBe(39);
    expect(dueOf(data(), "Emma", oct)).toBe(100);
    expect(dueOf(data(), "Inès R.", oct)).toBe(561);
  });

  it("à jour : il ne te doit plus rien", () => {
    expect(dueOf(data(), "Paul D.", oct)).toBe(0);
  });

  it("paiement partiel : le reste, il te le doit encore", () => {
    const d = data([{ id: "x4", payer: "Inès R.", month: "2026-10", amount: 100, at: "" }]);
    const ines = billsFor(d, oct).find((b) => b.payer === "Inès R.")!;
    expect(ines.paid).toBe(100);
    expect(ines.due).toBe(461);
  });

  it("payé sur place : la séance est réglée, la ligne le dit", () => {
    const d = data([{ id: "x5", payer: "Emma", month: "2026-10", amount: 50, at: "", seanceId: "b1" }]);
    const emma = billsFor(d, oct).find((b) => b.payer === "Emma")!;
    expect(emma.due).toBe(50);
    expect(emma.lines.find((l) => l.seanceId === "b1")!.onSite).toBe(true);
    expect(emma.lines.find((l) => l.seanceId === "b2")!.onSite).toBeFalsy();
  });

  it("un payé sur place sans sa séance sur la note ne compte pas", () => {
    const d = data([{ id: "x6", payer: "Emma", month: "2026-10", amount: 50, at: "", seanceId: "inconnue" }]);
    expect(dueOf(d, "Emma", oct)).toBe(100);
  });

  it("chaque ligne garde l'id de sa recette, sa séance et son soin refacturé", () => {
    const ines = billsFor(data(), oct).find((b) => b.payer === "Inès R.")!;
    expect(ines.lines.map((l) => l.id).sort()).toEqual(["r7", "r8"]);
    expect(ines.lines.find((l) => l.id === "r8")!.rebillOf).toBe("e1");
  });
});

describe("la liste « Tes clients »", () => {
  it("ceux qui doivent d'abord, du plus gros au plus petit, puis les autres", () => {
    const list = clientDues(data(), oct);
    expect(list.map((c) => c.name)).toEqual(["Inès R.", "Emma", "Hugo L.", "Lou", "Paul D."]);
    expect(list.find((c) => c.name === "Emma")!.paieALaSeance).toBe(true);
    expect(list.find((c) => c.name === "Hugo L.")!.horses).toEqual(["Tonnerre"]);
    expect(list.find((c) => c.name === "Lou")!.due).toBe(0);
  });
});

describe("les mois d'avant", () => {
  it("total et payé par mois, les mois vides sautés", () => {
    const prev = monthsBefore(data(), "Hugo L.", oct);
    expect(prev).toEqual([{ period: { year: 2026, month: 9 }, total: 679, paid: 679, due: 0 }]);
  });
});

describe("les mots", () => {
  it("prénom, accord, écurie", () => {
    expect(prenomDe("Hugo L.")).toBe("Hugo");
    expect(accord("Inès R.", "Il", "Elle")).toBe("Elle");
    expect(accord("Hugo L.", "Il", "Elle")).toBe("Il");
    expect(accord("Kim", "Il", "Elle")).toBe("Il");
    expect(chezEcurie("Les Trois Pommiers")).toBe("aux Trois Pommiers");
    expect(chezEcurie("Le Clos")).toBe("au Clos");
  });

  it("le message tout prêt", () => {
    const d = data([{ id: "x5", payer: "Emma", month: "2026-10", amount: 50, at: "", seanceId: "b1" }]);
    const hugo = billsFor(d, oct).find((b) => b.payer === "Hugo L.")!;
    const msg = messageDu(hugo, oct, "Les Trois Pommiers", "Claire");
    expect(msg).toContain("Bonjour Hugo,");
    expect(msg).toContain("pour octobre aux Trois Pommiers");
    expect(msg).toContain("Pension travail de Tonnerre : 579 €");
    expect(msg).toContain("Cours de Tonnerre (2) : 50 €");
    expect(msg).toContain("Déjà payé : 590 €");
    expect(msg).toContain("Reste à payer : 39 €.");
    expect(msg.endsWith("Merci,\nClaire\nLes Trois Pommiers")).toBe(true);
    const emma = billsFor(d, oct).find((b) => b.payer === "Emma")!;
    const m2 = messageDu(emma, oct, "Les Trois Pommiers", "Claire");
    expect(m2).toContain("Balade : 50 €");
    expect(m2).not.toContain("Déjà payé");
  });
});

describe("les impayés d'avant, en mots", () => {
  const e = (n: number) => `${n} €`;
  it("« dont » seulement quand le mois en cours doit aussi", async () => {
    const { anciensEnMots } = await import("@/lib/domain/clients");
    expect(anciensEnMots({ anciens: [{ month: "2026-09", due: 120 }], dueMois: 0 }, oct, e)).toBe("120 € de septembre");
    expect(anciensEnMots({ anciens: [{ month: "2026-09", due: 120 }], dueMois: 450 }, oct, e)).toBe("dont 120 € de septembre");
    expect(anciensEnMots({ anciens: [{ month: "2026-08", due: 80 }, { month: "2026-09", due: 120 }], dueMois: 0 }, oct, e)).toBe("80 € d’août · 120 € de septembre");
  });
});
