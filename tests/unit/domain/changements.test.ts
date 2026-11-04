import { describe, expect, it } from "vitest";
import { annuler, appliquerDus, changementEnMots, changementValable, chevauxAJour, programmer } from "@/lib/domain/changements";
import type { Horse } from "@/lib/domain/types";

const h = (extra: Partial<Horse> = {}): Horse => ({ id: "a", stableId: "s", name: "Pacha", entryDate: "2026-01-01", isArchived: false, pension: 390, pensionType: "Pension", ...extra }) as Horse;

describe("changements de formule ou de prix", () => {
  it("se programment dans l'ordre et remplacent un changement du même mois", () => {
    let x = programmer(h(), { depuis: "2027-01", pension: 520 });
    x = programmer(x, { depuis: "2026-12", pension: 490, pensionType: "Pension travail" });
    x = programmer(x, { depuis: "2027-01", pension: 530 });
    expect(x.aVenir).toEqual([
      { depuis: "2026-12", pension: 490, pensionType: "Pension travail" },
      { depuis: "2027-01", pension: 530 },
    ]);
    expect(annuler(x, "2026-12").aVenir).toEqual([{ depuis: "2027-01", pension: 530 }]);
    expect(annuler(annuler(x, "2026-12"), "2027-01").aVenir).toBeUndefined();
  });

  it("ne changent rien avant leur mois", () => {
    const x = programmer(h(), { depuis: "2026-12", pension: 490 });
    const { cheval, appliques } = appliquerDus(x, "2026-11");
    expect(appliques).toEqual([]);
    expect(cheval.pension).toBe(390);
  });

  it("s'appliquent à leur mois, le dernier gagne, et quittent la liste", () => {
    let x = programmer(h(), { depuis: "2026-12", pension: 490, pensionType: "Pension travail" });
    x = programmer(x, { depuis: "2027-01", pension: 520 });
    x = programmer(x, { depuis: "2027-06", pensionType: "Retraite" });
    const { cheval, appliques } = appliquerDus(x, "2027-02");
    expect(appliques).toHaveLength(2);
    expect(cheval.pension).toBe(520);
    expect(cheval.pensionType).toBe("Pension travail");
    expect(cheval.aVenir).toEqual([{ depuis: "2027-06", pensionType: "Retraite" }]);
  });

  it("un cheval qui devient le sien n'a plus de pension", () => {
    const x = programmer(h(), { depuis: "2026-12", pension: 0, pensionType: "À moi" });
    const { cheval } = appliquerDus(x, "2026-12");
    expect(cheval.pensionType).toBe("À moi");
    expect(cheval.pension).toBeUndefined();
    expect(cheval.aVenir).toBeUndefined();
  });

  it("met tous les chevaux à jour et dit lesquels ont changé", () => {
    const horses = [programmer(h(), { depuis: "2026-11", pension: 450 }), h({ id: "b" })];
    const r = chevauxAJour(horses, "2026-11");
    expect(r.changes.map((c) => c.horseId)).toEqual(["a"]);
    expect(r.horses[0].pension).toBe(450);
    expect(r.horses[1]).toBe(horses[1]);
    expect(chevauxAJour([h()], "2026-11").horses).toHaveLength(1);
  });

  it("refuse un changement vide ou mal daté, et le dit en mots", () => {
    expect(changementValable({ depuis: "2026-12" })).toBe(false);
    expect(changementValable({ depuis: "2026-13", pension: 490 })).toBe(false);
    expect(changementValable({ depuis: "2026-12", pension: 490 })).toBe(true);
    expect(changementEnMots({ depuis: "2026-12", pension: 490, pensionType: "Pension travail" }).replace(/\s/g, " ")).toBe("À partir de décembre 2026 : Pension travail, 490 € par mois");
  });
});
