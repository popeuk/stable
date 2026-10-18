// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { poserEntree, retirerEntree } from "@/lib/retour-feuille";

/** Attend le popstate d'un history.back() (asynchrone, comme dans le navigateur). */
const pop = () => new Promise<void>((r) => window.addEventListener("popstate", () => setTimeout(r, 0), { once: true }));
const retour = async () => {
  const p = pop();
  history.back();
  await p;
};

describe("le bouton retour ferme d'abord la feuille", () => {
  beforeEach(() => {
    history.replaceState({ __NA: true, page: "accueil" }, "", "/accueil/");
  });

  it("retour : la feuille ouverte se ferme, l'écran reste", async () => {
    const fermer = vi.fn();
    poserEntree(fermer);
    expect(history.state.bsFeuille).toBeTypeOf("number");
    // L'état de Next (__NA) est gardé dans l'entrée de la feuille.
    expect(history.state.__NA).toBe(true);
    await retour();
    expect(fermer).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe("/accueil/");
    expect(history.state.bsFeuille).toBeUndefined();
  });

  it("deux feuilles empilées se ferment une à une", async () => {
    const a = vi.fn();
    const b = vi.fn();
    poserEntree(a);
    poserEntree(b);
    await retour();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    await retour();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("fermée par la croix, son entrée est sautée au retour suivant (pas de retour qui ne fait rien)", async () => {
    history.pushState({ __NA: true, page: "planning" }, "", "/planning/");
    const fermer = vi.fn();
    const n = poserEntree(fermer);
    retirerEntree(n);
    // Le retour quitte l'entrée morte, puis continue jusqu'à l'écran d'avant.
    const p = new Promise<void>((r) => {
      let vus = 0;
      const f = () => {
        if (++vus === 2) {
          window.removeEventListener("popstate", f);
          setTimeout(r, 0);
        }
      };
      window.addEventListener("popstate", f);
    });
    history.back();
    await p;
    expect(fermer).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/accueil/");
  });

  it("une navigation faite par-dessus une feuille remplace son entrée (pas d'entrée morte)", async () => {
    poserEntree(() => {});
    history.pushState({ __NA: true, page: "cheval" }, "", "/cheval/");
    expect(location.pathname).toBe("/cheval/");
    expect(history.state.bsFeuille).toBeUndefined();
    // Un seul retour ramène à l'écran d'avant la feuille.
    await retour();
    expect(location.pathname).toBe("/accueil/");
  });

  it("Next réécrit l'entrée de la feuille : la marque reste", () => {
    poserEntree(() => {});
    const m = history.state.bsFeuille;
    history.replaceState({ __NA: true, arbre: 2 }, "", location.pathname);
    expect(history.state.bsFeuille).toBe(m);
    expect(history.state.arbre).toBe(2);
  });
});

describe("le retour passe avant Next", () => {
  it("Next réécrit l'entrée d'arrivée dans son propre écouteur : la feuille se ferme quand même", async () => {
    vi.resetModules();
    history.replaceState({ __NA: true, page: "planning" }, "", "/planning/");
    // Comme Next 16 avec React 19 : son écouteur, posé avant le nôtre, rend le
    // retour tout de suite et réécrit l'entrée d'arrivée (sans marque).
    const next = (e: PopStateEvent) => history.replaceState({ ...(e.state ?? {}), __NA: true, arbre: "rendu" }, "", location.pathname);
    window.addEventListener("popstate", next);
    const { poserEntree: poser } = await import("@/lib/retour-feuille");
    const fermer = vi.fn();
    poser(fermer);
    await retour();
    window.removeEventListener("popstate", next);
    expect(fermer).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe("/planning/");
  });
});

describe("deux feuilles empilées, avec Next qui réécrit l'arrivée", () => {
  it("le retour ferme celle du dessus, pas celle d'en dessous", async () => {
    vi.resetModules();
    history.replaceState({ __NA: true, page: "client" }, "", "/client/");
    const next = (e: PopStateEvent) => history.replaceState({ ...(e.state ?? {}), __NA: true, arbre: "rendu" }, "", location.pathname);
    window.addEventListener("popstate", next);
    const { poserEntree: poser } = await import("@/lib/retour-feuille");
    const a = vi.fn();
    const b = vi.fn();
    poser(a);
    poser(b);
    await retour();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
    await retour();
    expect(a).toHaveBeenCalledTimes(1);
    window.removeEventListener("popstate", next);
  });
});

describe("une navigation depuis une feuille ouverte", () => {
  it("l'entrée remplacée n'est pas sautée plus tard (pas de double retour)", async () => {
    vi.resetModules();
    history.replaceState({ __NA: true, page: "accueil" }, "", "/accueil/");
    history.pushState({ __NA: true, page: "planning" }, "", "/planning/");
    const { poserEntree: poser, retirerEntree: retirer } = await import("@/lib/retour-feuille");
    const n = poser(() => {});
    // Un lien dans la feuille mène à un autre écran, puis la feuille se démonte.
    history.pushState({ __NA: true, page: "cheval" }, "", "/cheval/");
    retirer(n);
    await retour();
    // Un second retour (de trop) arriverait ici.
    await new Promise((r) => setTimeout(r, 50));
    expect(location.pathname).toBe("/planning/");
  });
});
