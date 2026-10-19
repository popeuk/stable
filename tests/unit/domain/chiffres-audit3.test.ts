import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { stablePnl } from "@/lib/domain/calculations";
import { partEnMots, reconciledNets, monthBreakdown } from "@/lib/domain/ticket";
import { chevauxDuMois, chevauxPresents } from "@/lib/domain/presence";
import { brouillon, totaux } from "@/lib/domain/facture";
import { avecSejours, partirLe } from "@/lib/domain/sejours";
import type { BillingInfo, Horse, StableData } from "@/lib/domain/types";

const NOW = new Date("2026-10-17T12:00:00");
const sep = { year: 2026, month: 9 };
const oct = { year: 2026, month: 10 };
const demo = () => buildDemoData(NOW);
const avec = (d: StableData, h: Horse): StableData => ({ ...d, horses: d.horses.map((x) => (x.id === h.id ? h : x)) });

describe("le mois d'un départ : un seul diviseur partout (P2-6 recette 2)", () => {
  const d0 = demo();
  const pacha = d0.horses.find((h) => h.name === "Pacha")!;
  const d = avec(d0, partirLe(pacha, "2026-10-17", "2026-10-17"));
  it("Chevaux, frais communs et fiche comptent les 9 chevaux d'octobre, comme Mon bilan", () => {
    expect(chevauxDuMois(d, oct)).toHaveLength(9);
    expect(chevauxPresents(d, oct)).toHaveLength(9);
    const nets = reconciledNets(d, oct);
    const somme = chevauxDuMois(d, oct).reduce((t, h) => t + nets[h.id], 0);
    expect(somme).toBe(Math.round(stablePnl(d, oct).horsesNet));
    expect(monthBreakdown(d, oct).horseCount).toBe(9);
  });
  it("sa fiche dit « ÷ 9 » en octobre (une part entière, même parti le 17) et en septembre", () => {
    expect(partEnMots(d, pacha.id, oct)).toBe("÷ 9 : une part entière, même parti le 17 oct.");
    expect(partEnMots(d, pacha.id, sep)).toBe("÷ 9");
    const belle = d.horses.find((h) => h.name === "Belle")!;
    expect(partEnMots(d, belle.id, oct)).toBe("÷ 9");
  });
  it("un mois passé dit le nombre de chevaux de ce mois-là, pas celui d'aujourd'hui", () => {
    const seul: StableData = {
      ...d0,
      horses: [
        avecSejours({ id: "a", stableId: "s", name: "A", entryDate: "", isArchived: false }, [{ entry: "2026-01-01" }]),
        avecSejours({ id: "b", stableId: "s", name: "B", entryDate: "", isArchived: false }, [{ entry: "2026-10-01" }]),
      ],
    };
    expect(partEnMots(seul, "a", sep)).toBe("÷ 1");
    expect(partEnMots(seul, "a", oct)).toBe("÷ 2");
  });
  it("arrivé en cours de mois, réparti selon les jours : au prorata de ses jours", () => {
    const d2: StableData = {
      ...d0,
      horses: [
        avecSejours({ id: "a", stableId: "s", name: "A", entryDate: "", isArchived: false }, [{ entry: "2026-01-01" }]),
        avecSejours({ id: "b", stableId: "s", name: "B", entryDate: "", isArchived: false }, [{ entry: "2026-10-22" }]),
      ],
      recurringExpenses: [{ id: "r", stableId: "s", label: "Foin", amount: 310, isShared: true, distributionMode: "weighted_by_days", frequency: "monthly", startDate: "2026-01-01", source: "manual" }],
      sharedExpenses: [],
    };
    expect(partEnMots(d2, "b", oct)).toBe("selon ses 10 jours ici");
  });
});

describe("facture : la quantité fois le prix unitaire imprimé (P3)", () => {
  it("4 cours à 25 € TTC en TVA 5,5 % : 23,70 € l'unité, 94,80 € hors taxes", () => {
    const billing: BillingInfo = { vat: "taux", rates: { pension: 20, cours: 5.5, soins: 20, autre: 10 } };
    const d: StableData = {
      horses: [{ id: "h1", stableId: "s", name: "Tonnerre", entryDate: "2024-01-01", isArchived: false, ownerName: "Hugo L." }],
      revenues: [1, 2, 3, 4].map((i) => ({ id: `c${i}`, stableId: "s", horseId: "h1", categoryId: "cc", amount: 25, date: `2026-10-0${i}`, source: "manual" as const, payer: "Hugo L.", seanceId: `s${i}` })),
      directExpenses: [],
      sharedExpenses: [],
      revenueCategories: [{ id: "cc", name: "Cours" }],
      expenseCategories: [],
      people: [{ id: "p", name: "Hugo L.", role: "proprietaire", active: true, statut: "particulier", address: "3 allée des Saules", nomComplet: "Hugo Durand" }],
      billing,
    };
    const f = brouillon(d, "Hugo L.", oct).facture!;
    const l = f.lines[0];
    expect(l).toMatchObject({ qty: 4, unitHT: 23.7, totalHT: 94.8, totalTTC: 100 });
    expect(f.totalHT).toBe(94.8);
    expect(f.vat).toEqual([{ rate: 5.5, base: 94.8, amount: 5.2 }]);
    expect(f.totalTTC).toBe(100);
    // Sans total HT de ligne (anciennes factures), le calcul d'avant reste.
    expect(totaux([{ rate: 5.5, totalTTC: 100 }]).totalHT).toBe(94.79);
  });
});

describe("le fichier du comptable suit les séjours", () => {
  it("une recette notée « tous les mois » sur un cheval qui a un propriétaire : rien entre deux séjours, datée du retour", async () => {
    const { lignesComptables } = await import("@/lib/domain/comptable");
    const h = avecSejours({ id: "h", stableId: "s", name: "Pacha", entryDate: "", isArchived: false, ownerName: "Julie P." }, [
      { entry: "2024-01-01", exit: "2026-09-10" },
      { entry: "2026-11-05" },
    ]);
    const d: StableData = {
      horses: [h],
      revenues: [],
      directExpenses: [],
      sharedExpenses: [],
      revenueCategories: [{ id: "cp", name: "Pension" }],
      expenseCategories: [],
      recurringRevenues: [{ id: "rr", stableId: "s", horseId: "h", categoryId: "cp", amount: 400, frequency: "monthly", startDate: "2026-01-01", source: "manual" }],
    };
    // Notée par le gérant « tous les mois », elle est réelle : une ligne par mois où le cheval était là.
    const dates = lignesComptables(d, 2026, "2026-12-31").filter((l) => l.type === "Recette").map((l) => l.date);
    expect(dates.some((x) => x.startsWith("2026-10"))).toBe(false);
    expect(dates).toContain("2026-11-05");
    expect(dates.some((x) => x.startsWith("2026-09"))).toBe(true);
    expect(dates).toHaveLength(11);
  });
});
