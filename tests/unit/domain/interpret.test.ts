import { describe, it, expect } from "vitest";
import { interpretLocal, sanitizeCommand } from "@/lib/domain/interpret";

const CTX = {
  horses: [
    { id: "h1", name: "Belle" },
    { id: "h2", name: "Pacha" },
    { id: "h3", name: "Sirius" },
    { id: "h4", name: "Éclair" },
  ],
  today: "2026-07-06", // un lundi
};

describe("interpretLocal (le vocal en français)", () => {
  it("planifie un cours collectif avec plusieurs chevaux et une recette", () => {
    const { command } = interpretLocal(
      "Planifie un cours collectif demain à 14h avec Belle et Pacha, 25 euros",
      CTX,
    );
    expect(command).toMatchObject({
      kind: "cours_collectif",
      horseIds: ["h1", "h2"],
      date: "2026-07-07",
      revenue: 25,
      label: "14 h",
    });
  });

  it("comprend un rendez-vous vétérinaire un jour de semaine", () => {
    const { command } = interpretLocal("rendez-vous véto pour Sirius jeudi", CTX);
    expect(command).toMatchObject({ kind: "veto", horseIds: ["h3"], date: "2026-07-09" });
  });

  it("« mardi » un lundi = le lendemain, « lundi » = lundi prochain", () => {
    expect(interpretLocal("ferrure de Belle mardi", CTX).command?.date).toBe("2026-07-07");
    expect(interpretLocal("ferrure de Belle lundi", CTX).command?.date).toBe("2026-07-13");
  });

  it("« tous les chevaux » vise toute l'écurie (vermifuge général)", () => {
    const { command } = interpretLocal("vermifuge pour tous les chevaux aujourd'hui", CTX);
    expect(command?.all).toBe(true);
    expect(command?.horseIds).toHaveLength(4);
    expect(command?.kind).toBe("vermifuge");
    expect(command?.date).toBe("2026-07-06");
  });

  it("un montant sur un maréchal est un coût, pas une recette", () => {
    const { command } = interpretLocal("le maréchal est passé pour Pacha, 90€", CTX);
    expect(command?.kind).toBe("ferrure");
    expect(command?.cost).toBe(90);
    expect(command?.revenue).toBeUndefined();
  });

  it("« un cours » seul est individuel, à plusieurs il devient collectif", () => {
    expect(interpretLocal("cours pour Belle demain", CTX).command?.kind).toBe("cours_individuel");
    expect(interpretLocal("cours demain avec Belle, Pacha et Sirius", CTX).command?.kind).toBe(
      "cours_collectif",
    );
  });

  it("tolère les accents et la casse sur les noms", () => {
    const { command } = interpretLocal("vaccin pour eclair le 20", CTX);
    expect(command?.horseIds).toEqual(["h4"]);
    expect(command?.date).toBe("2026-07-20");
  });

  it("« le 3 » déjà passé bascule au mois suivant", () => {
    expect(interpretLocal("dentiste pour Belle le 3", CTX).command?.date).toBe("2026-08-03");
  });

  it("signale ce qui manque au lieu d'inventer", () => {
    const r1 = interpretLocal("planifie un truc demain", CTX);
    expect(r1.command).toBeNull();
    expect(r1.missing.join(" ")).toContain("acte");
    const r2 = interpretLocal("ferrure demain", CTX);
    expect(r2.command).toBeNull();
    expect(r2.missing.join(" ")).toContain("chevaux");
  });
});

describe("sanitizeCommand (le garde-fou de l'LLM)", () => {
  it("résout les noms, filtre les types inconnus, borne les montants", () => {
    const ok = sanitizeCommand(
      { kind: "cours_collectif", horses: ["belle", "PACHA"], date: "2026-07-10", revenue: 25 },
      CTX,
    );
    expect(ok).toMatchObject({ kind: "cours_collectif", horseIds: ["h1", "h2"], revenue: 25 });
    expect(sanitizeCommand({ kind: "licorne", horses: ["Belle"] }, CTX)).toBeNull();
    expect(sanitizeCommand({ kind: "veto", horses: [] }, CTX)).toBeNull();
    const capped = sanitizeCommand(
      { kind: "veto", horses: ["Belle"], cost: -5, date: "pas-une-date" },
      CTX,
    );
    expect(capped?.cost).toBeUndefined();
    expect(capped?.date).toBe(CTX.today);
  });
});
