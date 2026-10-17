/*
 * Test d'impression : la facture, l'avoir et le registre sortent-ils en PDF
 * avec leur contenu, au bon format, et un autre écran ne sort-il pas blanc ?
 *
 * Il ouvre la démo par son vrai bouton, fait une facture par le parcours
 * (vendeur, TVA, client, aperçu, « Faire la facture »), l'imprime en PDF
 * (Chromium, page.pdf), puis l'annule par un avoir et l'imprime, imprime le
 * registre et l'accueil ; il lit le texte et la taille des pages avec
 * pdftotext et pdfinfo (poppler). Dans WebKit (Safari), qui n'imprime pas
 * en PDF sous Playwright, il émule l'impression et vérifie que la feuille de
 * la facture est la seule chose visible.
 *
 * Le lancer, sur un export servi sous /stable :
 *   DEPLOY_TARGET=pages PAGES_BASE=/stable NEXT_PUBLIC_BASE_PATH=/stable npm run build
 *   mkdir -p /tmp/site && cp -R out /tmp/site/stable && (cd /tmp/site && python3 -m http.server 4601 &)
 *   NODE_PATH=<dossier node_modules qui contient playwright> npm run test:impression
 * Variables : BASE (http://localhost:4601/stable), CLIENT (Hugo L.), SORTIE
 * (dossier des PDF, ./impression-test). Code de sortie 1 au premier échec.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- un script CommonJS : NODE_PATH ne sert qu'à require(). */
const { chromium, webkit } = require("playwright");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE || "http://localhost:4601/stable";
const CLIENT = process.env.CLIENT || "Hugo L.";
const OUT = path.resolve(process.env.SORTIE || "impression-test");
fs.mkdirSync(OUT, { recursive: true });

let echecs = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) echecs++;
};

/** Le texte et la taille des pages d'un PDF. */
function lirePdf(file) {
  const texte = execFileSync("pdftotext", ["-layout", file, "-"]).toString();
  const info = execFileSync("pdfinfo", [file]).toString();
  const m = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(info);
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  return { texte, pages, w: m ? Number(m[1]) : 0, h: m ? Number(m[2]) : 0 };
}
const portrait = (p) => p.h > p.w && Math.abs(p.w - 595) < 3;
const paysage = (p) => p.w > p.h && Math.abs(p.h - 595) < 3;

