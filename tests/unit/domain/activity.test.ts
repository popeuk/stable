import { describe, it, expect } from "vitest";
import { horseActivity } from "@/lib/domain/activity";
import type { CareEvent } from "@/lib/domain/care";

const HORSES = [
  { id: "h1", isArchived: false },
  { id: "h2", isArchived: false },
  { id: "arch", isArchived: true },
];

function ev(partial: Partial<CareEvent>): CareEvent {
  return {
    id: Math.random().toString(36).slice(2),
    stableId: "s",
    horseId: "h1",
    kind: "cours_collectif",
    date: "2026-07-10",
    ...partial,
  };
}

describe("horseActivity", () => {
  const today = "2026-07-12";

  it("compte les séances confirmées et leurs recettes sur la fenêtre", () => {
    const out = horseActivity(
      {
        horses: HORSES,
        careEvents: [
          ev({ revenue: 25 }),
          ev({ kind: "cours_individuel", date: "2026-07-01", revenue: 35 }),
          ev({ kind: "entrainement", date: "2026-06-20" }),
        ],
      },
      today,
    );
    expect(out[0]).toMatchObject({
      horseId: "h1",
      sessions: 3,
      revenue: 60,
      lastDate: "2026-07-10",
    });
  });

  it("les chevaux sans séance restent listés à zéro — c'est le signal", () => {
    const out = horseActivity({ horses: HORSES, careEvents: [ev({})] }, today);
    expect(out).toHaveLength(2); // archivé exclu
    expect(out[1]).toMatchObject({ horseId: "h2", sessions: 0 });
  });

  it("ignore le pending, le futur, le hors-fenêtre et les soins", () => {
    const out = horseActivity(
      {
        horses: HORSES,
        careEvents: [
          ev({ pending: true }),
          ev({ date: "2026-07-20" }),
          ev({ date: "2026-05-01" }),
          ev({ kind: "ferrure" }),
        ],
      },
      today,
    );
    expect(out[0].sessions).toBe(0);
  });
});
