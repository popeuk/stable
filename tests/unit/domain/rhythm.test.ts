import { describe, it, expect } from "vitest";
import { materializeRhythms, weekdayOf, type Rhythm } from "@/lib/domain/rhythm";

const HORSES = [
  { id: "h1", isArchived: false },
  { id: "h2", isArchived: false },
  { id: "arch", isArchived: true },
];

function rhythm(partial: Partial<Rhythm>): Rhythm {
  return {
    id: "rh1",
    stableId: "s",
    kind: "cours_collectif",
    weekday: 1, // mardi
    label: "Cours du soir, 18 h",
    horseIds: ["h1", "h2"],
    revenue: 25,
    active: true,
    materializedUntil: "2026-07-12",
    ...partial,
  };
}

describe("weekdayOf", () => {
  it("0 = lundi … 6 = dimanche", () => {
    expect(weekdayOf("2026-07-13")).toBe(0); // lundi
    expect(weekdayOf("2026-07-14")).toBe(1); // mardi
    expect(weekdayOf("2026-07-12")).toBe(6); // dimanche
  });
});

describe("materializeRhythms", () => {
  // Aujourd'hui : dimanche 12/07/2026. Le mardi suivant : 14/07.
  const today = "2026-07-12";

  it("génère la séance du prochain mardi, en attente, groupée", () => {
    const { events, advanced } = materializeRhythms([rhythm({})], HORSES, today);
    expect(events).toHaveLength(2); // h1 + h2
    expect(events[0]).toMatchObject({
      date: "2026-07-14",
      kind: "cours_collectif",
      pending: true,
      revenue: 25,
      groupId: "rh-rh1-2026-07-14",
    });
    expect(new Set(events.map((e) => e.horseId))).toEqual(new Set(["h1", "h2"]));
    expect(advanced).toEqual([{ id: "rh1", materializedUntil: "2026-07-19" }]);
  });

  it("est idempotent : la borne avancée, un second passage ne génère rien", () => {
    const first = materializeRhythms([rhythm({})], HORSES, today);
    const again = materializeRhythms(
      [rhythm({ materializedUntil: first.advanced[0].materializedUntil })],
      HORSES,
      today,
    );
    expect(again.events).toHaveLength(0);
    expect(again.advanced).toHaveLength(0);
  });

  it("identifiants déterministes : une séance supprimée ne réapparaît pas", () => {
    const a = materializeRhythms([rhythm({})], HORSES, today);
    const b = materializeRhythms([rhythm({})], HORSES, today);
    expect(a.events.map((e) => e.id)).toEqual(b.events.map((e) => e.id));
  });

  it("ignore les rythmes inactifs et les chevaux archivés", () => {
    const off = materializeRhythms([rhythm({ active: false })], HORSES, today);
    expect(off.events).toHaveLength(0);
    const arch = materializeRhythms(
      [rhythm({ horseIds: ["h1", "arch"] })],
      HORSES,
      today,
    );
    expect(arch.events.map((e) => e.horseId)).toEqual(["h1"]);
  });

  it("ne rattrape jamais le passé : une borne ancienne ne crée pas de séances passées", () => {
    const { events, advanced } = materializeRhythms(
      [rhythm({ materializedUntil: "2026-06-01" })],
      HORSES,
      today,
    );
    // Mardis entre le 02/06 et le 19/07 : seuls ceux >= aujourd'hui sortent.
    expect(events.every((e) => e.date >= today)).toBe(true);
    expect(events.map((e) => e.date)).toEqual(["2026-07-14", "2026-07-14"]);
    expect(advanced[0].materializedUntil).toBe("2026-07-19");
  });

  it("une séance le jour même de la génération est incluse", () => {
    // Aujourd'hui dimanche (6), rythme du dimanche, borne à hier.
    const { events } = materializeRhythms(
      [rhythm({ weekday: 6, materializedUntil: "2026-07-11" })],
      HORSES,
      today,
    );
    expect(events.map((e) => e.date)).toContain("2026-07-12");
  });
});
