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

const { ouvrirEcurieLocale, chevauxSansNom } = await import("@/components/bs/essayer");
const { useDataStore } = await import("@/stores/data-store");
const { useSettingsStore } = await import("@/stores/settings-store");
const { getSession } = await import("@/lib/account/session");
const { resumeLocale } = await import("@/lib/account/vault");
const { localToday } = await import("@/lib/utils/local-date");

describe("voir mon écurie après l'essai", () => {
  it("ouvre l'écurie locale, remplie avec les réponses, sans renvoyer au parcours", async () => {
    await ouvrirEcurieLocale({ chevaux: 4, pension: 420, frais: 1300 });
    expect(getSession()?.kind).toBe("locale");
    expect(allee.at(-1)).toMatch(/\/accueil$/);

    const d = useDataStore.getState();
    expect(d.horses.map((h) => h.name)).toEqual(["Cheval 1", "Cheval 2", "Cheval 3", "Cheval 4"]);
    expect(d.horses.every((h) => h.pension === 420)).toBe(true);
    expect(chevauxSansNom(d.horses)).toBe(4);
    // Les pensions du mois sont postées, les frais fixes sont une charge commune.
    const mois = localToday().slice(0, 7);
    expect(d.revenues.filter((r) => r.date.startsWith(mois)).reduce((t, r) => t + r.amount, 0)).toBe(1680);
    const frais = (d.recurringExpenses ?? []).filter((r) => r.isShared);
    expect(frais).toHaveLength(1);
    expect(frais[0].label).toBe("Frais fixes (foin, loyer, salaires)");
    expect(frais[0].amount).toBe(1300);
    // Rien de la démo.
    expect(d.seances ?? []).toHaveLength(0);

    const p = useSettingsStore.getState().parcours;
    expect(p.chevaux && p.tarifs && p.factures).toBe(true);
    expect(p.journee || p.ticket || p.seuil).toBe(false);

    // Écrit en clair dans le tiroir de l'essai.
    expect(resumeLocale()).toEqual({ chevaux: 4, pension: 420, frais: 1300, seances: 0 });
  });
});
