import { describe, expect, it } from "vitest";
import { aideParId, aidePour, bulleAMontrer, placerBulle } from "@/lib/aide";

const IDS = ["accueil", "planning", "valider", "chevaux", "ticket", "argent", "pilotage", "seuil", "scenarios", "depenses", "equipe", "clients", "client", "prestations", "ma-fiche", "moi"];

describe("la bulle de la première visite", () => {
  it("chaque écran qui a une aide a sa bulle, une phrase de 4 à 9 mots, sans tiret cadratin ni point d'exclamation", () => {
    for (const id of IDS) {
      const a = aideParId(id);
      expect(a, id).toBeDefined();
      const mots = a!.bulle.replace(/[?«»+,]/g, " ").split(/\s+/).filter(Boolean);
      expect(mots.length, `${id} : ${a!.bulle}`).toBeGreaterThanOrEqual(4);
      expect(mots.length, `${id} : ${a!.bulle}`).toBeLessThanOrEqual(9);
      expect(a!.bulle).not.toMatch(/[\u2014!]|étape|débloqu|niveau/i);
      expect(["plus", "haut"]).toContain(a!.cible);
    }
  });

  it("l'accueil montre le + : tout ce que tu fais, tu le notes ici", () => {
    expect(bulleAMontrer(aidePour("/accueil"), [])).toEqual({ id: "accueil", texte: "Tout ce que tu fais, tu le notes ici", cible: "plus" });
  });

  it("une seule fois par écran : vue, elle ne revient plus ; les autres écrans gardent la leur", () => {
    expect(bulleAMontrer(aidePour("/accueil"), ["accueil"])).toBeNull();
    expect(bulleAMontrer(aidePour("/chevaux"), ["accueil"])?.id).toBe("clients");
    expect(bulleAMontrer(aidePour("/chevaux?vue=chevaux"), ["clients"])?.id).toBe("chevaux");
  });

  it("rien sur un écran sans aide, ni quand la carte du « ? » est ouverte", () => {
    expect(bulleAMontrer(aidePour("/recherche"), [])).toBeNull();
    expect(bulleAMontrer(aidePour("/argent"), [], "argent")).toBeNull();
    expect(bulleAMontrer(aidePour("/argent"), [], "autre")?.texte).toBe("Ce qu’il te reste, tout payé");
  });
});

describe("où se pose la bulle", () => {
  const ecran = { width: 390, height: 844 };
  it("au-dessus du + en bas de l'écran, pointe sous son centre, sans le couvrir", () => {
    const plus = { top: 760, bottom: 816, left: 167, width: 56 };
    const p = placerBulle(plus, { width: 260 }, ecran);
    expect(p.dessus).toBe(true);
    expect(p.bottom).toBe(844 - 760 + 10);
    expect(p.top).toBeUndefined();
    expect(p.left + p.pointe).toBe(195);
  });
  it("sous le « ? » en haut à droite, sans sortir de l'écran", () => {
    const aide = { top: 50, bottom: 80, left: 300, width: 30 };
    const p = placerBulle(aide, { width: 260 }, ecran);
    expect(p.dessus).toBe(false);
    expect(p.top).toBe(90);
    expect(p.left).toBe(390 - 16 - 260);
    expect(p.left + p.pointe).toBe(315);
  });
  it("la pointe reste dans la bulle même si la cible est au bord", () => {
    const p = placerBulle({ top: 50, bottom: 80, left: 370, width: 20 }, { width: 260 }, ecran);
    expect(p.pointe).toBeLessThanOrEqual(260 - 14);
  });
});
