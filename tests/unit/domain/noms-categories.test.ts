import { describe, expect, it } from "vitest";
import { nomAffiche } from "@/lib/domain/noms-categories";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
const { libelleFrais } = await import("@/components/bs/parcours");

describe("noms de catégories affichés", () => {
  it("les anciens noms et les noms repères se lisent avec les mots du gérant", () => {
    expect(nomAffiche("Frais communs")).toBe("Frais de l’écurie");
    expect(nomAffiche("Frais fixes")).toBe("Frais de l’écurie");
    expect(nomAffiche("Refacturation")).toBe("À faire payer au propriétaire");
    expect(nomAffiche("Personnel")).toBe("Salaires");
    expect(nomAffiche("Litière")).toBe("Paille et litière");
    expect(nomAffiche("Loyer / foncier")).toBe("Loyer");
    expect(nomAffiche("Vétérinaire et maréchal non refacturés")).toBe("Véto et maréchal payés par l’écurie");
  });
  it("un nom inconnu reste tel quel", () => {
    expect(nomAffiche("Foin")).toBe("Foin");
    expect(nomAffiche("Mon tracteur")).toBe("Mon tracteur");
  });
  it("le libellé des frais garde le total en un mot et lit les autres noms", () => {
    expect(libelleFrais("Frais communs en un total")).toBe("Frais de l’écurie, en un total");
    expect(libelleFrais("Frais communs")).toBe("Frais de l’écurie");
    expect(libelleFrais("Personnel")).toBe("Salaires");
  });
});
