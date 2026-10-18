import { describe, expect, it } from "vitest";
import { denomination, detenteurDe, horseGaps, horsesPresent, movementsIn, ownerLine } from "@/lib/domain/registre";
import type { Horse, Person } from "@/lib/domain/types";

/** Registre d'élevage (gérant G11) : tri naturel, nom de facturation, chevaux du gérant, adresse du client. */
const horse = (p: Partial<Horse>): Horse => ({ id: "h", stableId: "s", name: "Cheval", entryDate: "2026-10-01", isArchived: false, ...p });

describe("le tri naturel", () => {
  it("Cheval 2 avant Cheval 10", () => {
    const hs = ["Cheval 10", "Cheval 2", "Cheval 11", "Cheval 1"].map((name, i) => horse({ id: String(i), name }));
    expect(horsesPresent(hs, "2026-10-01", "2026-12-31").map((h) => h.name)).toEqual(["Cheval 1", "Cheval 2", "Cheval 10", "Cheval 11"]);
    expect(movementsIn(hs, "2026-10-01", "2026-12-31").map((m) => m.horseName)).toEqual(["Cheval 1", "Cheval 2", "Cheval 10", "Cheval 11"]);
  });
});

describe("la dénomination", () => {
  it("celle du registre, sinon le nom de facturation, jamais « Mon écurie »", () => {
    expect(denomination({ placeName: "Haras du Pré" }, { legalName: "EARL Martin" }, "Mon écurie")).toBe("Haras du Pré");
    expect(denomination({}, { legalName: "Écurie des Tilleuls" }, "Mon écurie")).toBe("Écurie des Tilleuls");
    expect(denomination(undefined, undefined, "Les Trois Pommiers")).toBe("Les Trois Pommiers");
    expect(denomination(undefined, undefined, "Mon écurie")).toBe("");
  });
});

describe("les chevaux du gérant", () => {
  const moi = detenteurDe({ holderPhone: "06 11 22 33 44" }, { legalName: "Julie Martin", address: "1 rue du Pré\n72000 Le Mans" }, "Julie");
  it("le détenteur : celui du registre, sinon le nom de facturation, sinon le gérant", () => {
    expect(moi).toEqual({ name: "Julie Martin", address: "1 rue du Pré\n72000 Le Mans", phone: "06 11 22 33 44", email: undefined });
    expect(detenteurDe(undefined, undefined, "Julie").name).toBe("Julie");
    expect(detenteurDe({ holderName: "SCEA du Pré" }, { legalName: "X" }, "Julie").name).toBe("SCEA du Pré");
  });
  it("un cheval « À moi » a le gérant pour propriétaire, et ne manque pas de propriétaire", () => {
    const h = horse({ name: "Mon cheval 1", pensionType: "À moi" });
    expect(ownerLine(h, [], moi)).toBe("Julie Martin, 1 rue du Pré, 72000 Le Mans, 06 11 22 33 44");
    expect(horseGaps(h)).not.toContain("proprietaire");
    expect(horseGaps(horse({ name: "Pacha" }))).toContain("proprietaire");
  });
});

describe("l'adresse du client", () => {
  it("lue sur sa fiche, sur une ligne, avec son téléphone et son courriel", () => {
    const people: Person[] = [{ id: "p", name: "Claire Dubois", role: "proprietaire", active: true, address: "3 allée des Saules\n72000 Le Mans", phone: "06 00 00 00 00", email: "claire@exemple.fr" }];
    expect(ownerLine(horse({ ownerName: "claire  dubois" }), people)).toBe("claire  dubois, 3 allée des Saules, 72000 Le Mans, 06 00 00 00 00, claire@exemple.fr");
    expect(ownerLine(horse({ ownerName: "Inconnu" }), people)).toBe("Inconnu");
  });
});
