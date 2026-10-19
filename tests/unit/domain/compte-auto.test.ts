import { describe, expect, it } from "vitest";
import type { Seance, StableData } from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";

// Un localStorage minimal : le store persiste dedans.
class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
(globalThis as unknown as { localStorage: Mem }).localStorage = new Mem();

const { aCompter, rienACompter, aCompteLe, ceQuiACompte, finDuMois, clientsAFairePayer, demandePresence, estCollectif } = await import("@/lib/domain/compte-auto");
const { useDataStore } = await import("@/stores/data-store");

const S = (o: Partial<Seance> & { id: string }): Seance => ({
  prestationId: "x", title: "Cours", horseIds: [], participants: [], status: "planned", unitPrice: 0, rev: 0,
  date: "2026-10-15", start: "10:00", end: "11:00", ...o,
});
const C = (o: Partial<CareEvent> & { id: string; horseId: string }): CareEvent => ({ stableId: "s", kind: "ferrure", date: "2026-10-15", pending: true, ...o });

const base = (seances: Seance[], careEvents: CareEvent[] = []): StableData => ({
  horses: [
    { id: "h1", stableId: "s", name: "Sirius", entryDate: "2026-01-01", isArchived: false, ownerName: "Léa B." },
    { id: "h2", stableId: "s", name: "Diva", entryDate: "2026-01-01", isArchived: false, ownerName: "Inès R." },
  ],
  revenues: [], directExpenses: [], sharedExpenses: [], expenseCategories: [],
  revenueCategories: [{ id: "c", name: "Cours" }],
  people: [
    { id: "p1", name: "Emma", role: "cavalier", active: true },
    { id: "p2", name: "Lou", role: "cavalier", active: true },
    { id: "p3", name: "Nina", role: "cavalier", active: true },
  ],
  seances,
  careEvents,
}) as unknown as StableData;

describe("ce qui doit compter", () => {
  const data = base(
    [
      S({ id: "passe", horseIds: ["h1"], unitPrice: 35 }),
      S({ id: "futur", horseIds: ["h1"], unitPrice: 35, date: "2026-10-16", start: "18:00", end: "19:00" }),
      S({ id: "encours", horseIds: ["h1"], unitPrice: 35, date: "2026-10-16", start: "08:00", end: "09:00" }),
      S({ id: "vide", format: "collectif", places: 6, unitPrice: 25 }),
      S({ id: "fait", horseIds: ["h1"], unitPrice: 35, status: "done" }),
      S({ id: "annule", horseIds: ["h1"], unitPrice: 35, status: "cancelled" }),
    ],
    [
      C({ id: "f1", horseId: "h2", cost: 70, revenue: 78 }),
      C({ id: "g1", horseId: "h1", groupId: "g", kind: "vermifuge", cost: 18 }),
      C({ id: "g2", horseId: "h2", groupId: "g", kind: "vermifuge", cost: 18 }),
      C({ id: "demain", horseId: "h1", date: "2026-10-17", cost: 60 }),
      C({ id: "ce-soir", horseId: "h1", date: "2026-10-16", start: "19:00", cost: 60 }),
    ],
  );
  const plan = aCompter(data, "2026-10-16", "08:30");

  it("compte la séance passée, pas la future ni celle en cours", () => {
    expect(plan.seances).toEqual(["passe"]);
  });

  it("ne compte ni une séance vide, ni une faite, ni une annulée", () => {
    expect(plan.seances).not.toContain("vide");
    expect(plan.seances).not.toContain("fait");
    expect(plan.seances).not.toContain("annule");
  });

  it("compte les soins passés, groupés, tous les chevaux présents, à leur date", () => {
    expect(plan.soins).toEqual([
      { ids: ["f1"], horseIds: ["h2"], date: "2026-10-15" },
      { ids: ["g1", "g2"], horseIds: ["h1", "h2"], date: "2026-10-15" },
    ]);
  });

  it("une fois l'heure passée, la séance de ce soir et le soin de 19 h comptent", () => {
    const tard = aCompter(data, "2026-10-16", "19:30");
    expect(tard.seances).toEqual(["passe", "futur", "encours"]);
    expect(tard.soins.map((g) => g.ids)).toContainEqual(["ce-soir"]);
    expect(tard.soins.map((g) => g.ids)).not.toContainEqual(["demain"]);
  });

  it("rien à compter : rien", () => {
    expect(rienACompter(aCompter(base([]), "2026-10-16", "12:00"))).toBe(true);
  });
});

