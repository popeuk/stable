import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { horsePnl, stablePnl } from "@/lib/domain/calculations";
import { horseTicket, monthBreakdown } from "@/lib/domain/ticket";
import { ensurePensions, moisEntre, premierMoisARattraper } from "@/lib/domain/autopilot";
import { buildRegister, registerPeriod } from "@/lib/domain/registre";
import { chevauxPresents, migrerSejours, presentDans } from "@/lib/domain/presence";
import { presenceDays } from "@/lib/domain/distribution";
import { avecSejours, changerArrivee, compteDepuis, compteJusquA, partirLe, revenirLe, sejours } from "@/lib/domain/sejours";
import type { Horse, StableData } from "@/lib/domain/types";

const NOW = new Date("2026-10-17T12:00:00");
const sep = { year: 2026, month: 9 };
const oct = { year: 2026, month: 10 };
const nov = { year: 2026, month: 11 };
const demo = () => buildDemoData(NOW);
const pachaId = (d: StableData) => d.horses.find((h) => h.name === "Pacha")!.id;
const avec = (d: StableData, h: Horse): StableData => ({ ...d, horses: d.horses.map((x) => (x.id === h.id ? h : x)) });
const belle = (d: StableData) => d.horses.find((h) => h.name === "Belle")!.id;

/** Le parcours de la recette : Pacha part le 17 octobre, revient le 5 novembre (noté ce jour-là). */
function departRetour() {
  const d0 = demo();
  const id = pachaId(d0);
  const parti = avec(d0, partirLe(d0.horses.find((h) => h.id === id)!, "2026-10-17", "2026-10-17", { destination: "Concours de Lamotte" }));
  const revenu = avec(parti, revenirLe(parti.horses.find((h) => h.id === id)!, "2026-11-05", "2026-11-05", { origin: "Concours de Lamotte" }));
  return { d0, parti, revenu, id };
}

describe("un cheval qui part puis revient garde toute son histoire (P1-3 recette 2)", () => {
  it("les tickets des mois passés ne bougent pas au retour, ni le sien ni ceux des autres", () => {
    const { parti, revenu, id } = departRetour();
    for (const p of [sep, oct]) {
      expect(horseTicket(revenu, id, p).net).toBe(horseTicket(parti, id, p).net);
      expect(horseTicket(revenu, belle(revenu), p).net).toBe(horseTicket(parti, belle(parti), p).net);
      expect(stablePnl(revenu, p).netResult).toBe(stablePnl(parti, p).netResult);
    }
  });

  it("le retour ajoute un séjour, le premier reste entier", () => {
    const { revenu, id } = departRetour();
    const h = revenu.horses.find((x) => x.id === id)!;
    expect(sejours(h)).toHaveLength(2);
    expect(sejours(h)[0]).toMatchObject({ entry: "2024-04-01", exit: "2026-10-17", destination: "Concours de Lamotte" });
    expect(sejours(h)[1]).toMatchObject({ entry: "2026-11-05", origin: "Concours de Lamotte" });
    expect(h).toMatchObject({ isArchived: false, exitDate: null, entryDate: "2026-11-05" });
  });

  it("il recompte en novembre : sa pension, sa part de l'assurance", () => {
    const { revenu, id } = departRetour();
    expect(presentDans(revenu.horses.find((x) => x.id === id)!, nov)).toBe(true);
    expect(ensurePensions(revenu, "2026-11-05").some((r) => r.horseId === id && r.date === "2026-11-05")).toBe(true);
    expect(chevauxPresents(revenu, nov).some((h) => h.id === id)).toBe(true);
  });

  it("le registre garde le 3e trimestre, la première entrée, la sortie et la nouvelle entrée avec sa provenance (P1-2)", () => {
    const { d0, revenu, id } = departRetour();
    const q3 = registerPeriod("trimestre", 2026, 3);
    const avant = buildRegister(d0, q3, "2026-11-05");
    const apres = buildRegister(revenu, q3, "2026-11-05");
    expect(apres.horses.map((h) => h.id)).toEqual(avant.horses.map((h) => h.id));
    expect(apres.care.length).toBe(avant.care.length);
    const q4 = buildRegister(revenu, registerPeriod("trimestre", 2026, 4), "2026-11-05");
    const ligne = q4.horses.find((h) => h.id === id)!;
    expect(ligne.entryDate).toBe("2024-04-01");
    expect(ligne.exitDate).toBeNull();
    const mv = q4.movements.filter((m) => m.horseId === id);
    expect(mv).toEqual([
      expect.objectContaining({ date: "2026-10-17", kind: "sortie", place: "Concours de Lamotte" }),
      expect.objectContaining({ date: "2026-11-05", kind: "entree", place: "Concours de Lamotte" }),
    ]);
    // Imprimé fin septembre, avant son retour : sa sortie y était définitive.
    const q4seul = buildRegister(revenu, { ...registerPeriod("trimestre", 2026, 4), end: "2026-10-31" }, "2026-11-05");
    expect(q4seul.horses.find((h) => h.id === id)!.exitDate).toBe("2026-10-17");
  });

  it("un retour le lendemain d'un départ de ce mois-ci annule le départ", () => {
    const h: Horse = { id: "h", stableId: "s", name: "P", entryDate: "2024-01-01", isArchived: false };
    const parti = partirLe(h, "2026-10-17", "2026-10-17");
    expect(revenirLe(parti, "2026-10-18", "2026-10-18")).toMatchObject({ isArchived: false, exitDate: null, stays: [{ entry: "2024-01-01" }] });
  });

  it("les jours de présence additionnent les séjours du mois", () => {
    const h = avecSejours({ id: "h", stableId: "s", name: "P", entryDate: "", isArchived: false }, [
      { entry: "2026-01-01", exit: "2026-10-10" },
      { entry: "2026-10-21" },
    ]);
    expect(presenceDays(h, oct)).toBe(10 + 11);
  });
});