async function contexte(type, viewport) {
  const b = await type.launch();
  const ctx = await b.newContext({ viewport, serviceWorkers: "block", locale: "fr-FR", timezoneId: "Europe/Paris" });
  await ctx.route(/mon-ecurie\.fr/, (r) => r.abort());
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${BASE}/bienvenue/`, { waitUntil: "networkidle" });
  await p.getByText(/Juste regarder/i).first().click();
  await p.waitForURL(/accueil/, { timeout: 15000 });
  return { b, p, erreurs };
}

async function faireFacture(p) {
  const mois = new Date().toISOString().slice(0, 7);
  await p.goto(`${BASE}/facture/?nom=${encodeURIComponent(CLIENT)}&mois=${mois}`, { waitUntil: "networkidle" });
  const champ = (label) => p.locator("label.field", { hasText: label }).locator("input, textarea").first();
  if (await p.getByText("Pour faire une facture, il faut").count()) {
    await champ("Nom ou raison sociale").fill("Écurie d’essai");
    await champ("Forme juridique").fill("EI");
    await champ("Adresse").fill("12 chemin des Prés\n72000 Le Mans");
    await champ("SIRET").fill("123 456 789 00012");
    await p.getByRole("button", { name: "Continuer" }).click();
  }
  if (await p.getByRole("radio", { name: "Sans TVA" }).count()) {
    await p.getByRole("radio", { name: "Sans TVA" }).click();
    await p.getByRole("button", { name: "Continuer" }).click();
  }
  if (await p.getByRole("radio", { name: "Un particulier" }).count()) {
    await p.getByRole("radio", { name: "Un particulier" }).click();
    await p.getByRole("button", { name: "Voir l’aperçu" }).click();
  }
  await p.getByRole("button", { name: "Faire la facture" }).click();
  await p.waitForURL(/[?&]n=/, { timeout: 10000 });
  await p.waitForTimeout(400);
  return decodeURIComponent(/[?&]n=([^&]+)/.exec(p.url())[1]);
}

async function pdf(p, nom) {
  const file = path.join(OUT, `${nom}.pdf`);
  await p.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
  return lirePdf(file);
}

(async () => {
  /* ---------- Chromium : les PDF ---------- */
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const t = `${viewport.width}`;
    const { b, p, erreurs } = await contexte(chromium, viewport);
    const numero = await faireFacture(p);
    ok(/^\d{4}-\d{4}$/.test(numero), `[${t}] facture faite : n° ${numero}`);
    ok((await p.title()).startsWith(`Facture ${numero} `), `[${t}] titre du document (nom du PDF) : « ${await p.title()} »`);
    const f = await pdf(p, `facture-${t}`);
    ok(portrait(f) && f.pages === 1, `[${t}] facture : ${f.pages} page A4 portrait (${f.w} x ${f.h})`);
    ok(f.texte.includes("Facture") && f.texte.includes(numero) && f.texte.includes(CLIENT) && f.texte.includes("Reste à payer"), `[${t}] facture : numéro, client et « Reste à payer » dans le PDF`);
    ok(f.texte.includes("Écurie d’essai EI") && f.texte.includes("SIRET 123 456 789 00012"), `[${t}] facture : vendeur, EI, SIRET`);
    ok(f.texte.includes("TVA non applicable, art. 293 B du CGI"), `[${t}] facture : mention de franchise`);
    ok(!/Registre d.élevage/.test(f.texte) && !f.texte.includes("Imprimer ou enregistrer"), `[${t}] facture : ni le pied du registre, ni l’interface`);

    await p.getByRole("button", { name: "Annuler par un avoir" }).click();
    await p.getByRole("button", { name: /^Faire l’avoir de/ }).click();
    await p.waitForURL((u) => !u.toString().includes(`n=${encodeURIComponent(numero)}`), { timeout: 10000 });
    await p.waitForTimeout(400);
    const avoir = decodeURIComponent(/[?&]n=([^&]+)/.exec(p.url())[1]);
    const a = await pdf(p, `avoir-${t}`);
    ok(portrait(a) && a.pages === 1, `[${t}] avoir n° ${avoir} : ${a.pages} page A4 portrait`);
    ok(a.texte.includes("Avoir") && a.texte.includes(avoir) && a.texte.includes(`Sur la facture n° ${numero}`) && a.texte.includes("−"), `[${t}] avoir : numéro, facture annulée, montants négatifs`);

    await p.goto(`${BASE}/registre/`, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);
    const r = await pdf(p, `registre-${t}`);
    ok(paysage(r) && r.pages >= 1, `[${t}] registre : ${r.pages} page(s) A4 paysage (${r.w} x ${r.h})`);
    ok(/Registre d.élevage/.test(r.texte) && /Page 1 sur/.test(r.texte), `[${t}] registre : titre et numéro de page`);

    await p.goto(`${BASE}/accueil/`, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);
    const acc = await pdf(p, `accueil-${t}`);
    ok(acc.texte.replace(/\s+/g, "").length > 200 && !/Registre d.élevage/.test(acc.texte), `[${t}] accueil imprimé : pas une page blanche (${acc.texte.replace(/\s+/g, "").length} caractères)`);
    ok(!erreurs.length, `[${t}] aucune erreur JavaScript${erreurs.length ? ` : ${erreurs.join(" | ")}` : ""}`);
    await b.close();
  }

  /* ---------- WebKit : l'impression émulée ---------- */
  {
    const { b, p, erreurs } = await contexte(webkit, { width: 390, height: 844 });
    const numero = await faireFacture(p);
    await p.emulateMedia({ media: "print" });
    const vu = await p.evaluate(() => {
      const f = document.querySelector(".fa-print");
      const r = f?.getBoundingClientRect();
      const visibles = [...document.querySelectorAll("button, nav, .tb, .hd")].filter((e) => {
        const x = e.getBoundingClientRect();
        return x.width > 0 && x.height > 0 && getComputedStyle(e).visibility !== "hidden";
      }).length;
      return { h: r?.height ?? 0, texte: f?.textContent ?? "", visibles };
    });
    ok(vu.h > 300 && vu.texte.includes(numero), `[webkit] facture imprimée : feuille visible (${Math.round(vu.h)} px) avec le n° ${numero}`);
    ok(vu.visibles === 0, `[webkit] facture imprimée : aucun bouton ni barre (${vu.visibles} visibles)`);
    await p.emulateMedia({ media: "screen" });
    await p.goto(`${BASE}/registre/`, { waitUntil: "networkidle" });
    await p.emulateMedia({ media: "print" });
    const reg = await p.evaluate(() => {
      const r = document.querySelector(".rg-print")?.getBoundingClientRect();
      const carnet = document.querySelector(".carnet");
      return { h: r?.height ?? 0, carnet: carnet ? getComputedStyle(carnet).display : "absent" };
    });
    ok(reg.h > 300 && reg.carnet === "none", `[webkit] registre imprimé : la feuille seule (${Math.round(reg.h)} px, écran ${reg.carnet})`);
    ok(!erreurs.length, `[webkit] aucune erreur JavaScript${erreurs.length ? ` : ${erreurs.join(" | ")}` : ""}`);
    await b.close();
  }

  console.log(echecs ? `\n${echecs} échec(s). PDF dans ${OUT}` : `\nTout est bon. PDF dans ${OUT}`);
  process.exit(echecs ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