describe("le compteur automatique (store)", () => {
  const charger = (d: StableData) => useDataStore.setState({ ...d, seances: d.seances, careEvents: d.careEvents });

  it("compte la séance passée comme une validation, tous présents, et pas la future", () => {
    charger(
      base([
        S({ id: "passe", horseIds: ["h1"], unitPrice: 35 }),
        S({ id: "futur", horseIds: ["h1"], unitPrice: 35, date: "2026-10-17" }),
      ]),
    );
    expect(useDataStore.getState().compterLePasse("2026-10-16", "12:00")).toBe(1);
    const st = useDataStore.getState();
    expect(st.seances?.find((s) => s.id === "passe")?.status).toBe("done");
    expect(st.seances?.find((s) => s.id === "futur")?.status).toBe("planned");
    expect(st.revenues.filter((r) => r.seanceId === "passe").map((r) => [r.amount, r.date])).toEqual([[35, "2026-10-15"]]);
  });

  it("un cours collectif compte avec tous ses inscrits présents", () => {
    charger(
      base([
        S({
          id: "coll", title: "Cours collectif", format: "collectif", unitPrice: 25, horseIds: ["h1"],
          participants: [{ personId: "p1" }, { personId: "p2" }, { personId: "p3" }],
        }),
      ]),
    );
    useDataStore.getState().compterLePasse("2026-10-16", "12:00");
    const st = useDataStore.getState();
    const s = st.seances!.find((x) => x.id === "coll")!;
    expect(s.status).toBe("done");
    expect(s.participants.every((p) => p.present === true)).toBe(true);
    expect(st.revenues.filter((r) => r.seanceId === "coll").map((r) => r.payer).sort()).toEqual(["Emma", "Lou", "Nina"]);
  });

  it("une séance sans inscrit ni cheval ne crée rien", () => {
    charger(base([S({ id: "vide", format: "collectif", places: 6, unitPrice: 25 })]));
    expect(useDataStore.getState().compterLePasse("2026-10-16", "12:00")).toBe(0);
    const st = useDataStore.getState();
    expect(st.seances![0].status).toBe("planned");
    expect(st.revenues).toHaveLength(0);
  });

  it("un soin passé passe au carnet, sa dépense et sa refacturation à sa date", () => {
    charger(base([], [C({ id: "f1", horseId: "h2", cost: 70, revenue: 78 })]));
    useDataStore.getState().compterLePasse("2026-10-16", "12:00");
    const st = useDataStore.getState();
    const e = st.careEvents!.find((x) => x.id === "f1")!;
    expect(e.pending).toBeUndefined();
    expect(st.directExpenses.find((x) => x.id === e.expenseId)?.date).toBe("2026-10-15");
    expect(st.revenues.find((x) => x.id === e.revenueId)?.amount).toBe(78);
  });

  it("un soin à venir garde « refacturer » et se refacture quand il compte", () => {
    charger(base([], [C({ id: "f1", horseId: "h2", cost: 70, refacturer: true }), C({ id: "f2", horseId: "h1", cost: 50 })]));
    expect(useDataStore.getState().revenues).toHaveLength(0);
    useDataStore.getState().compterLePasse("2026-10-16", "12:00");
    const st = useDataStore.getState();
    const e = st.careEvents!.find((x) => x.id === "f1")!;
    const refac = st.revenues.filter((r) => r.rebillOf);
    expect(refac).toHaveLength(1);
    expect(refac[0]).toMatchObject({ rebillOf: e.expenseId, amount: 70, payer: "Inès R.", date: "2026-10-15" });
    // Relancé : pas de seconde refacturation.
    useDataStore.getState().compterLePasse("2026-10-16", "12:05");
    expect(useDataStore.getState().revenues.filter((r) => r.rebillOf)).toHaveLength(1);
  });

  it("un soin noté fait avec « refacturer » se refacture tout de suite", () => {
    charger(base([]));
    useDataStore.getState().logCareMany(["h1"], { kind: "ferrure", date: "2000-01-01", cost: 80, refacturer: true });
    const refac = useDataStore.getState().revenues.filter((r) => r.rebillOf);
    expect(refac).toHaveLength(1);
    expect(refac[0]).toMatchObject({ amount: 80, payer: "Léa B." });
  });

  it("est idempotent : relancé, il ne crée rien de plus", () => {
    charger(base([S({ id: "passe", horseIds: ["h1"], unitPrice: 35 })], [C({ id: "f1", horseId: "h2", cost: 70, revenue: 78 })]));
    expect(useDataStore.getState().compterLePasse("2026-10-16", "12:00")).toBe(2);
    const avant = useDataStore.getState();
    const n = { rev: avant.revenues.length, dep: avant.directExpenses.length };
    expect(useDataStore.getState().compterLePasse("2026-10-16", "12:05")).toBe(0);
    const apres = useDataStore.getState();
    expect(apres.revenues).toHaveLength(n.rev);
    expect(apres.directExpenses).toHaveLength(n.dep);
    expect(apres.seances).toBe(avant.seances);
  });

  it("une séance retirée (annulée) ne recompte pas", () => {
    charger(base([S({ id: "passe", horseIds: ["h1"], unitPrice: 35 })]));
    useDataStore.getState().compterLePasse("2026-10-16", "12:00");
    useDataStore.getState().cancelSeance("passe", "N’a pas eu lieu");
    expect(useDataStore.getState().compterLePasse("2026-10-16", "12:10")).toBe(0);
    expect(useDataStore.getState().revenues).toHaveLength(0);
  });
});

