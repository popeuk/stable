import { describe, expect, it } from "vitest";

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}
const g = globalThis as unknown as { localStorage: Mem; window: object };
g.localStorage = new Mem();
g.window = globalThis;

const { contenuSauvegarde, FORMAT_SAUVEGARDE } = await import("@/lib/sauvegarde");
const { lireSauvegarde } = await import("@/lib/domain/valider");
const { VERSION_DONNEES, migrerDonnees } = await import("@/stores/data-store");
const { VERSION_REGLAGES, migrerReglages } = await import("@/stores/settings-store");
const v = await import("@/lib/version-donnees");

const max = { donnees: VERSION_DONNEES, reglages: VERSION_REGLAGES };
const etat = { horses: [{ id: "h1", name: "Sirius", pension: 400, entryDate: "2026-01-01", isArchived: false }], revenues: [], expenses: [], recurringExpenses: [] };

describe("la version des données dans la sauvegarde", () => {
  it("l'export dit la version des données et des réglages", () => {
    const out = contenuSauvegarde({ data: etat, settings: { stableName: "Le Clos" }, versionDonnees: VERSION_DONNEES, versionReglages: VERSION_REGLAGES, quand: new Date("2026-10-19T10:00:00Z") });
    expect(out.version).toBe(FORMAT_SAUVEGARDE);
    expect(out["be-stable-data"]).toMatchObject({ version: VERSION_DONNEES });
    expect(out["be-stable-settings"]).toMatchObject({ version: VERSION_REGLAGES, state: { stableName: "Le Clos" } });
  });

  it("la reprise lit cette version (et un fichier d'avant, sans version, compte comme la 4)", () => {
    const neuf = lireSauvegarde(JSON.stringify(contenuSauvegarde({ data: etat, settings: {}, versionDonnees: 5, versionReglages: 7 })), max);
    expect(neuf.ok && neuf.versionDonnees).toBe(5);
    expect(neuf.ok && neuf.versionReglages).toBe(7);
    const ancien = lireSauvegarde(JSON.stringify({ app: "be-stable", version: 2, "be-stable-data": { state: etat }, "be-stable-settings": { state: {} } }), max);
    expect(ancien.ok && ancien.versionDonnees).toBe(4);
    expect(ancien.ok && ancien.versionReglages).toBeNull();
    // Une sauvegarde en version 4 repasse par la migration (les séjours arrivent, v5).
    if (ancien.ok) expect(migrerDonnees(ancien.data, ancien.versionDonnees).horses[0].stays?.length).toBe(1);
  });

  it("un fichier fait par une version plus récente de l'app est refusé, rien ne change", () => {
    const futur = lireSauvegarde(JSON.stringify(contenuSauvegarde({ data: etat, settings: {}, versionDonnees: VERSION_DONNEES + 1, versionReglages: VERSION_REGLAGES })), max);
    expect(futur.ok).toBe(false);
    expect(!futur.ok && futur.raison).toContain("version plus récente");
    const reglagesFuturs = lireSauvegarde(JSON.stringify(contenuSauvegarde({ data: etat, settings: {}, versionDonnees: VERSION_DONNEES, versionReglages: VERSION_REGLAGES + 1 })), max);
    expect(reglagesFuturs.ok).toBe(false);
  });

  it("les réglages d'une version d'avant passent par leur migration", () => {
    const r = migrerReglages({ capacity: 12, openRouterKey: "x" }, 5);
    expect(r.openRouterKey).toBeUndefined();
    expect(r.capacity).toBe(0);
  });

  it("des données plus récentes dans le stockage : on le note, on recharge une fois par minute au plus", () => {
    v._oublierVersion();
    const s = new Mem();
    expect(v.noterVersionLue(5, 5, s, 1000)).toBe(false);
    expect(v.donneesPlusRecentes()).toBe(false);
    expect(v.noterVersionLue(6, 5, s, 1000)).toBe(true);
    expect(v.donneesPlusRecentes()).toBe(true);
    expect(s.getItem("be-stable-recharge-version")).toBe("1000");
    v.noterVersionLue(6, 5, s, 30_000);
    expect(s.getItem("be-stable-recharge-version")).toBe("1000");
    v._oublierVersion();
  });

  it("le store ne réécrit jamais par-dessus des données plus récentes que lui", async () => {
    const { setSession, scopedKey } = await import("@/lib/account/session");
    const { useDataStore } = await import("@/stores/data-store");
    const { ecrituresFaites } = await import("@/lib/account/vault");
    v._oublierVersion();
    setSession({ kind: "locale", at: "x" });
    const futur = JSON.stringify({ state: { ...etat, nouveauChamp: 1 }, version: VERSION_DONNEES + 1 });
    localStorage.setItem(scopedKey("be-stable-data"), futur);
    await useDataStore.persist.rehydrate();
    expect(v.donneesPlusRecentes()).toBe(true);
    expect(useDataStore.getState().horses.map((h) => h.name)).toEqual(["Sirius"]);
    useDataStore.setState({ horses: [] });
    await ecrituresFaites("be-stable-data");
    expect(localStorage.getItem(scopedKey("be-stable-data"))).toBe(futur);
    v._oublierVersion();
  });
});
