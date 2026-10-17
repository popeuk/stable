import { describe, it, expect } from "vitest";
import { draftFor, draftFromCompris, endOf, habitudes, habitues, manque, sansPrixDExemple, titre } from "@/lib/domain/ajouter";
import { comprendre } from "@/lib/domain/dire";
import type { Prestation, Seance } from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";

const TODAY = "2026-10-16";
const prestations: Prestation[] = [
  { id: "prest-cours", label: "Cours d’équitation", price: 25, hasFormat: true, active: true },
  { id: "prest-particulier", label: "Cours particulier", price: 35, active: true },
  { id: "prest-balade", label: "Balade encadrée", price: 20, active: true },
];
const se = (id: string, date: string, start: string, end: string, extra: Partial<Seance> = {}): Seance => ({
  id,
  prestationId: "prest-cours",
  title: "Cours",
  format: "collectif",
  places: 8,
  participants: [],
  horseIds: [],
  date,
  start,
  end,
  status: "done",
  unitPrice: 25,
  rev: 1,
  ...extra,
});
const seances: Seance[] = [
  se("s1", "2026-10-06", "17:30", "18:30", { participants: [{ personId: "lou" }, { personId: "nina" }] }), // mardi
  se("s2", "2026-10-13", "17:30", "18:30", { participants: [{ personId: "lou" }, { personId: "nina" }, { personId: "emma", present: false }] }),
  se("s3", "2026-10-10", "10:00", "11:00", { participants: [{ personId: "emma" }] }), // samedi
  se("s4", "2026-10-09", "14:00", "15:00", { prestationId: "prest-balade", format: undefined, places: undefined, participants: [{ personId: "hugo" }] }),
];
const careEvents: CareEvent[] = [
  { id: "c1", stableId: "x", horseId: "h1", kind: "ferrure", date: "2026-09-01", cost: 80, provider: "M. Roche", start: "09:30" },
  { id: "c2", stableId: "x", horseId: "h2", kind: "ferrure", date: "2026-10-01", cost: 85, provider: "M. Roche", start: "09:30" },
];
const data = { prestations, seances, careEvents, tasks: [] };

describe("habitudes", () => {
  const h = habitudes(data, TODAY);
  it("déduit l’heure, la durée et les places des séances passées", () => {
    const coll = h.cours.find((c) => c.key === "prest-cours:collectif")!;
    expect(coll).toMatchObject({ label: "Cours collectif", price: 25, start: "17:30", dur: 60, places: 8 });
    expect(h.cours[0].key).toBe("prest-cours:collectif"); // le plus utilisé d’abord
  });
  it("sans passé, une heure proposée, mais pas une habitude", () => {
    expect(h.cours.find((c) => c.prestationId === "prest-particulier")).toMatchObject({ start: "10:00", dur: 60, places: 1, habit: false });
  });
  it("deux séances passées à la même heure font une habitude, une seule non", () => {
    expect(h.cours.find((c) => c.key === "prest-cours:collectif")).toMatchObject({ start: "17:30", habit: true });
    expect(h.cours.find((c) => c.prestationId === "prest-balade")).toMatchObject({ start: "14:00", habit: false });
  });
  it("un rythme chaque semaine saisi fait une habitude, même sans passé", () => {
    const serie = [se("w1", "2026-10-20", "19:00", "20:00", { status: "planned", seriesId: "x" }), se("w2", "2026-10-27", "19:00", "20:00", { status: "planned", seriesId: "x" })];
    const hw = habitudes({ prestations, seances: serie, careEvents: [], tasks: [] }, TODAY);
    expect(hw.cours.find((c) => c.key === "prest-cours:collectif")).toMatchObject({ start: "19:00", habit: true });
  });
  it("le dernier prix et le dernier maréchal", () => {
    expect(h.soins[0]).toMatchObject({ kind: "ferrure", price: 85, provider: "M. Roche", start: "09:30" });
  });
  it("des tâches sûres quand il n’y en a pas encore", () => {
    expect(h.quoi).toEqual(["Livraison du foin", "Visite du véto", "Réparer une clôture"]);
  });
});

