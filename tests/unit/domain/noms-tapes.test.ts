import { describe, expect, it } from "vitest";
import { cavaliersRetenus, changerProprio, cleSouple, nomConnu, nomRetenu } from "@/lib/domain/proprio";
import type { StableData } from "@/lib/domain/types";

/**
 * Un nom tapé sans toucher « + Nouveau » (fiche du cheval, séance) n'est
 * plus perdu : il devient un client, ou il retrouve le client qui porte ce
 * nom à la casse et aux accents près.
 */
const noms = ["Hélène Roy", "Claire Dubois", "Emma"];

describe("le nom resté dans le champ", () => {
  it("rien de tapé : rien de retenu", () => {
    expect(nomRetenu(noms, "")).toBeUndefined();
    expect(nomRetenu(noms, "   ")).toBeUndefined();
    expect(nomRetenu(noms, undefined)).toBeUndefined();
  });
  it("un nom inconnu devient un nouveau client, tel que tapé, espaces nettoyés", () => {
    expect(nomRetenu(noms, "  Jade   Martin ")).toBe("Jade Martin");
  });
  it("un client connu est repris, casse et accents confondus", () => {
    expect(nomRetenu(noms, "claire dubois")).toBe("Claire Dubois");
    expect(nomRetenu(noms, "Helene roy")).toBe("Hélène Roy");
    expect(nomRetenu(noms, "HÉLÈNE  ROY")).toBe("Hélène Roy");
  });
  it("la clé souple ignore casse, accents et espaces en trop", () => {
    expect(cleSouple(" Hélène  Roy ")).toBe(cleSouple("helene roy"));
  });
});

describe("les cavaliers d'une séance", () => {
  it("le nom tapé s'ajoute à ceux déjà choisis", () => {
    expect(cavaliersRetenus(["Emma"], "Jade Martin", noms)).toEqual(["Emma", "Jade Martin"]);
  });
  it("sous le nom du client connu, une seule fois", () => {
    expect(cavaliersRetenus([], "claire dubois", noms)).toEqual(["Claire Dubois"]);
    expect(cavaliersRetenus(["Claire Dubois"], "CLAIRE DUBOIS", noms)).toEqual(["Claire Dubois"]);
  });
  it("champ vide ou texte avec une virgule : rien ne change", () => {
    expect(cavaliersRetenus(["Emma"], "", noms)).toEqual(["Emma"]);
    expect(cavaliersRetenus(["Emma"], "Jade, Léo", noms)).toEqual(["Emma"]);
  });
});

describe("le propriétaire tapé sur la fiche du cheval", () => {
  const data = (): StableData => ({
    horses: [{ id: "h1", stableId: "s", name: "Pacha", entryDate: "2026-01-01", isArchived: false }],
    revenues: [],
    directExpenses: [],
    sharedExpenses: [],
    revenueCategories: [],
    expenseCategories: [],
    people: [{ id: "p1", name: "Hélène Roy", role: "proprietaire", active: true }],
  });
  it("sans accent, c'est la même cliente", () => {
    expect(nomConnu(data(), "helene roy")).toBe("Hélène Roy");
    const c = changerProprio(data(), "h1", "Helene Roy", "2026-10-19", () => "nouveau");
    expect(c.owner).toBe("Hélène Roy");
    expect(c.people).toHaveLength(1);
  });
  it("un nom inconnu crée un nouveau client propriétaire", () => {
    const c = changerProprio(data(), "h1", "Claire Dubois", "2026-10-19", () => "p2");
    expect(c.horses[0].ownerName).toBe("Claire Dubois");
    expect(c.people.find((p) => p.id === "p2")).toMatchObject({ name: "Claire Dubois", role: "proprietaire", active: true });
  });
});
