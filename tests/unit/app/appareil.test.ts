import { describe, expect, it } from "vitest";
import { appareilDe, cetAppareil, ouSontLesChiffres } from "@/lib/appareil";

describe("où sont les chiffres", () => {
  it("un iPhone ou un écran étroit est un téléphone, un grand écran un ordinateur", () => {
    expect(appareilDe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 1200)).toBe("téléphone");
    expect(appareilDe("Mozilla/5.0 (Macintosh)", 390)).toBe("téléphone");
    expect(appareilDe("Mozilla/5.0 (Macintosh)", 1440)).toBe("ordinateur");
  });
  it("sans compte : sur l'appareil ; avec un compte : aussi dans la copie en ligne", () => {
    expect(ouSontLesChiffres(false, "ordinateur")).toBe("sur cet ordinateur");
    expect(ouSontLesChiffres(true, "téléphone")).toBe("sur ce téléphone et dans ta copie en ligne, protégée");
    expect(cetAppareil("téléphone")).toBe("ce téléphone");
  });
});
