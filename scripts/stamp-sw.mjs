// Après « next build » : donne au service worker de l'export (out/sw.js) une
// version de cache propre à ce build. Chaque mise en ligne change le nom du
// cache ; à l'activation, le service worker efface les anciens.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SW = "out/sw.js";
if (!existsSync(SW)) {
  console.log("stamp-sw : pas d'export statique (out/sw.js absent), rien à faire.");
  process.exit(0);
}
const id = existsSync(".next/BUILD_ID") ? readFileSync(".next/BUILD_ID", "utf8").trim() : "";
const stamp = `${id || "build"}-${Date.now().toString(36)}`.replace(/[^\w-]/g, "");
const src = readFileSync(SW, "utf8");
if (!src.includes("__BUILD_ID__")) {
  console.log("stamp-sw : out/sw.js déjà estampillé.");
  process.exit(0);
}
writeFileSync(SW, src.replaceAll("__BUILD_ID__", stamp));
console.log(`stamp-sw : cache be-stable-${stamp}`);
