// Poids du JavaScript de l'accueil : la somme compressée (gzip) des scripts
// que charge out/accueil/index.html, hors scripts pour vieux navigateurs (noModule).
// Usage : node scripts/poids-accueil.mjs [plafond en Ko] [dossier out]
// Sans plafond, affiche le poids ; avec, échoue s'il est dépassé.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export function scriptsDeLaPage(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/g)) {
    const attrs = m[1];
    if (/\bnomodule\b/i.test(attrs)) continue;
    const src = attrs.match(/\bsrc="([^"]+)"/);
    if (src) out.push(src[1]);
  }
  return [...new Set(out)];
}

export function poids(dossier, page = "accueil/index.html") {
  const html = readFileSync(join(dossier, page), "utf8");
  let total = 0;
  const detail = [];
  for (const src of scriptsDeLaPage(html)) {
    const chemin = join(dossier, src.replace(/^https?:\/\/[^/]+/, "").split("?")[0]);
    if (!existsSync(chemin)) continue;
    const ko = gzipSync(readFileSync(chemin), { level: 9 }).length / 1024;
    total += ko;
    detail.push([src, ko]);
  }
  return { total, detail };
}

if (process.argv[1] && process.argv[1].endsWith("poids-accueil.mjs")) {
  const plafond = process.argv[2] ? Number(process.argv[2]) : null;
  const dossier = process.argv[3] ?? "out";
  const { total, detail } = poids(dossier);
  for (const [src, ko] of detail.sort((a, b) => b[1] - a[1])) console.log(`${ko.toFixed(1).padStart(7)} Ko  ${src}`);
  console.log(`Accueil : ${total.toFixed(1)} Ko de JavaScript compressé`);
  if (plafond !== null && total > plafond) {
    console.error(`Trop lourd : plus de ${plafond} Ko. Charge à la demande ce qui ne sert pas au premier affichage.`);
    process.exit(1);
  }
}
