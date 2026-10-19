import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADRESSES_MESURE, MESURE_POSEE } from "@/lib/mesure";

/** La politique de contenu de deploiement/vps/caddy-app.txt suit l'état de la mesure. */
const caddy = readFileSync(join(process.cwd(), "deploiement/vps/caddy-app.txt"), "utf8");
const politique = caddy.match(/^\s*Content-Security-Policy-Report-Only "([^"]+)"/m)?.[1] ?? "";

describe("la politique de contenu", () => {
  it("mesure éteinte : ni Google ni Meta n'y sont autorisés", () => {
    expect(MESURE_POSEE).toBe(false);
    expect(politique).not.toBe("");
    for (const a of [...ADRESSES_MESURE.script, ...ADRESSES_MESURE.connect, ...ADRESSES_MESURE.img]) expect(politique).not.toContain(a);
    expect(politique).not.toMatch(/google|facebook/);
  });
  it("aucun formulaire n'envoie ailleurs, et aucun point de signalement qui n'existe pas", () => {
    expect(politique).toContain("form-action 'self'");
    expect(politique).not.toMatch(/report-(uri|to)/);
  });
});
