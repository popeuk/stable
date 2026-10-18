import { describe, expect, it, vi } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
// La session se lit dans le navigateur : un « window » suffit.
(globalThis as unknown as { window: object }).window = globalThis;
mem.set("be-stable-session", JSON.stringify({ kind: "locale", at: "2026-10-17T10:00:00Z" }));

const { useDataStore, migrerDonnees } = await import("@/stores/data-store");
const { ensurePensions } = await import("@/lib/domain/autopilot");
const { lireSauvegarde, nettoyer } = await import("@/lib/domain/valider");
const { avecCategoriesSysteme } = await import("@/lib/domain/categories");
const { buildDemoData } = await import("@/lib/data/demo-data");
const { suggestions } = await import("@/lib/domain/leviers");

const st = () => useDataStore.getState();
const KEY = "be-stable-data@locale";
const recharger = async (raw: string) => {
  mem.set(KEY, raw);
  await useDataStore.persist.rehydrate();
};

describe("un état stocké abîmé ne casse plus les écrans (P2-8)", () => {
  it("« horses: abc » : l'app s'ouvre avec ce qui reste, et l'écran de secours le dit", async () => {
    await recharger(JSON.stringify({ state: { horses: "abc", revenues: [{ id: "r", amount: 12, date: "2026-10-01" }, { id: 3 }] }, version: 5 }));
    expect(st().horses).toEqual([]);
    expect(st().revenues).toHaveLength(1);
    expect(st().secours?.problemes).toEqual(["les chevaux", "1 ligne dans ce qui rentre"]);
    expect(st().secours?.copie).toContain('"horses":"abc"');
    st().quitterSecours("garder");
    expect(st().secours).toBeUndefined();
    expect(st().revenues).toHaveLength(1);
  });
  it("un texte qui ne se lit même pas : rien d'inventé, la copie d'origine est gardée", async () => {
    await recharger("{pas du json");
    expect(st().horses).toEqual([]);
    expect(st().secours).toEqual({ problemes: ["toutes les données"], copie: "{pas du json" });
    st().quitterSecours("repartir");
    expect(st().secours).toBeUndefined();
  });
  it("une version d'avant abîmée passe aussi par le nettoyage avant la migration", async () => {
    await recharger(JSON.stringify({ state: { horses: [{ id: "h", name: "A", entryDate: "2025-01-01", isArchived: true }, "x"] }, version: 3 }));
    expect(st().horses).toHaveLength(1);
    expect(st().horses[0].stays).toHaveLength(1);
    expect(st().secours?.problemes).toEqual(["1 ligne dans les chevaux"]);
  });
});

describe("une sauvegarde abîmée ou d'un autre format est refusée, rien n'est remplacé", () => {
  it("refusée avec la raison", () => {
    const abimee = lireSauvegarde(JSON.stringify({ app: "be-stable", "be-stable-data": { state: { horses: "abc" } } }));
    expect(abimee.ok).toBe(false);
    expect(!abimee.ok && abimee.raison).toMatch(/abîmée \(les chevaux\)\. Rien n’a changé dans l’app/);
    expect(lireSauvegarde("bonjour").ok).toBe(false);
    expect(lireSauvegarde(JSON.stringify({ app: "autre" })).ok).toBe(false);
  });
  it("une vraie sauvegarde se lit, et passe par la migration", () => {
    const d = buildDemoData(new Date("2026-10-17T12:00:00"));
    const lu = lireSauvegarde(JSON.stringify({ app: "be-stable", "be-stable-data": { state: d }, "be-stable-settings": { state: { stableName: "X" } } }));
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(lu.settings).toEqual({ stableName: "X" });
    expect(migrerDonnees(lu.data, 4).horses.every((h) => h.stays?.length === 1)).toBe(true);
    expect(nettoyer(d).problemes).toEqual([]);
  });
});

