import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { GRILLE, VOLETS } from "@/lib/audit/grille-criteres";

/**
 * Le service d'audit du VPS (deploiement/vps/audit) lit la grille dans grille.json :
 * elle doit rester exactement celle de l'app. BS_ECRIRE_GRILLE=1 la régénère.
 */
const CHEMIN = "deploiement/vps/audit/grille.json";
const attendu = JSON.stringify({ volets: VOLETS.map(({ key, titre, scene, source, neSaitPas }) => ({ key, titre, scene, source, neSaitPas })), grille: GRILLE }, null, 1) + "\n";

describe("la grille du service d'audit", () => {
  it("est la même que celle de l'app", () => {
    if (process.env.BS_ECRIRE_GRILLE === "1" || !existsSync(CHEMIN)) writeFileSync(CHEMIN, attendu);
    expect(readFileSync(CHEMIN, "utf8")).toBe(attendu);
  });
});
