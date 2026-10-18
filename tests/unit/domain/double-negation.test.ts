import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resteOuManque } from "@/lib/domain/lecture";

describe("le verbe porte le sens, le nombre n'a pas de signe", () => {
  it("négatif : il te manque ; positif ou nul : il te reste", () => {
    expect(resteOuManque(-617)).toBe("il te manque");
    expect(resteOuManque(617)).toBe("il te reste");
    expect(resteOuManque(0)).toBe("il te reste");
    expect(resteOuManque(-0.3)).toBe("il te reste");
  });

  it("aucun écran ne dit plus « il te manque » suivi d'un nombre signé", () => {
    const fichiers = ["components/bs/shell.tsx", "components/bs/compteur.tsx", "components/bs/tournee.tsx", "app/(app)/argent/page.tsx"];
    for (const f of fichiers) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s, f).not.toMatch(/il te manque" : "il te reste"\} \$\{sg\(/);
      expect(s, f).not.toMatch(/"Ce mois, il te reste"/);
    }
  });
});
