import { describe, expect, it } from "vitest";

// Un localStorage minimal et une fenêtre qui ne recharge rien.
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
const store = new Mem();
const allee: string[] = [];
(globalThis as unknown as { localStorage: Mem }).localStorage = store;
(globalThis as unknown as { window: object }).window = Object.assign(globalThis, { location: { assign: (u: string) => allee.push(u), search: "" } });

const { ouvrirEssai, chevauxSansNom } = await import("@/components/bs/essayer");
const { ajouterChevaux, pensionCommune, changerPensionCommune, fraisEnUnTotal, fraisDuMois, retirerTotal, retirerPostes, FRAIS_LABEL } = await import("@/components/bs/parcours");
const { useDataStore } = await import("@/stores/data-store");
const { useSettingsStore } = await import("@/stores/settings-store");
const { getSession } = await import("@/lib/account/session");
const { resumeLocale } = await import("@/lib/account/vault");
const { localToday } = await import("@/lib/utils/local-date");
const { currentPeriod } = await import("@/lib/utils/period");
const { monthBreakdown } = await import("@/lib/domain/ticket");

const mois = localToday().slice(0, 7);
const pensionsDuMois = () =>
  useDataStore
    .getState()
    .revenues.filter((r) => r.date.startsWith(mois))
    .reduce((t, r) => t + r.amount, 0);

describe("commencer l'essai", () => {
  it("ouvre une écurie locale vide et mène aux premiers pas", async () => {
    useSettingsStore.setState((s) => ({ parcours: { ...s.parcours, chevaux: true, tarifs: true } }));
    await ouvrirEssai();
    expect(getSession()?.kind).toBe("locale");
    expect(allee.at(-1)).toMatch(/\/parcours$/);
    const d = useDataStore.getState();
    expect(d.horses).toHaveLength(0);
    expect(d.seances ?? []).toHaveLength(0);
    expect(Object.values(useSettingsStore.getState().parcours).some(Boolean)).toBe(false);
  });
});

describe("le nombre de chevaux", () => {
  it("crée Cheval 1 à Cheval N à la pension moyenne, pension du mois comptée", () => {
    expect(ajouterChevaux(4, 420)).toBe(4);
    const d = useDataStore.getState();
    expect(d.horses.map((h) => h.name)).toEqual(["Cheval 1", "Cheval 2", "Cheval 3", "Cheval 4"]);
    expect(d.horses.every((h) => h.pension === 420)).toBe(true);
    expect(d.tariffs?.pension).toBe(420);
    expect(chevauxSansNom(d.horses)).toBe(4);
    expect(pensionsDuMois()).toBe(1680);
    expect(pensionCommune(d)).toBe(420);
  });

  it("en ajoute à la suite, sans reprendre un numéro", () => {
    ajouterChevaux(2, 420);
    expect(useDataStore.getState().horses.map((h) => h.name).slice(-2)).toEqual(["Cheval 5", "Cheval 6"]);
    expect(pensionsDuMois()).toBe(6 * 420);
  });

  it("change la pension commune pour tous, pension du mois comprise", () => {
    changerPensionCommune(450);
    const d = useDataStore.getState();
    expect(d.horses.every((h) => h.pension === 450)).toBe(true);
    expect(pensionCommune(d)).toBe(450);
    expect(pensionsDuMois()).toBe(6 * 450);
  });

  it("n'est plus commune quand un cheval a sa propre pension", () => {
    const d = useDataStore.getState();
    d.setPension(d.horses[0].id, 600, mois);
    expect(pensionCommune(useDataStore.getState())).toBeNull();
    changerPensionCommune(450);
  });
});

describe("le total des frais", () => {
  const period = currentPeriod();

  it("crée une seule charge commune mensuelle « Frais communs »", async () => {
    fraisEnUnTotal(1300, period);
    fraisEnUnTotal(1400, period); // corriger ne double pas
    const frais = (useDataStore.getState().recurringExpenses ?? []).filter((r) => r.isShared);
    expect(frais).toHaveLength(1);
    expect(frais[0].label).toBe(FRAIS_LABEL);
    expect(frais[0].amount).toBe(1400);
    expect(useDataStore.getState().expenseCategories.find((c) => c.id === frais[0].categoryId)?.name).toBe("Frais communs");
    expect(fraisDuMois(useDataStore.getState(), period)).toMatchObject({ total: 1400, postes: 0 });
    // Ce qui reste ce mois : 6 pensions à 450 moins 1 400 de frais.
    expect(Math.round(monthBreakdown(useDataStore.getState(), period).net)).toBe(6 * 450 - 1400);
    // Le coffre écrit l'un après l'autre : on le laisse finir.
    await new Promise((r) => setTimeout(r, 80));
    expect(resumeLocale()).toEqual({ chevaux: 6, pension: 450, frais: 1400, seances: 0 });
  });

  it("poste par poste après un total : retirer le total ne compte rien deux fois", () => {
    const d = useDataStore.getState();
    const foin = d.expenseCategories.find((c) => !c.isDirect && c.name !== "Frais communs")!;
    d.setMonthlyCharge(foin.id, foin.name, 800, period);
    expect(fraisDuMois(useDataStore.getState(), period)).toMatchObject({ total: 1400, postes: 800 });
    retirerTotal(period);
    expect(fraisDuMois(useDataStore.getState(), period)).toMatchObject({ total: 0, postes: 800 });
    expect((useDataStore.getState().recurringExpenses ?? []).filter((r) => r.isShared)).toHaveLength(1);
  });

  it("un total après des postes : ne garder que le total", () => {
    fraisEnUnTotal(2000, period);
    retirerPostes(period);
    expect(fraisDuMois(useDataStore.getState(), period)).toMatchObject({ total: 2000, postes: 0 });
    expect(Math.round(monthBreakdown(useDataStore.getState(), period).sharedTotal)).toBe(2000);
  });
});
