import { describe, expect, it } from "vitest";
import { nomDe, parent2 } from "@/components/bs/navigation";

describe("le retour nommé", () => {
  it("la fiche du cheval s'appelle « Sa fiche », sa saisie ne ramène plus à l'Accueil", () => {
    expect(nomDe("/ticket?id=h1")).toBe("Sa fiche");
    expect(parent2("/saisie/cheval/")).toBe("/chevaux?vue=chevaux");
    expect(nomDe(parent2("/saisie/cheval/"))).toBe("Clients");
  });
});
