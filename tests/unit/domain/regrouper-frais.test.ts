import { describe, expect, it } from "vitest";
import { regrouperFrais } from "@/lib/domain/ticket";

/** Mon bilan : une seule ligne « Frais de l'écurie », avec le noté et l'estimé dedans. */
describe("les frais de l'écurie dans Mon bilan", () => {
  it("le total des premiers pas et la vraie dépense font une ligne", () => {
    const nom = (l: string) => (/^Frais communs/.test(l) ? "Frais de l’écurie" : l);
    const out = regrouperFrais(
      [
        { label: "Frais communs", amount: 600, reel: 600 },
        { label: "Frais communs en un total", amount: 400, estime: 400 },
        { label: "Eau", amount: 50, reel: 50 },
      ],
      nom,
    );
    expect(out).toEqual([
      { label: "Frais de l’écurie", amount: 1000, reel: 600, estime: 400 },
      { label: "Eau", amount: 50, reel: 50 },
    ]);
  });
});
