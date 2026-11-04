import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import type { Palier } from "@/lib/domain/paliers";
import type { StableData } from "@/lib/domain/types";
import {
  anneeDuBilan,
  avancePrise,
  avecHypotheses,
  etatPalier,
  gainHypotheses,
  moisEntre,
  objectifTenu,
  pensionDuMois,
  pensionsPrevues,
  type MoisBilan,
} from "@/lib/domain/prevision";

// Des chiffres neutres : le dépôt est public, aucun vrai montant ici.
const PAL: Palier[] = [
  { nom: "Un", fin: "2026-12", seuil: 0, pensions: 2 },
  { nom: "Deux", fin: "2027-04", seuil: 1000, pensions: 3 },
  { nom: "Trois", fin: "2027-09", seuil: 2000, pensions: 4 },
];

const mois = (cle: string, etat: MoisBilan["etat"], reel: number | null, prevu: number | null): MoisBilan => ({
  cle,
  periode: { year: Number(cle.slice(0, 4)), month: Number(cle.slice(5, 7)) },
  etat,
  reel,
  prevu,
  valeur: etat === "passe" ? reel : prevu,
});

describe("le prévisionnel de Mon bilan", () => {
  it("le prix d'une pension suit ses changements programmés", () => {
    const h = { pension: 100, pensionType: "Pension", aVenir: [{ depuis: "2027-01", pension: 120 }, { depuis: "2027-03", pensionType: "À moi" }] };
    expect(pensionDuMois(h, "2026-12").pension).toBe(100);
    expect(pensionDuMois(h, "2027-02").pension).toBe(120);
    expect(pensionDuMois(h, "2027-03").formule).toBe("À moi");
  });

  it("les pensions attendues : les chevaux présents, sans ceux du gérant", () => {
    const base = buildDemoData(new Date("2026-11-04T10:00:00")) as StableData;
    const horses = [
      { ...base.horses[0], id: "a", pension: 100, pensionType: "Pension", entryDate: "2026-01-01", exitDate: null, isArchived: false, aVenir: undefined },
      { ...base.horses[0], id: "b", pension: 50, pensionType: "À moi", entryDate: "2026-01-01", exitDate: null, isArchived: false, aVenir: undefined },
      { ...base.horses[0], id: "c", pension: 70, pensionType: "Pension", entryDate: "2027-02-01", exitDate: null, isArchived: false, aVenir: undefined },
    ];
    const data = { ...base, horses, recurringRevenues: [] } as StableData;
    expect(pensionsPrevues(data, { year: 2027, month: 1 })).toBe(100);
    expect(pensionsPrevues(data, { year: 2027, month: 2 })).toBe(170);
  });

  it("l'année : deux mois passés, le mois en cours, onze mois à venir", () => {
    const data = buildDemoData(new Date("2026-11-04T10:00:00")) as StableData;
    const a = anneeDuBilan(data, { year: 2026, month: 11 }, 40);
    expect(a).toHaveLength(14);
    expect(a.map((m) => m.etat)).toEqual(["passe", "passe", "encours", ...Array(11).fill("avenir")]);
    expect(a[2].prevu).toBe((a[2].reel ?? 0) + 40);
    expect(a.slice(3).every((m) => typeof m.prevu === "number")).toBe(true);
    expect(a[13].cle).toBe("2027-10");
  });

  it("les « Et si » ne touchent que les mois à venir", () => {
    const a = [mois("2026-10", "passe", 10, null), mois("2026-11", "encours", 20, 30), mois("2026-12", "avenir", null, 40)];
    const h = { pensions: 1, coursParSemaine: 0, parPension: 5, parCours: 3 };
    expect(gainHypotheses(h)).toBe(5);
    const b = avecHypotheses(a, h);
    expect(b.map((m) => m.valeur)).toEqual([10, 30, 45]);
    expect(avecHypotheses(a, { ...h, pensions: 0 })).toBe(a);
  });

  it("l'avance prise : le réel au-dessus de l'objectif, depuis le premier mois qui a des chiffres", () => {
    const a = [mois("2026-09", "passe", null, null), mois("2026-10", "passe", 300, null), mois("2026-11", "encours", 200, 900), mois("2026-12", "avenir", null, 5000)];
    const r = avancePrise(a, PAL);
    expect(r).toEqual({ montant: 500, tenus: 2, comptes: 2, depuis: { year: 2026, month: 10 } });
  });

  it("l'état d'un palier : tenu, en avance, en retard ou trop loin", () => {
    const a = [
      mois("2026-10", "passe", 300, null),
      mois("2026-11", "encours", 200, 600),
      mois("2026-12", "avenir", null, 900),
      mois("2027-01", "avenir", null, 1100),
      mois("2027-10", "avenir", null, 1900),
    ];
    expect(etatPalier(a, PAL, 0)).toEqual({ etat: "tenu", depuis: "2026-10" });
    expect(etatPalier(a, PAL, 1)).toEqual({ etat: "avance", mois: "2027-01", ecart: 3 });
    expect(etatPalier(a, PAL, 2)).toEqual({ etat: "loin", meilleur: 1900, manque: 100 });
    const tard = [...a.slice(0, 4), mois("2027-10", "avenir", null, 2100)];
    expect(etatPalier(tard, PAL, 2)).toEqual({ etat: "retard", mois: "2027-10", ecart: 1 });
  });

  it("petites règles", () => {
    expect(moisEntre("2027-01", "2027-04")).toBe(3);
    expect(objectifTenu(0, 0)).toBe(false);
    expect(objectifTenu(1, 0)).toBe(true);
    expect(objectifTenu(1000, 1000)).toBe(true);
  });
});
