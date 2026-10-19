import { describe, expect, it } from "vitest";

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

const { ouvrirFichierSauvegarde, TAILLE_MAX_SAUVEGARDE } = await import("@/components/bs/reprendre-sauvegarde");
const { useDataStore } = await import("@/stores/data-store");
const { contenuSauvegarde } = await import("@/lib/sauvegarde");
type Q = import("@/components/bs/confirmer").Question;

describe("ouvrir une sauvegarde", () => {
  it("un fichier de plus de 10 Mo est refusé sans être lu", async () => {
    let lu = false;
    const f = { size: TAILLE_MAX_SAUVEGARDE + 1, text: async () => ((lu = true), "{}") } as unknown as File;
    const qs: Q[] = [];
    await ouvrirFichierSauvegarde(f, async (q) => (qs.push(q), true));
    expect(lu).toBe(false);
    expect(qs.map((q) => q.titre)).toEqual(["Cette sauvegarde ne s’ouvre pas"]);
    expect(String(qs[0].texte)).toContain("plus de 10 Mo");
  });

  it("un IBAN différent de celui de l'app est dit dans la question (et rien n'est ouvert si on dit non)", async () => {
    useDataStore.setState({ billing: { statut: "ei", nomPrenom: "Julie Martin", iban: "FR7630006000011234567890189" } });
    const data = { horses: [], revenues: [], directExpenses: [], sharedExpenses: [], revenueCategories: [], expenseCategories: [], billing: { statut: "ei", nomPrenom: "Julie Martin", iban: "FR7612345678901234567890123" } };
    const fichier = JSON.stringify(contenuSauvegarde({ data, settings: {}, versionDonnees: 5, versionReglages: 1 }));
    const f = { size: fichier.length, text: async () => fichier } as unknown as File;
    const qs: Q[] = [];
    await ouvrirFichierSauvegarde(f, async (q) => (qs.push(q), false));
    expect(qs).toHaveLength(1);
    expect(qs[0].titre).toBe("Ouvrir cette sauvegarde ?");
    expect(String(qs[0].texte)).toMatch(/^Cette sauvegarde change ton IBAN : FR76 1234 5678 9012 3456 7890 123\. Elle remplace/);
    expect(useDataStore.getState().billing?.iban).toBe("FR7630006000011234567890189");
  });
});
