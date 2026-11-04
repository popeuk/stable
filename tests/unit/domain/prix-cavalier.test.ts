import { describe, expect, it } from "vitest";
import { clePrix, prixDe, prixDuCavalier, prixVaries, revenuesForSeance, seanceAmount } from "@/lib/domain/seances";
import type { Seance } from "@/lib/domain/types";

const seance = (extra: Partial<Seance> = {}): Seance =>
  ({
    id: "s1",
    prestationId: "cours",
    title: "Collectif",
    format: "collectif",
    participants: [
      { personId: "coleen", present: true, prix: 20 },
      { personId: "sarah", present: true, prix: 35 },
      { personId: "anais", present: true },
    ],
    horseIds: [],
    date: "2026-11-10",
    start: "18:00",
    end: "19:00",
    status: "done",
    unitPrice: 30,
    rev: 1,
    ...extra,
  }) as Seance;

const data = { people: [{ id: "coleen", name: "Coleen", role: "cavalier", active: true }, { id: "sarah", name: "Sarah", role: "cavalier", active: true }, { id: "anais", name: "Anaïs", role: "cavalier", active: true }], revenueCategories: [{ id: "c", name: "Cours" }] } as never;

describe("le prix de chaque cavalier", () => {
  it("le prix du cavalier, sinon celui du cours", () => {
    expect(clePrix("cours", "collectif")).toBe("cours:collectif");
    expect(clePrix("travail")).toBe("travail");
    const p = { prix: { "cours:collectif": 35, cours: 45 } };
    expect(prixDuCavalier(p, "cours", "collectif")).toBe(35);
    expect(prixDuCavalier(p, "cours", "particulier")).toBe(45);
    expect(prixDuCavalier({}, "cours", "collectif")).toBeUndefined();
    expect(prixDuCavalier(undefined, "cours")).toBeUndefined();
    expect(prixDe({ unitPrice: 30 }, {})).toBe(30);
    expect(prixDe({ unitPrice: 30 }, { prix: 0 })).toBe(0);
  });

  it("une séance compte le prix de chacun", () => {
    const s = seance();
    expect(prixVaries(s)).toBe(true);
    expect(seanceAmount(s)).toBe(85);
    const r = revenuesForSeance(s, data, (() => { let n = 0; return () => `r${n++}`; })(), "st");
    expect(r.map((x) => [x.payer, x.amount])).toEqual([
      ["Coleen", 20],
      ["Sarah", 35],
      ["Anaïs", 30],
    ]);
  });

  it("un absent non facturé, un forfait ou un prix à 0 ne paient pas", () => {
    const s = seance({
      participants: [
        { personId: "coleen", present: false, prix: 20 },
        { personId: "sarah", present: true, prix: 35, forfait: true },
        { personId: "anais", present: true, prix: 0 },
      ],
    });
    expect(seanceAmount(s)).toBe(0);
    expect(revenuesForSeance(s, data, () => "r", "st")).toEqual([]);
  });

  it("une séance sans prix de cavalier garde son prix unique", () => {
    const s = seance({ participants: [{ personId: "anais", present: true }, { personId: "coleen", present: true }] });
    expect(prixVaries(s)).toBe(false);
    expect(seanceAmount(s)).toBe(60);
  });
});
