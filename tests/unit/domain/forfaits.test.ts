import { describe, expect, it } from "vitest";
import { couvreMois, echeances, ensureForfaits, forfaitDe, marquerForfaits, moisPlus } from "@/lib/domain/forfaits";
import { payingCount, revenuesForSeance, seanceAmount } from "@/lib/domain/seances";
import { billsFor } from "@/lib/domain/billing";
import type { Abonnement, Seance, StableData } from "@/lib/domain/types";

const annee: Abonnement = {
  id: "a1",
  personId: "lea",
  prestationId: "cours",
  kind: "annee",
  amount: 660,
  fois: 3,
  mois: 10,
  debut: "2026-09",
};
const mois: Abonnement = {
  id: "a2",
  personId: "tom",
  prestationId: "cours",
  kind: "mois",
  amount: 55,
  debut: "2026-09",
};

describe("forfaits : les échéances", () => {
  it("compte les mois, année comprise", () => {
    expect(moisPlus("2026-09", 4)).toBe("2027-01");
    expect(moisPlus("2026-01", -1)).toBe("2025-12");
  });

  it("une année en trois fois se paie par trimestre de saison : septembre, décembre, mars", () => {
    expect(echeances(annee, "2027-12")).toEqual([
      ["2026-09", 220, 1],
      ["2026-12", 220, 2],
      ["2027-03", 220, 3],
    ]);
  });

  it("le reste des centimes va sur la dernière échéance", () => {
    const e = echeances({ ...annee, amount: 100, fois: 3 }, "2027-12");
    expect(e.map((x) => x[1])).toEqual([33.33, 33.33, 33.34]);
  });

  it("une année en dix fois fait une échéance par mois de la saison, puis plus rien", () => {
    const e = echeances({ ...annee, fois: 10 }, "2027-12");
    expect(e).toHaveLength(10);
    expect(e[9][0]).toBe("2027-06");
    expect(e.every((x) => x[1] === 66)).toBe(true);
  });

  it("un forfait au mois court jusqu'à aujourd'hui, ou jusqu'à sa fin", () => {
    expect(echeances(mois, "2026-11")).toHaveLength(3);
    expect(echeances({ ...mois, fin: "2026-10" }, "2027-03")).toHaveLength(2);
  });

  it("ne couvre que ses mois", () => {
    expect(couvreMois(annee, "2027-06")).toBe(true);
    expect(couvreMois(annee, "2027-07")).toBe(false);
    expect(couvreMois(annee, "2026-08")).toBe(false);
    expect(forfaitDe([annee], "lea", "cours", "2026-10-14")?.id).toBe("a1");
    expect(forfaitDe([annee], "lea", "autre", "2026-10-14")).toBeUndefined();
  });
});

describe("forfaits : postés comme les pensions, payés par le cavalier", () => {
  const base = {
    abonnements: [annee, mois],
    people: [
      { id: "lea", name: "Léa M.", role: "cavalier" as const, active: true },
      { id: "tom", name: "Tom B.", role: "cavalier" as const, active: true },
    ],
    prestations: [{ id: "cours", label: "Cours collectif", price: 25, active: true }],
    revenueCategories: [{ id: "c-cours", name: "Cours" }],
  };

  it("poste les échéances du mois, une seule fois", () => {
    const r = ensureForfaits({ ...base, revenues: [] }, "2026-09-12", "s");
    expect(r.map((x) => [x.payer, x.amount, x.note])).toEqual([
      ["Léa M.", 220, "Cours collectif, forfait annuel (1/3)"],
      ["Tom B.", 55, "Cours collectif, forfait au mois"],
    ]);
    expect(r.every((x) => x.horseId === "" && x.categoryId === "c-cours" && x.date === "2026-09-01")).toBe(true);
    expect(ensureForfaits({ ...base, revenues: r }, "2026-09-20", "s")).toHaveLength(0);
  });

  it("rattrape les mois sans ouverture, sans revenir sur une ligne retirée", () => {
    const r = ensureForfaits({ ...base, revenues: [] }, "2026-11-02", "s", ["rev-forfait-a2-2026-10"], "2026-09");
    expect(r.filter((x) => x.payer === "Tom B.").map((x) => x.date)).toEqual(["2026-09-01", "2026-11-01"]);
  });

  it("arrive sur la note du cavalier", () => {
    const revenues = ensureForfaits({ ...base, revenues: [] }, "2026-09-12", "s");
    const data = {
      horses: [],
      revenues,
      payments: [],
      people: base.people,
      revenueCategories: base.revenueCategories,
    } as unknown as StableData;
    const lea = billsFor(data, { year: 2026, month: 9 }).find((b) => b.payer === "Léa M.");
    expect(lea?.total).toBe(220);
    expect(lea?.role).toBe("cavalier");
  });
});

describe("forfaits : la séance ne fait pas payer deux fois", () => {
  const seance: Seance = {
    id: "s1",
    prestationId: "cours",
    title: "Cours du mardi",
    participants: [{ personId: "lea" }, { personId: "emma" }],
    horseIds: [],
    date: "2026-10-13",
    start: "18:00",
    end: "19:00",
    status: "planned",
    unitPrice: 25,
    rev: 1,
  };

  it("marque le cavalier au forfait et ne compte que l'autre", () => {
    const m = marquerForfaits(seance, [annee]);
    expect(m.participants).toEqual([{ personId: "lea", forfait: true }, { personId: "emma" }]);
    expect(payingCount(m)).toBe(1);
    expect(seanceAmount(m)).toBe(25);
  });

  it("une fois faite, seul le cavalier à la séance a une recette", () => {
    const done = {
      ...marquerForfaits(seance, [annee]),
      status: "done" as const,
      participants: [
        { personId: "lea", forfait: true, present: true },
        { personId: "emma", present: true },
      ],
    };
    const revs = revenuesForSeance(
      done,
      {
        people: [{ id: "emma", name: "Emma", role: "cavalier" }],
        revenueCategories: [{ id: "c", name: "Cours" }],
      } as never,
      () => "r",
      "s",
    );
    expect(revs.map((r) => r.payer)).toEqual(["Emma"]);
  });

  it("hors de sa saison, le cavalier repaie à la séance", () => {
    const m = marquerForfaits({ ...seance, date: "2027-07-06" }, [annee]);
    expect(m.participants.some((p) => p.forfait)).toBe(false);
  });

  it("ne change rien quand il n'y a rien à marquer", () => {
    expect(marquerForfaits(seance, [])).toBe(seance);
  });
});
