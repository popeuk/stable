// Après « next build » : donne au service worker de l'export (out/sw.js) une
// version de cache propre à ce build. Chaque mise en ligne change le nom du
// cache ; à l'activation, le service worker efface les anciens.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

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
} else {
  writeFileSync(SW, src.replaceAll("__BUILD_ID__", stamp));
  console.log(`stamp-sw : cache be-stable-${stamp}`);
}

// La page hors ligne n'est pas une page de l'app : elle reçoit ici le nom
// haché de la police Bricolage (sous-ensemble latin) du build.
const HL = "out/hors-ligne.html";
if (existsSync(HL)) {
  const css = readdirSync("out/_next/static/chunks").filter((f) => f.endsWith(".css")).map((f) => readFileSync(`out/_next/static/chunks/${f}`, "utf8")).join("\n");
  const faces = css.match(/@font-face\{font-family:"?Bricolage Grotesque"?;[^}]*\}/g) ?? [];
  const latin = faces.find((f) => /unicode-range:U\+0000-00FF|unicode-range:U\+\?\?/.test(f)) ?? faces[0];
  const fichier = latin?.match(/url\(\.\.\/media\/([^)]+\.woff2)\)/)?.[1];
  const page = readFileSync(HL, "utf8");
  writeFileSync(HL, page.replaceAll("{{POLICE}}", fichier ? `_next/static/media/${fichier}` : ""));
  console.log(`stamp-sw : police de la page hors ligne ${fichier ?? "introuvable"}`);
}
