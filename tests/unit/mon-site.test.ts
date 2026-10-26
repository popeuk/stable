import { describe, expect, it } from "vitest";
import { accroche, adresseOfferte, lienPaiement, messageDemande, metierDe } from "@/lib/mon-site";

const base = { offres: [] as string[], hebergement: [] as string[], formules: [], prix_min: "", places_libres: "" };

describe("Mon site", () => {
  it("fait une adresse propre à partir du nom", () => {
    expect(adresseOfferte("Écurie du Grand Pré")).toBe("ecurie-du-grand-pre.bestable.fr");
    expect(adresseOfferte("L’Écurie d’Ô !")).toBe("l-ecurie-d-o.bestable.fr");
    expect(adresseOfferte("")).toBe("mon-ecurie.bestable.fr");
  });

  it("devine le métier principal", () => {
    expect(metierDe({ ...base, offres: ["pension"] })).toBe("pension");
    expect(metierDe({ ...base, offres: ["cours", "stages"] })).toBe("centre");
    expect(metierDe({ ...base, offres: ["elevage"] })).toBe("elevage");
    expect(metierDe({ ...base, offres: ["elevage"], prix_min: "300" })).toBe("pension");
    expect(metierDe(base)).toBe("pension");
  });

  it("prend la première phrase de la présentation, sinon une phrase du métier", () => {
    expect(accroche({ description: "Des chevaux au pré toute l’année. Le reste.", commune: "Caen" }, "pension")).toBe("Des chevaux au pré toute l’année.");
    expect(accroche({ description: "Court.", commune: "Caen" }, "centre")).toBe("Cours et stages d’équitation à Caen.");
  });

  it("sans lien réglé, pas de paiement en ligne", () => {
    expect(lienPaiement("site", "mois", 12)).toBeNull();
  });

  it("la demande dit la formule, le prix et l'écurie", () => {
    const m = messageDemande("site", "an", { id: 7, title: "Les Tilleuls", commune: "Bayeux" }, true);
    expect(m).toContain("Le site, 290 € par an");
    expect(m).toContain("nom de domaine (20 € par an)");
    expect(m).toContain("fiche 7");
    expect(m).toContain("les-tilleuls.bestable.fr");
  });
});
