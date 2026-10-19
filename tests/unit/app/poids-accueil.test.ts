import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { poids, scriptsDeLaPage } from "../../../scripts/poids-accueil.mjs";

describe("le poids du JavaScript de l'accueil (scripts/poids-accueil.mjs)", () => {
  it("compte les scripts de la page, une fois chacun, sans ceux des vieux navigateurs", () => {
    const html = `<script src="/_next/a.js" async=""></script><script src="/_next/b.js" noModule=""></script><script src="/_next/a.js"></script><script>self.x=1</script><script src="/_next/c.js"></script>`;
    expect(scriptsDeLaPage(html)).toEqual(["/_next/a.js", "/_next/c.js"]);
  });

  it("additionne le poids compressé (gzip) des fichiers", () => {
    const dir = mkdtempSync(join(tmpdir(), "poids-"));
    mkdirSync(join(dir, "accueil"));
    mkdirSync(join(dir, "_next"));
    const a = "const a = 1;".repeat(400);
    const c = "function c(){return 2}".repeat(300);
    writeFileSync(join(dir, "_next/a.js"), a);
    writeFileSync(join(dir, "_next/c.js"), c);
    writeFileSync(join(dir, "_next/vieux.js"), "x".repeat(50000));
    writeFileSync(join(dir, "accueil/index.html"), `<script src="/_next/a.js"></script><script src="/_next/vieux.js" noModule=""></script><script src="/_next/c.js"></script>`);
    const attendu = (gzipSync(a, { level: 9 }).length + gzipSync(c, { level: 9 }).length) / 1024;
    expect(poids(dir).total).toBeCloseTo(attendu, 5);
  });

  it("le déploiement s'arrête au-delà de 230 Ko (job vps, après le build)", () => {
    const wf = readFileSync(join(process.cwd(), ".github/workflows/pages.yml"), "utf8");
    const vps = wf.slice(wf.indexOf("\n  vps:"));
    const build = vps.indexOf("npm run build");
    const controle = vps.indexOf("node scripts/poids-accueil.mjs 230");
    expect(build).toBeGreaterThan(0);
    expect(controle).toBeGreaterThan(build);
    expect(controle).toBeLessThan(vps.indexOf("Publish to the vps branch"));
  });
});
