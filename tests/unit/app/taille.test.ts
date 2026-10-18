// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CLE_TAILLE, TAILLE_TOT, grosTexte, poserGrosTexte, poserTaille, tailleTexte } from "@/lib/taille";

describe("taille du texte : normal, gros, très gros (décision 5)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-taille");
  });

  it("Très gros texte se pose sur <html> et se garde pour la prochaine ouverture", () => {
    poserTaille("tres-grand");
    expect(document.documentElement.getAttribute("data-taille")).toBe("tres-grand");
    expect(localStorage.getItem(CLE_TAILLE)).toBe("tres-grand");
    expect(tailleTexte()).toBe("tres-grand");
    expect(grosTexte()).toBe(true);
  });

  it("le script du <head> repose le choix avant le premier affichage, et ignore une valeur inconnue", () => {
    localStorage.setItem(CLE_TAILLE, "tres-grand");
    new Function(TAILLE_TOT)();
    expect(document.documentElement.getAttribute("data-taille")).toBe("tres-grand");
    document.documentElement.removeAttribute("data-taille");
    localStorage.setItem(CLE_TAILLE, "enorme");
    new Function(TAILLE_TOT)();
    expect(document.documentElement.hasAttribute("data-taille")).toBe(false);
    expect(tailleTexte()).toBe("normal");
  });

  it("revenir à Normal efface le choix ; l'ancien interrupteur garde le premier niveau", () => {
    poserGrosTexte(true);
    expect(tailleTexte()).toBe("grand");
    poserTaille("normal");
    expect(localStorage.getItem(CLE_TAILLE)).toBeNull();
    expect(document.documentElement.hasAttribute("data-taille")).toBe(false);
  });
});
