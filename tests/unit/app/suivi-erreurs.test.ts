import { beforeEach, describe, expect, it } from "vitest";

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
}
(globalThis as unknown as { localStorage: Mem }).localStorage = new Mem();
const s = await import("@/lib/suivi-erreurs");

describe("le suivi des erreurs, sans aucune donnée de l'écurie", () => {
  beforeEach(() => {
    s._reinitialiserSuivi();
    (globalThis as unknown as { localStorage: Mem }).localStorage = new Mem();
  });

  it("part avec le message, l'écran sans sa recherche, la version et le navigateur, et rien d'autre", async () => {
    const recus: { url: string; corps: Record<string, unknown> }[] = [];
    const ok = await s.signalerErreur("erreur", new TypeError(`Cannot read properties of undefined (reading 'Mme Dupont')`), {
      chemin: "/client?c=k3x9&mois=2026-10",
      navigateur: "Mozilla/5.0 (iPhone)",
      api: "https://site.test/wp-json/bestable/v1",
      envoi: async (url, corps) => {
        recus.push({ url, corps: JSON.parse(corps) });
        return 200;
      },
    });
    expect(ok).toBe(true);
    expect(recus[0].url).toBe("https://site.test/wp-json/bestable/v1/erreurs");
    expect(Object.keys(recus[0].corps).sort()).toEqual(["ecran", "message", "navigateur", "type", "version"]);
    expect(recus[0].corps.ecran).toBe("/client");
    expect(JSON.stringify(recus[0].corps)).not.toContain("Dupont");
    expect(recus[0].corps.message).toBe("TypeError: Cannot read properties of undefined (reading «…»)");
  });

  it("le message nettoyé : ni texte entre guillemets, ni e-mail, ni montant", () => {
    expect(s.nettoyerMessage(`Unexpected token 'M', "Mme Dupont 450 €" is not valid JSON`)).toBe("Unexpected token «…», «…» is not valid JSON");
    expect(s.nettoyerMessage("échec pour claire@ecurie.fr")).toBe("échec pour «e-mail»");
    expect(s.nettoyerMessage("total 1 250,50 attendu")).toBe("total «nombre» attendu");
    expect(s.nettoyerMessage("x".repeat(500))).toHaveLength(300);
  });

  it("le même message une fois, dix envois par page au plus", async () => {
    let n = 0;
    const envoi = async () => {
      n++;
      return 200;
    };
    await s.signalerErreur("erreur", new Error("a"), { chemin: "/", navigateur: "", envoi });
    await s.signalerErreur("erreur", new Error("a"), { chemin: "/", navigateur: "", envoi });
    expect(n).toBe(1);
    for (let i = 0; i < 20; i++) await s.signalerErreur("erreur", new Error(`b${String.fromCharCode(97 + i)}`), { chemin: "/", navigateur: "", envoi });
    expect(n).toBe(10);
  });

  it("tant que le site n'a pas la route (404), plus rien ne part pendant un jour", async () => {
    let n = 0;
    const envoi = async () => {
      n++;
      return 404;
    };
    const t = Date.parse("2026-10-19T10:00:00Z");
    expect(await s.signalerErreur("ecran", new Error("un"), { chemin: "/", navigateur: "", envoi, maintenant: t })).toBe(false);
    expect(await s.signalerErreur("ecran", new Error("deux"), { chemin: "/", navigateur: "", envoi, maintenant: t + 3600_000 })).toBe(false);
    expect(n).toBe(1);
    await s.signalerErreur("ecran", new Error("trois"), { chemin: "/", navigateur: "", envoi, maintenant: t + 25 * 3600_000 });
    expect(n).toBe(2);
  });

  it("le bruit des navigateurs ne part pas", async () => {
    let n = 0;
    await s.signalerErreur("erreur", "ResizeObserver loop limit exceeded", { chemin: "/", navigateur: "", envoi: async () => (n++, 200) });
    await s.signalerErreur("erreur", "Script error.", { chemin: "/", navigateur: "", envoi: async () => (n++, 200) });
    expect(n).toBe(0);
  });
});
