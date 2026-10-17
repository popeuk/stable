import { describe, expect, it } from "vitest";
import { aideParId, aidePour } from "@/lib/aide";

describe("l'aide de l'écran Clients", () => {
  it("chaque onglet a la sienne, qui parle de ce qu'on voit", () => {
    expect(aidePour("/chevaux")?.id).toBe("clients");
    expect(aidePour("/chevaux?vue=clients")?.id).toBe("clients");
    expect(aidePour("/chevaux?vue=chevaux")?.id).toBe("chevaux");
    expect(aideParId("clients")?.points.join(" ")).not.toContain("Passe sur « Clients »");
    expect(aideParId("chevaux")?.points.join(" ")).not.toContain("Passe sur « Chevaux »");
  });
  it("plus de ticket ni de pot commun", () => {
    for (const id of ["accueil", "ticket", "depenses", "chevaux", "clients", "part"]) {
      const a = aideParId(id);
      const t = a ? [a.titre, ...a.points].join(" ") : "";
      expect(t).not.toMatch(/ticket|pot commun/i);
    }
  });
});