describe("départ et retour datés dans le passé, sans réécrire ce qui est compté", () => {
  it("un départ daté d'un mois d'avant va tel quel au registre, l'argent s'arrête à la fin du mois dernier", () => {
    const d = demo();
    const id = pachaId(d);
    const sepAvant = horseTicket(d, id, sep).net;
    const h = partirLe(d.horses.find((x) => x.id === id)!, "2026-09-20", "2026-10-17");
    expect(h.exitDate).toBe("2026-09-20");
    expect(sejours(h)[0].countUntil).toBe("2026-09-30");
    const d2 = avec(d, h);
    // Septembre ne bouge pas : il y était compté tout le mois.
    expect(horseTicket(d2, id, sep).net).toBe(sepAvant);
    expect(chevauxPresents(d2, oct).some((x) => x.id === id)).toBe(false);
  });
  it("les bornes : jamais avant l'arrivée, jamais après aujourd'hui", () => {
    const h: Horse = { id: "h", stableId: "s", name: "P", entryDate: "2026-10-05", isArchived: false };
    expect(partirLe(h, "2026-09-01", "2026-10-17").exitDate).toBe("2026-10-05");
    expect(partirLe(h, "2026-12-01", "2026-10-17").exitDate).toBe("2026-10-17");
    expect(compteDepuis("2026-08-01", "2026-10-17")).toBe("2026-10-01");
    expect(compteDepuis("2026-10-03", "2026-10-17")).toBe("2026-10-03");
    expect(compteJusquA("2026-09-20", "2026-10-17")).toBe("2026-09-30");
  });
  it("un retour daté d'un mois d'avant ne remet pas le cheval dans ce mois-là", () => {
    const h: Horse = { id: "h", stableId: "s", name: "P", entryDate: "2024-01-01", exitDate: "2026-09-10", isArchived: true };
    const back = revenirLe(h, "2026-10-02", "2026-11-05");
    expect(back.entryDate).toBe("2026-10-02");
    expect(presentDans(back, oct)).toBe(false);
    expect(presentDans(back, nov)).toBe(true);
  });
});

describe("arrivée datée dans le passé (P2-1 recette 2) : il compte à partir de ce mois-ci", () => {
  it("Retardataire arrivé le 15 septembre, ajouté le 17 octobre : septembre ne bouge pas, octobre a sa pension et sa part", () => {
    const d = demo();
    const ret = avecSejours({ id: "ret", stableId: "s", name: "Retardataire", entryDate: "2026-09-15", isArchived: false, pension: 400 }, [
      { entry: "2026-09-15", countFrom: compteDepuis("2026-09-15", "2026-10-17") },
    ]);
    const d2 = { ...d, horses: [...d.horses, ret] };
    expect(stablePnl(d2, sep).perHorse.some((p) => p.horseId === "ret")).toBe(false);
    expect(horseTicket(d2, belle(d2), sep).net).toBe(horseTicket(d, belle(d), sep).net);
    expect(monthBreakdown(d2, sep).net).toBe(monthBreakdown(d, sep).net);
    const pensions = ensurePensions(d2, "2026-10-17");
    expect(pensions.filter((r) => r.horseId === "ret")).toEqual([expect.objectContaining({ amount: 400, date: "2026-10-01" })]);
    const d3 = { ...d2, revenues: [...d2.revenues, ...pensions] };
    expect(horsePnl(d3, "ret", oct).sharedCosts).toBeGreaterThan(0);
    // Le registre garde la vraie date.
    expect(buildRegister(d3, registerPeriod("trimestre", 2026, 3), "2026-10-17").horses.some((h) => h.id === "ret")).toBe(true);
  });
  it("corriger sa date d'arrivée plus tôt ne le remet pas dans les mois d'avant", () => {
    const h = avecSejours({ id: "h", stableId: "s", name: "P", entryDate: "", isArchived: false }, [{ entry: "2026-10-10" }]);
    const plusTot = changerArrivee(h, "2026-06-01", "2026-10-17");
    expect(plusTot.entryDate).toBe("2026-06-01");
    expect(presentDans(plusTot, sep)).toBe(false);
    expect(presentDans(plusTot, oct)).toBe(true);
    // Un cheval déjà compté depuis longtemps garde ses mois passés.
    const ancien = avecSejours({ id: "a", stableId: "s", name: "A", entryDate: "", isArchived: false }, [{ entry: "2024-01-01" }]);
    expect(presentDans(changerArrivee(ancien, "2026-10-05", "2026-10-17"), sep)).toBe(true);
  });
});

