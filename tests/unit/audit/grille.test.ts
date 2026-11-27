import { describe, it, expect } from "vitest";
import type { StableData } from "@/lib/domain/types";
import { GRILLE, VOLETS, mesureFiche, mesureVivre, noteDe, premiersGestes, resultats, type FicheGrille } from "@/lib/audit/grille";

const NOW = new Date("2026-11-27T15:00:00");

const fiche = (p: Partial<FicheGrille> = {}): FicheGrille => ({
  en_attente: false,
  site: "",
  places_libres: "",
  places_maj: undefined,
  prix_min: "",
  formules: [],
  photos: [],
  description: "",
  telephone: "",
  email: "",
  ...p,
});

const data = (p: Partial<StableData> = {}): StableData => ({
  horses: [],
  revenues: [],
  directExpenses: [],
  sharedExpenses: [],
  revenueCategories: [{ id: "cat-pension", name: "Pension" }],
  expenseCategories: [],
  ...p,
});

describe("la grille d'audit", () => {
  it("a trente critères, dix par volet, chacun avec sa règle à 2, 1 et 0", () => {
    expect(GRILLE).toHaveLength(30);
    for (const v of VOLETS) expect(GRILLE.filter((c) => c.volet === v.key)).toHaveLength(10);
    for (const c of GRILLE) for (const p of [0, 1, 2] as const) expect(c.regle[p].length).toBeGreaterThan(0);
    expect(new Set(GRILLE.map((c) => c.id)).size).toBe(30);
  });

  it("ne juge jamais ce qu'elle n'a pas lu : Google, annonces et réseaux restent à mesurer", () => {
    const r = mesureFiche(fiche({ site: "https://ecurie.fr" }), [], [], NOW);
    for (const id of ["t-google", "t-avis", "t-facebook", "t-instagram", "t-annonces", "t-nap", "t-lien", "c-memes-prix", "c-capacite", "c-conditions", "t-site"]) expect(r[id].points).toBeNull();
  });

  it("sans fiche à son nom, la fiche bestable.fr vaut 0 et le reste attend", () => {
    const r = mesureFiche(null, [], [], NOW);
    expect(r["t-bestable"].points).toBe(0);
    expect(r["c-prix"].points).toBeNull();
  });

  it("lit la fiche avec la règle écrite", () => {
    const r = mesureFiche(
      fiche({
        places_libres: "2",
        places_maj: "2026-11-20",
        formules: [
          { nom: "Pré", description: "Foin à volonté, abri, eau", prix: "290", places: "" },
          { nom: "Box", description: "", prix: "", places: "" },
        ],
        photos: Array.from({ length: 4 }, (_, i) => ({ id: i, url: "x" })),
        telephone: "06",
        email: "a@b.fr",
      }),
      [],
      [],
      NOW,
    );
    expect(r["t-bestable"].points).toBe(2);
    expect(r["t-site"].points).toBe(0);
    expect(r["c-prix"].points).toBe(1);
    expect(r["c-compris"].points).toBe(1);
    expect(r["c-places"].points).toBe(2);
    expect(r["c-photos"].points).toBe(1);
    expect(r["c-atout"].points).toBe(0);
    expect(r["c-joindre"].points).toBe(2);
    expect(r["c-reponse"].points).toBeNull();
  });

  it("compte les demandes qui attendent depuis plus d'un jour", () => {
    const d = [
      { id: 1, date: "2026-11-20T10:00:00", reponses: [] },
      { id: 2, date: "2026-11-21T10:00:00", reponses: [] },
      { id: 3, date: "2026-11-22T10:00:00", reponses: [] },
    ];
    expect(mesureFiche(fiche(), d, [], NOW)["c-reponse"].points).toBe(0);
    expect(mesureFiche(fiche(), d, [1, 2], NOW)["c-reponse"].points).toBe(1);
    expect(mesureFiche(fiche(), d, [1, 2, 3], NOW)["c-reponse"].points).toBe(2);
  });

  it("lit « En vivre » dans les données, sans rien estimer", () => {
    const r = mesureVivre({ data: data(), capacity: 0, objective: 0, objectiveCa: 0 }, NOW);
    expect(r["v-couvre"].points).toBeNull();
    expect(r["v-remplissage"].points).toBeNull();
    expect(r["v-prix"].points).toBeNull();
    expect(r["v-validees"].points).toBe(2);
    expect(r["v-frais"].points).toBe(0);
    expect(r["v-sources"].points).toBe(0);
    expect(r["v-objectif"].points).toBe(0);
    expect(r["v-hausse"].points).toBeNull();
  });

  it("l'objectif : un chiffre d'affaires visé vaut 2, seulement ce qui doit rester vaut 1", () => {
    expect(mesureVivre({ data: data(), capacity: 0, objective: 0, objectiveCa: 8000 }, NOW)["v-objectif"].points).toBe(2);
    expect(mesureVivre({ data: data(), capacity: 0, objective: 1000, objectiveCa: 0 }, NOW)["v-objectif"].points).toBe(1);
  });

  it("garde la réponse du gérant sans la noter", () => {
    const r = mesureVivre({ data: data({ reponsesAudit: { "v-foin": "220 € la tonne, 40 t par an" } }), capacity: 0, objective: 0, objectiveCa: 0 }, NOW);
    expect(r["v-foin"].points).toBeNull();
    expect(r["v-foin"].constat).toContain("220 € la tonne");
  });

  it("note un volet sur ce qui est mesuré, et propose d'abord les gestes à 0", () => {
    const l = resultats({ fiche: fiche({ places_libres: "1" }), demandes: [], repondues: [], data: data(), capacity: 0, objective: 0, objectiveCa: 0, maintenant: NOW });
    expect(l).toHaveLength(30);
    const n = noteDe(l);
    expect(n.sur).toBe(n.mesures * 2);
    expect(n.mesures + n.aMesurer).toBe(30);
    const g = premiersGestes(l);
    expect(g.length).toBeLessThanOrEqual(3);
    expect(g.every((x) => x.r.points === 0)).toBe(true);
  });
});

describe("l'audit en ligne dans la grille", () => {
  const base = { demandes: [], repondues: [], data: data(), capacity: 0, objective: 0, objectiveCa: 0, maintenant: NOW };
  it("complète ce que l'appareil n'a pas lu, sans écraser ce qu'il a lu", () => {
    const l = resultats({
      ...base,
      fiche: fiche({ places_libres: "1" }),
      enLigne: {
        "t-google": { points: 2, constat: "Ta fiche Google existe, 22 avis à 5,0." },
        "c-places": { points: 0, constat: "Rien sur les places." },
      },
    });
    expect(l.find((x) => x.id === "t-google")!.r.points).toBe(2);
    expect(l.find((x) => x.id === "c-places")!.r.points).toBe(2);
  });
});