describe("la catégorie Pension et les autres dont dépend l'autopilote (P1-2 recette 2)", () => {
  it("ne se retirent pas ; une catégorie ordinaire, si", () => {
    st().startEmpty();
    const pension = st().revenueCategories.find((c) => c.name === "Pension")!;
    st().deleteRevenueCategory(pension.id);
    expect(st().revenueCategories.some((c) => c.id === pension.id)).toBe(true);
    const sport = st().revenueCategories.find((c) => c.name === "Sport")!;
    st().deleteRevenueCategory(sport.id);
    expect(st().revenueCategories.some((c) => c.id === sport.id)).toBe(false);
    for (const n of ["Cours", "Refacturation"]) {
      const c = st().revenueCategories.find((x) => x.name === n)!;
      st().deleteRevenueCategory(c.id);
      expect(st().revenueCategories.some((x) => x.id === c.id)).toBe(true);
    }
  });
  it("retirée avant ce correctif, elle revient avec son identifiant : les pensions repartent", () => {
    const d = buildDemoData(new Date("2026-10-17T12:00:00"));
    const sans = { ...d, revenueCategories: d.revenueCategories.filter((c) => c.name !== "Pension") };
    expect(ensurePensions(sans, "2026-11-03")).toEqual([]);
    const remis = avecCategoriesSysteme(sans);
    expect(remis.revenueCategories.find((c) => c.name === "Pension")?.id).toBe("rev-0");
    expect(ensurePensions(remis, "2026-11-03")).toHaveLength(9);
  });
});

describe("« Faire payer » sur un cheval sans propriétaire (P2-3)", () => {
  it("ne crée aucune recette que personne ne doit", () => {
    st().startEmpty();
    const hid = st().addHorse({ name: "Cheval 1", entryDate: "2026-10-01" });
    st().addDirectExpense({ horseId: hid, label: "Ostéo", amount: 60, date: "2026-10-05", source: "manual" });
    const e = st().directExpenses[0];
    st().rebillExpense(e.id);
    expect(st().revenues.filter((r) => r.rebillOf === e.id)).toEqual([]);
    // La piste « Faire payer » n'est pas proposée non plus.
    expect(suggestions(st(), { year: 2026, month: 10 }, 0).some((x) => x.apply.type === "rebill")).toBe(false);
    st().setOwner(hid, "Marie D.");
    st().rebillExpense(e.id);
    expect(st().revenues.filter((r) => r.rebillOf === e.id)).toEqual([expect.objectContaining({ payer: "Marie D.", amount: 60 })]);
  });
});

describe("départ daté d'un mois d'avant, depuis la fiche", () => {
  it("la pension de ce mois, postée toute seule et pas facturée, s'en va ; le registre garde la vraie date", () => {
    vi.useFakeTimers({ now: new Date("2026-10-17T12:00:00"), toFake: ["Date"] });
    st().startEmpty();
    const hid = st().addHorse({ name: "Tardif", entryDate: "2026-10-01", pension: 400 });
    // Comme s'il était là depuis l'été : déjà compté en septembre.
    useDataStore.setState((s) => ({ horses: s.horses.map((h) => (h.id === hid ? { ...h, entryDate: "2026-07-01", stays: [{ entry: "2026-07-01" }] } : h)) }));
    expect(st().revenues.some((r) => r.id === `rev-pension-${hid}-2026-10`)).toBe(true);
    st().archiveHorse(hid, "2026-09-28", { destination: "Écurie du Lac" });
    const h = st().horses.find((x) => x.id === hid)!;
    expect(h).toMatchObject({ isArchived: true, exitDate: "2026-09-28", destination: "Écurie du Lac" });
    expect(st().revenues.some((r) => r.id === `rev-pension-${hid}-2026-10`)).toBe(false);
    // Il revient le 5 novembre : un nouveau séjour, le premier reste.
    vi.setSystemTime(new Date("2026-11-05T12:00:00"));
    st().restoreHorse(hid, "2026-11-05", { origin: "Écurie du Lac" });
    expect(st().horses.find((x) => x.id === hid)!.stays).toEqual([
      { entry: "2026-07-01", exit: "2026-09-28", countUntil: "2026-09-30", destination: "Écurie du Lac" },
      { entry: "2026-11-05", origin: "Écurie du Lac" },
    ]);
    expect(st().revenues.some((r) => r.id === `rev-pension-${hid}-2026-11`)).toBe(true);
    vi.useRealTimers();
  });
});