describe("pensions des mois où l'app n'a pas été ouverte (P2-6)", () => {
  it("ouverte le 5 janvier après le 20 octobre : novembre, décembre et janvier sont postés, une fois", () => {
    const d = demo();
    const depuis = premierMoisARattraper(d, "2027-01-05");
    expect(depuis).toBe("2026-10");
    const out = ensurePensions(d, "2027-01-05", [], depuis);
    const mois = [...new Set(out.map((r) => r.date.slice(0, 7)))].sort();
    expect(mois).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(out.length).toBe(9 * 3);
    // Sans doublon à la réouverture.
    const d2 = { ...d, revenues: [...d.revenues, ...out] };
    expect(ensurePensions(d2, "2027-01-05", [], depuis)).toEqual([]);
  });
  it("une pension retirée à la main ne revient pas", () => {
    const d = demo();
    const out = ensurePensions(d, "2026-12-02", ["rev-pension-horse-0-2026-11"], "2026-10");
    expect(out.some((r) => r.id === "rev-pension-horse-0-2026-11")).toBe(false);
    expect(out.some((r) => r.id === "rev-pension-horse-0-2026-12")).toBe(true);
  });
  it("un cheval parti en novembre n'a pas de pension en décembre", () => {
    const d = demo();
    const id = pachaId(d);
    const d2 = avec(d, partirLe(d.horses.find((h) => h.id === id)!, "2026-11-10", "2026-11-10"));
    const out = ensurePensions(d2, "2026-12-02", [], "2026-10");
    expect(out.filter((r) => r.horseId === id).map((r) => r.date)).toEqual(["2026-11-01"]);
  });
  it("les mois rattrapés : deux ans au plus", () => {
    expect(moisEntre("2026-10", "2027-01")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
    expect(moisEntre(undefined, "2027-01")).toEqual(["2027-01"]);
    expect(moisEntre("2020-01", "2027-01")).toHaveLength(24);
  });
});

describe("migration des séjours depuis 0b59437 et 7413595", () => {
  it("v3 (0b59437) : arrivée, départ et identité deviennent un séjour, l'argent ne bouge pas", () => {
    const d = demo();
    const id = pachaId(d);
    const v3 = { ...d, horses: d.horses.map((h) => (h.id === id ? { ...h, isArchived: true, exitDate: "2026-10-16" } : h)) };
    const m = migrerSejours(v3);
    expect(m.horses.find((h) => h.id === id)!.stays).toEqual([{ entry: "2024-04-01", exit: "2026-10-16" }]);
    for (const p of [sep, oct, nov]) expect(stablePnl(m, p)).toEqual(stablePnl(v3, p));
  });
  it("v4 (7413595) : provenance, destination et motifs passent au séjour", () => {
    const h: Horse = { id: "h", stableId: "s", name: "P", entryDate: "2025-02-01", exitDate: "2026-10-01", isArchived: true, origin: "Haras du Pin", entryReason: "pension", destination: "Écurie du Lac", exitReason: "vente", sireNumber: "250001" };
    const m = migrerSejours({ ...demo(), horses: [h] });
    expect(m.horses[0].stays).toEqual([{ entry: "2025-02-01", exit: "2026-10-01", origin: "Haras du Pin", entryReason: "pension", destination: "Écurie du Lac", exitReason: "vente" }]);
    expect(m.horses[0]).toMatchObject({ sireNumber: "250001", origin: "Haras du Pin", isArchived: true });
    // Un cheval archivé sans date (f143725) reçoit sa date d'abord.
    const flou = migrerSejours<StableData>({ ...demo(), horses: [{ id: "x", stableId: "s", name: "X", entryDate: "2025-03-01", exitDate: null, isArchived: true }] });
    expect(flou.horses[0].stays).toEqual([{ entry: "2025-03-01", exit: "2025-03-01" }]);
  });
});