describe("rien d’inventé le premier jour", () => {
  // Le gérant n'a saisi que le cours collectif à 25 € dans ses tarifs ; ses cours n'ont pas de prix.
  const vides: Prestation[] = prestations.map((p) => ({ ...p, price: 0 })).concat({ id: "prest-travail", label: "Travail du cheval", price: 0, active: true });
  const h = habitudes({ prestations: vides, seances: [], careEvents: [], tasks: [], tariffs: { cours_collectif: 25 } }, TODAY);
  it("seul le prix saisi apparaît", () => {
    expect(h.cours.find((c) => c.key === "prest-cours:collectif")?.price).toBe(25);
    expect(h.cours.find((c) => c.prestationId === "prest-particulier")?.price).toBeUndefined();
    expect(h.cours.find((c) => c.prestationId === "prest-travail")?.price).toBeUndefined();
    expect(h.cours.find((c) => c.prestationId === "prest-balade")?.price).toBeUndefined();
  });
  it("ni places par défaut, ni habitude", () => {
    const coll = h.cours.find((c) => c.key === "prest-cours:collectif")!;
    expect(coll.places).toBeUndefined();
    expect(coll.habit).toBe(false);
    const d = draftFor("seance", h, TODAY);
    expect(d).toMatchObject({ coursKey: "prest-cours:collectif", price: 25, places: null, start: "18:00" });
    expect(h.soins.every((s) => !s.habit)).toBe(true);
  });
  it("les tarifs du cours particulier et du travail prennent le relais", () => {
    const t = habitudes({ prestations: vides, seances: [], careEvents: [], tasks: [], tariffs: { cours_individuel: 40, entrainement: 30 } }, TODAY);
    expect(t.cours.find((c) => c.prestationId === "prest-particulier")?.price).toBe(40);
    expect(t.cours.find((c) => c.prestationId === "prest-travail")?.price).toBe(30);
    expect(t.cours.find((c) => c.key === "prest-cours:collectif")?.price).toBeUndefined();
  });
  it("les prix d’exemple jamais employés s’effacent, les autres restent", () => {
    const mine = [{ ...prestations[0] }, { ...prestations[1] }, { ...prestations[2], price: 22 }];
    const out = sansPrixDExemple(mine, prestations, [{ prestationId: "prest-cours" }]);
    expect(out.map((p) => p.price)).toEqual([25, 0, 22]);
  });
});

describe("le brouillon", () => {
  const h = habitudes(data, TODAY);
  it("une séance est pré-cochée sur le cours habituel", () => {
    const d = draftFor("seance", h, TODAY);
    expect(d).toMatchObject({ coursKey: "prest-cours:collectif", start: "17:30", price: 25, places: 8, date: TODAY });
    expect(titre(d, h)).toBe("Cours collectif");
    expect(manque(d)).toBe(false);
  });
  it("l’argent demande un montant, rien d’autre", () => {
    const d = draftFor("argent", h, TODAY);
    expect(manque(d)).toBe(true);
    d.amount = 350;
    expect(manque(d)).toBe(false);
  });
  it("un rendez-vous sans heure est une tâche", () => {
    const d = draftFor("rdv", h, TODAY);
    expect(d.start).toBeNull();
    expect(titre({ ...d, quoi: "" }, h)).toBe("Tâche");
  });
  it("la présélection d’un cheval passe dans l’argent", () => {
    expect(draftFor("argent", h, TODAY, { horseIds: ["h1"] })).toMatchObject({ pour: "cheval", horseIds: ["h1"] });
  });
  it("une phrase dite complète les habitudes", () => {
    const c = comprendre("Cours collectif demain 18 h, 6 places", { today: TODAY, horses: [], prestations });
    expect(draftFromCompris(c, h, TODAY)).toMatchObject({ coursKey: "prest-cours:collectif", start: "18:00", places: 6, price: 25, date: "2026-10-17" });
    const m = comprendre("Maréchal jeudi, 90 €", { today: TODAY, horses: [], prestations });
    expect(draftFromCompris(m, h, TODAY)).toMatchObject({ type: "soin", care: "ferrure", price: 90, start: "09:30", provider: "M. Roche" });
  });
  it("calcule la fin", () => {
    expect(endOf("17:30", 90)).toBe("19:00");
  });
});

describe("habitues", () => {
  it("ceux du même créneau d’abord, sans les déjà inscrits", () => {
    const next = se("n1", "2026-10-20", "17:30", "18:30", { status: "planned", participants: [{ personId: "nina" }] }); // mardi
    expect(habitues(seances, next)).toEqual(["lou", "emma"]);
  });
});
