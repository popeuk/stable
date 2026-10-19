// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Matomo (19 octobre 2026) : sans cookie, l'app envoie elle-même ses visites à
 * matomo.php. Rien d'un client ne part (ni nom, ni recherche de l'app), seuls
 * les paramètres de campagne restent, et un refus coupe tout.
 */
const NOM = "Mme Dupont";

async function charger(url = "https://stats.bestable.fr", site = "1") {
  vi.stubEnv("NEXT_PUBLIC_MATOMO_URL", url);
  vi.stubEnv("NEXT_PUBLIC_MATOMO_SITE", site);
  vi.resetModules();
  const envoyes: string[] = [];
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: (u: string) => (envoyes.push(u), true) });
  const m = await import("@/lib/mesure");
  return { m, envoyes };
}

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("Matomo, sans cookie", () => {
  it("une adresse mal formée l'éteint", () => {
    return import("@/lib/mesure").then((m) => {
      expect(m.matomoValide("https://stats.bestable.fr", "1")).toBe(true);
      expect(m.matomoValide("http://stats.bestable.fr", "1")).toBe(false);
      expect(m.matomoValide("https://stats.bestable.fr/x?y", "1")).toBe(false);
      expect(m.matomoValide("https://stats.bestable.fr", "un")).toBe(false);
    });
  });

  it("une page vue et une étape partent sans nom de client, sans cookie, sans bandeau", async () => {
    window.history.pushState({}, "", `/client?nom=${encodeURIComponent(NOM)}&mtm_campaign=lancement#haut`);
    const { m, envoyes } = await charger();
    expect(m.AVEC_MATOMO).toBe(true);
    expect(m.MESURE_POSEE).toBe(false);
    m.matomoPage();
    m.mesurer("compte_cree");
    expect(envoyes).toHaveLength(2);
    for (const u of envoyes) {
      expect(u.startsWith("https://stats.bestable.fr/matomo.php?")).toBe(true);
      expect(u).not.toContain("Dupont");
      const p = new URL(u).searchParams;
      expect(p.get("idsite")).toBe("1");
      expect(p.get("url")).toBe(`${location.origin}/client?mtm_campaign=lancement`);
      expect(p.get("action_name")).toBe("Be Stable");
      expect(p.has("_id")).toBe(false);
    }
    expect(new URL(envoyes[1]).searchParams.get("e_a")).toBe("compte_cree");
    expect(document.cookie).toBe("");
  });

  it("refusé : plus rien ne part", async () => {
    const { m, envoyes } = await charger();
    m.choisirMatomo(false);
    m.matomoPage();
    m.mesurer("facture_faite");
    expect(envoyes).toHaveLength(0);
    m.choisirMatomo(true);
    m.matomoPage();
    expect(envoyes).toHaveLength(1);
  });

  it("la provenance garde l'origine et le chemin, pas la recherche ; rien depuis l'app elle-même", async () => {
    const { m } = await charger();
    expect(m.provenance("https://www.mon-ecurie.fr/directory/x/?q=1", "https://app.bestable.fr")).toBe("https://www.mon-ecurie.fr/directory/x/");
    expect(m.provenance("https://app.bestable.fr/reglages", "https://app.bestable.fr")).toBe("");
    expect(m.provenance("", "https://app.bestable.fr")).toBe("");
  });

  it("le résumé de Réglages dit les cookies et les statistiques", async () => {
    const { resumeChoix } = await import("@/components/bs/consentement");
    expect(resumeChoix(null, true, false, false, true)).toBe("Statistiques anonymes");
    expect(resumeChoix(null, false, false, false, true)).toBe("Sans statistiques");
    expect(resumeChoix({ audience: true, pub: false, quand: "" }, true, true, true, true)).toBe("Cookies acceptés en partie, statistiques anonymes");
    expect(resumeChoix({ audience: false, pub: false, quand: "" }, true, true, false, false)).toBe("Cookies refusés");
  });
});
