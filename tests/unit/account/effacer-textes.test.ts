import { describe, expect, it } from "vitest";
import { facturesDeLEssai, issueEffacement, messageEfface, ouEfface, texteSansCopie } from "@/lib/account/effacer-textes";

describe("effacer : ne rien promettre qu'on ne tient pas", () => {
  it("la copie de secours a été gardée : on efface, récupérable", () => {
    expect(issueEffacement({ misDeCote: true, sauve: false, confirme: false })).toBe("recuperable");
    expect(messageEfface("recuperable", 7, false)).toContain("récupérer sur ce téléphone pendant 7 jours");
  });
  it("pas de copie de secours : bloqué tant qu'il n'a pas fait de sauvegarde ou confirmé", () => {
    expect(issueEffacement({ misDeCote: false, sauve: false, confirme: false })).toBe("attendre");
    expect(issueEffacement({ misDeCote: false, sauve: true, confirme: false })).toBe("sans-copie");
    expect(issueEffacement({ misDeCote: false, sauve: false, confirme: true })).toBe("sans-copie");
  });
  it("sans copie, le message ne promet aucune récupération", () => {
    expect(messageEfface("sans-copie", 7, false)).toBe("Ton écurie est effacée.");
    expect(messageEfface("sans-copie", 7, true)).not.toMatch(/récupérer/);
    expect(texteSansCopie("téléphone")).toBe("La copie de secours n’a pas pu être gardée sur ce téléphone. Fais une sauvegarde avant d’effacer.");
    expect(texteSansCopie("ordinateur")).toContain("sur cet ordinateur");
  });
  it("le texte sous le bouton suit l'appareil", () => {
    expect(ouEfface("téléphone").startsWith("Ici, sur tes autres téléphones et ordinateurs")).toBe(true);
    expect(ouEfface("ordinateur").startsWith("Ici, sur tes autres téléphones et ordinateurs")).toBe(true);
  });
});

describe("effacer l'essai : les factures citées d'abord", () => {
  it("aucune facture : rien à dire", () => {
    expect(facturesDeLEssai([])).toBeNull();
    expect(facturesDeLEssai(undefined)).toBeNull();
  });
  it("une, quelques-unes, beaucoup", () => {
    expect(facturesDeLEssai([{ number: "2026-0001" }])).toBe("Ton essai a une facture (n° 2026-0001). Une facture faite se garde 10 ans : fais d’abord une sauvegarde.");
    expect(facturesDeLEssai([{ number: "2026-0002" }, { number: "2026-0001" }, { number: "2026-0003", kind: "avoir" }])).toContain("2 factures et un avoir (n° 2026-0001, n° 2026-0002 et n° 2026-0003)");
    const beaucoup = Array.from({ length: 12 }, (_, i) => ({ number: `2026-${String(i + 1).padStart(4, "0")}` }));
    expect(facturesDeLEssai(beaucoup)).toContain("12 factures (du n° 2026-0001 au n° 2026-0012)");
  });
});
