import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { suggestions } from "@/lib/domain/leviers";
import { horseTicket, monthBreakdown, reconciledNets } from "@/lib/domain/ticket";
import { stablePnl } from "@/lib/domain/calculations";
import { dayItems, resumeJournee } from "@/lib/domain/seances";
import type { StableData } from "@/lib/domain/types";

const NOW = new Date("2026-10-16T12:00:00");
const oct = { year: 2026, month: 10 };

describe("les pistes ne contredisent pas le ticket (P2-5)", () => {
  it("aucune piste « pension » pour un cheval dont le ticket est positif", () => {
    const d = buildDemoData(NOW);
    for (const s of suggestions(d, oct, 12)) {
      if (s.apply.type !== "pension") continue;
      const id = s.apply.horseId;
      expect(horseTicket(d, id, oct).net).toBeLessThan(0);
      expect(s.sub).not.toMatch(/perds/);
    }
    const belle = d.horses.find((h) => h.name === "Belle")!;
    if (horseTicket(d, belle.id, oct).net >= 0) expect(suggestions(d, oct, 12).some((s) => s.id === `pension-${belle.id}`)).toBe(false);
  });
  it("la pension proposée remet le ticket à zéro, pas plus", () => {
    const d = buildDemoData(NOW);
    const h = d.horses[0];
    // Un gros soin ce mois : le cheval coûte.
    d.directExpenses.push({ id: "gros", stableId: "s", horseId: h.id, label: "Colique", amount: 900, date: "2026-10-10", source: "manual" });
    const net = horseTicket(d, h.id, oct).net;
    const s = suggestions(d, oct, 12).find((x) => x.id === `pension-${h.id}`)!;
    expect(net).toBeLessThan(0);
    expect(s.apply).toMatchObject({ type: "pension", amount: Math.ceil((h.pension! - net) / 10) * 10 });
  });
});

describe("boxes vides : pas d'estimation sans nombre de boxes (P2-10)", () => {
  it("capacité inconnue (0) : aucune piste « remplir »", () => {
    const d = buildDemoData(NOW);
    expect(suggestions(d, oct, 0).some((s) => s.lever === "remplir")).toBe(false);
    expect(suggestions(d, oct, 12).some((s) => s.lever === "remplir")).toBe(true);
  });
});

describe("« Tes chevaux te laissent » ne compte que les chevaux (P2-3)", () => {
  it("la somme des tickets laisse de côté l'argent hors chevaux", () => {
    const h = (id: string) => ({ id, stableId: "s", name: id, entryDate: "2024-01-01", exitDate: null, isArchived: false });
    const d: StableData = {
      horses: [h("a"), h("b"), h("c")],
      revenues: ["a", "b", "c"].map((id) => ({ id: `p${id}`, stableId: "s", horseId: id, amount: 450, date: "2026-10-01", source: "recurring" as const })),
      directExpenses: [{ id: "trac", stableId: "s", horseId: "", label: "Tracteur", amount: 50, date: "2026-10-05", source: "manual" }],
      sharedExpenses: [{ id: "f", stableId: "s", label: "Foin", totalAmount: 900, periodMonth: 10, periodYear: 2026, distributionMode: "equal", source: "manual", allocations: [] }],
      revenueCategories: [],
      expenseCategories: [],
    };
    const nets = reconciledNets(d, oct);
    const horses = Object.values(nets).reduce((t, n) => t + n, 0);
    expect(horses).toBe(450);
    expect(stablePnl(d, oct).horsesNet).toBe(450);
    expect(monthBreakdown(d, oct).net).toBe(400);
  });
});

describe("la journée compte tout, partout (P1-1 design)", () => {
  it("séances, soins, tâches et rendez-vous sont des choses du jour", () => {
    const d = buildDemoData(NOW);
    const today = "2026-10-16";
    const items = dayItems(d, today, today, "12:00");
    const r = resumeJournee(items);
    expect(r.n).toBe(items.length);
    expect(r.titre).toBe(items.length ? `Ta journée : ${items.length} chose${items.length > 1 ? "s" : ""}` : "Ta journée : rien de prévu");
    const types = new Set(items.map((i) => i.type));
    expect(types.size).toBeGreaterThan(0);
  });
  it("la ligne de la tournée dit aussi ce qui est déjà fait", () => {
    const mk = (done: boolean, type: "seance" | "soin" | "task") => ({ key: `${type}${done}`, type, title: type, sub: "", tone: "n" as const, done, late: false });
    const r = resumeJournee([mk(true, "seance"), mk(true, "soin"), mk(false, "task")]);
    expect(r.ligne).toBe("3 choses au planning aujourd’hui, dont 2 choses déjà faites.");
    expect(resumeJournee([]).ligne).toBeNull();
    expect(resumeJournee([mk(false, "task")]).titre).toBe("Ta journée : 1 chose");
  });
});
