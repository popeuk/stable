import { describe, expect, it } from "vitest";
import { messagePanier, paniers, prenom, quand } from "@/lib/domain/paniers";
import type { StableData } from "@/lib/domain/types";

const H = (id: string, name: string, ownerName?: string) => ({ id, stableId: "s", name, ownerName, entryDate: "2026-01-01", isArchived: false });
const S = (o: Record<string, unknown>) => ({ prestationId: "x", horseIds: [], participants: [], status: "planned", unitPrice: 0, rev: 0, start: "10:00", end: "11:00", ...o });

const data = {
  horses: [H("h1", "Sirius", "Léa B."), H("h2", "Tonnerre", "Hugo L."), H("h3", "Éclair", "Léa B."), H("h4", "Diva", "Inès R.")],
  revenueCategories: [{ id: "c", name: "Cours" }],
  people: [
    { id: "p1", name: "Emma", role: "cavalier", active: true },
    { id: "p2", name: "Lucie", role: "cavalier", active: true },
  ],
  seances: [
    // Travail du cheval de Léa : pas de cavalier, payé par la propriétaire.
    S({ id: "s1", title: "Cours", horseIds: ["h1"], date: "2026-10-13", unitPrice: 35 }),
    // Cours collectif : Emma et Lucie, chacune son panier.
    S({ id: "s2", title: "Cours collectif", date: "2026-10-13", start: "18:00", end: "19:00", unitPrice: 25, horseIds: ["h2"], participants: [{ personId: "p1", horseId: "h2" }, { personId: "p2", horseId: "h2" }] }),
    // Balade d'Emma seule.
    S({ id: "s3", title: "Balade", date: "2026-10-12", start: "17:00", end: "18:00", unitPrice: 50, horseIds: ["h2"], participants: [{ personId: "p1", horseId: "h2" }] }),
    // Pas encore finie : pas dans les paniers.
    S({ id: "s4", title: "Cours", horseIds: ["h1"], date: "2026-10-14", start: "18:00", end: "19:00", unitPrice: 35 }),
    // Déjà faite : pas dans les paniers.
    S({ id: "s5", title: "Cours", horseIds: ["h1"], date: "2026-10-12", unitPrice: 35, status: "done" }),
    // Gratuite : rien à valider côté client.
    S({ id: "s6", title: "Travail", horseIds: ["h2"], date: "2026-10-12", unitPrice: 0 }),
  ],
  careEvents: [
    // Ferrure refacturée à Inès.
    { id: "e1", stableId: "s", horseId: "h4", kind: "ferrure", date: "2026-10-12", pending: true, cost: 70, revenue: 78 },
    // Vaccin au coût seul : reste dans la journée, pas dans un panier.
    { id: "e2", stableId: "s", horseId: "h2", kind: "vaccin", date: "2026-10-12", pending: true, cost: 60 },
    // Douche des deux chevaux de Léa, groupée.
    { id: "e3", stableId: "s", horseId: "h1", kind: "prestation", date: "2026-10-13", pending: true, revenue: 20, groupId: "g" },
    { id: "e4", stableId: "s", horseId: "h3", kind: "prestation", date: "2026-10-13", pending: true, revenue: 20, groupId: "g" },
  ],
} as unknown as StableData;

const out = paniers(data, "2026-10-14", "12:00");
const by = (c: string) => out.find((p) => p.client === c)!;

describe("les paniers", () => {
  it("groupe par client, du plus gros au plus petit", () => {
    expect(out.map((p) => [p.client, p.total])).toEqual([
      ["Inès R.", 78],
      ["Emma", 75],
      ["Léa B.", 75],
      ["Lucie", 25],
    ]);
  });

  it("met la séance collective dans le panier de chaque participant, marquée", () => {
    const emma = by("Emma");
    const lucie = by("Lucie");
    const c = emma.lignes.find((l) => l.seanceId === "s2")!;
    expect(c).toMatchObject({ collective: true, amount: 25, type: "seance" });
    expect(lucie.lignes).toHaveLength(1);
    expect(lucie.lignes[0]).toMatchObject({ seanceId: "s2", collective: true });
    expect(lucie.role).toBe("cavalier");
    expect(c.key).not.toBe(lucie.lignes[0].key);
  });

  it("range le soin refacturé chez le propriétaire, regroupe les chevaux", () => {
    expect(by("Inès R.")).toMatchObject({ role: "proprietaire", horses: ["Diva"], total: 78 });
    expect(by("Inès R.").lignes[0]).toMatchObject({ type: "soin", careIds: ["e1"], amount: 78, label: "Ferrure de Diva" });
    const douche = by("Léa B.").lignes.find((l) => l.type === "soin")!;
    expect(douche).toMatchObject({ careIds: ["e3", "e4"], amount: 40 });
  });

  it("laisse dehors le soin au coût seul, les séances gratuites, faites ou pas finies", () => {
    expect(out.flatMap((p) => p.lignes).some((l) => l.careIds?.includes("e2"))).toBe(false);
    const seances = out.flatMap((p) => p.lignes).map((l) => l.seanceId).filter(Boolean);
    expect(seances).not.toContain("s4");
    expect(seances).not.toContain("s5");
    expect(seances).not.toContain("s6");
  });

  it("trie les lignes par date puis heure et nomme le cheval du propriétaire", () => {
    const emma = by("Emma");
    expect(emma.lignes.map((l) => l.seanceId)).toEqual(["s3", "s2"]);
    expect(emma.lignes[0]).toMatchObject({ label: "Balade", sub: "lundi 17:00", collective: false });
    expect(by("Léa B.").lignes[0]).toMatchObject({ label: "Cours de Sirius", seanceId: "s1" });
    expect(by("Léa B.").horses).toEqual(["Sirius", "Éclair"]);
  });

  it("garde un ordre stable à total égal (nom du client)", () => {
    const ties = out.filter((p) => p.total === 75).map((p) => p.client);
    expect(ties).toEqual(["Emma", "Léa B."]);
  });
});

describe("le message et les dates", () => {
  it("écrit la date courte de la semaine, sinon le jour du mois", () => {
    expect(quand("2026-10-13", "2026-10-14", "10:00")).toBe("mardi 10:00");
    expect(quand("2026-10-01", "2026-10-14")).toBe("1 oct.");
  });
  it("prépare le message avec le détail, le total et la signature", () => {
    const m = messagePanier("Léa B.", [{ label: "Cours de Sirius", sub: "mardi 10:00", amount: 35 }, { label: "Douche", sub: "mardi", amount: 105 }], "Claire, Les Trois Pommiers");
    expect(prenom("Léa B.")).toBe("Léa");
    expect(m.split("\n")).toEqual([
      "Bonjour Léa,",
      "voici ce qui a eu lieu ces derniers jours :",
      "Cours de Sirius, mardi 10:00 : 35 €",
      "Douche, mardi : 105 €",
      "Total : 140 €.",
      "Claire, Les Trois Pommiers",
    ]);
  });
});
