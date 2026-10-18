import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ECURIE } from "@/components/bs/navigation";

describe("hors ligne : les écrans de Mon écurie sont rangés dès l'installation", () => {
  it("chaque écran de Mon écurie est dans la liste du service worker", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    const liste = sw.slice(sw.indexOf("const ECRANS"), sw.indexOf("].map"));
    for (const e of [...ECURIE, "/saisie/cheval"]) expect(liste, e).toContain(`"${e.slice(1)}/"`);
  });
});