describe("ce qui a compté", () => {
  const data = base(
    [
      S({ id: "a", horseIds: ["h1"], unitPrice: 35, status: "done" }),
      S({ id: "b", horseIds: ["h1"], unitPrice: 35, date: "2026-10-14", status: "done" }),
      S({ id: "prevue", horseIds: ["h1"], unitPrice: 35, date: "2026-10-16", start: "18:00", end: "19:00" }),
      S({ id: "vieux", horseIds: ["h1"], unitPrice: 35, date: "2026-10-01", status: "done" }),
      S({ id: "coll", unitPrice: 25, status: "done", participants: [{ personId: "p1", present: true }, { personId: "p2", present: true }] }),
    ],
    [C({ id: "f1", horseId: "h2", cost: 70, pending: undefined, date: "2026-10-14" })],
  );

  it("liste un jour : séances et soins faits, pas les prévus", () => {
    expect(aCompteLe(data, "2026-10-15", "2026-10-16", "12:00").map((i) => i.key).sort()).toEqual(["a", "coll"]);
    expect(aCompteLe(data, "2026-10-16", "2026-10-16", "12:00")).toHaveLength(0);
  });

  it("groupe les 7 derniers jours, du plus récent, avec le total signé", () => {
    const j = ceQuiACompte(data, "2026-10-16", "12:00");
    expect(j.map((x) => x.date)).toEqual(["2026-10-15", "2026-10-14"]);
    expect(j[0].total).toBe(85);
    expect(j[1].total).toBe(35 - 70);
  });

  it("le cours à plusieurs demande « Qui était là ? », pas la séance simple", () => {
    const [a, coll] = aCompteLe(data, "2026-10-15", "2026-10-16", "12:00").sort((x, y) => x.key.localeCompare(y.key));
    expect(estCollectif(coll)).toBe(true);
    expect(demandePresence(coll)).toBe(true);
    expect(demandePresence(a)).toBe(false);
  });
});

describe("la fin du mois", () => {
  it("les 3 derniers jours du mois : le mois en cours", () => {
    expect(finDuMois("2026-10-29")).toEqual({ year: 2026, month: 10 });
    expect(finDuMois("2026-10-31")).toEqual({ year: 2026, month: 10 });
    expect(finDuMois("2026-10-28")).toBeNull();
  });
  it("les 5 premiers jours : le mois d'avant, même en janvier", () => {
    expect(finDuMois("2026-11-05")).toEqual({ year: 2026, month: 10 });
    expect(finDuMois("2027-01-02")).toEqual({ year: 2026, month: 12 });
    expect(finDuMois("2026-11-06")).toBeNull();
  });
  it("compte les clients qui doivent encore pour le mois concerné", () => {
    const d = base([]);
    d.revenues = [
      { id: "r1", stableId: "s", horseId: "h1", amount: 591, date: "2026-10-01", source: "recurring" },
      { id: "r2", stableId: "s", horseId: "h2", amount: 483, date: "2026-10-01", source: "recurring" },
      { id: "r3", stableId: "s", horseId: "", amount: 50, date: "2026-10-12", source: "manual", payer: "Emma" },
    ] as StableData["revenues"];
    d.payments = [{ id: "pay", payer: "Inès R.", month: "2026-10", amount: 483 }] as StableData["payments"];
    expect(clientsAFairePayer(d, "2026-10-15")).toBeNull();
    const r = clientsAFairePayer(d, "2026-11-03")!;
    expect(r.period).toEqual({ year: 2026, month: 10 });
    expect(r.clients.map((c) => [c.name, c.due])).toEqual([["Léa B.", 591], ["Emma", 50]]);
    expect(r.total).toBe(641);
  });
});
