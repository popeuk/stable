import { describe, expect, it } from "vitest";
import { altPerso, illPerso } from "@/components/bs/perso";

describe("le texte de remplacement suit le personnage", () => {
  it("« contre elle » devient « contre lui » chez le gérant", () =>
    expect(altPerso("La gérante sourit à son téléphone, son cheval tout contre elle.", "m")).toBe("Le gérant sourit à son téléphone, son cheval tout contre lui."));
  it("la gérante garde ses pronoms", () =>
    expect(altPerso("La gérante sourit à son téléphone, son cheval tout contre elle.", "f")).toBe("La gérante sourit à son téléphone, son cheval tout contre elle."));
  it("« à côté d'elle » devient « à côté de lui »", () => expect(altPerso("La gérante, son cheval à côté d’elle.", "m")).toBe("Le gérant, son cheval à côté de lui."));
  it("la rosette de la fiche client suit le tirage", () => {
    expect(illPerso("rosette", "m").n).toBe("gerant-rosette");
    expect(illPerso("rosette", "f").n).toBe("rosette");
  });
});
