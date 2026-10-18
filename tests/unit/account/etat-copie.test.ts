import { describe, expect, it } from "vitest";
import { texteCopie } from "@/lib/account/etat-copie";

describe("la ligne de la copie en ligne dans Mon compte", () => {
  const midi = new Date(2026, 9, 19, 12, 0).getTime();
  it("à jour, avec l'heure", () => {
    expect(texteCopie({ allume: true, attente: false, changements: 0, aJour: new Date(2026, 9, 19, 10, 42).toISOString() }, midi)).toBe("Copie en ligne à jour à 10 h 42");
    expect(texteCopie({ allume: true, attente: false, changements: 0, aJour: new Date(2026, 9, 18, 10, 42).toISOString() }, midi)).toBe("Copie en ligne à jour le 18 octobre à 10 h 42");
  });
  it("des changements en attente", () => {
    expect(texteCopie({ allume: true, attente: true, changements: 3, aJour: null }, midi)).toBe("3 changements attendent le réseau");
    expect(texteCopie({ allume: true, attente: true, changements: 1, aJour: null }, midi)).toBe("1 changement attend le réseau");
  });
  it("éteinte, ou pas encore vérifiée", () => {
    expect(texteCopie({ allume: false, attente: false, changements: 0, aJour: null })).toBe("Copie en ligne éteinte sur cet appareil");
    expect(texteCopie({ allume: true, attente: false, changements: 0, aJour: null })).toBe("Copie en ligne : on vérifie…");
  });
});
