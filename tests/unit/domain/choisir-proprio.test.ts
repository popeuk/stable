import { describe, expect, it } from "vitest";
import { decrire } from "@/components/bs/choisir-proprio";

/** Dans la fiche de Cheval 3, sa propriétaire n'« a » pas « déjà Cheval 3 ». */
describe("ce que le propriétaire choisi a déjà", () => {
  it("sans le cheval qu'on modifie", () => {
    expect(decrire(["Cheval 3"], "Cheval 3")).toBe("propriétaire de Cheval 3");
    expect(decrire(["Cheval 3", "Pacha"], "Cheval 3")).toBe("a aussi Pacha");
    expect(decrire(["Pacha"], "Cheval 3")).toBe("a déjà Pacha");
    expect(decrire(["Pacha"])).toBe("a déjà Pacha");
    expect(decrire([])).toBe("déjà dans tes clients");
  });
});
