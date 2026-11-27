import { describe, it, expect } from "vitest";
import { enLigneDuTemps, duree } from "@/lib/domain/journee-temps";
import type { DayItem } from "@/lib/domain/seances";

const it_ = (key: string, start: string, end: string): DayItem => ({ key, type: "seance", start, end, title: key, sub: "", tone: "in" as DayItem["tone"], done: false, late: false });
const jour = [it_("a", "08:30", "09:30"), it_("b", "10:00", "11:00"), it_("c", "14:00", "15:00")];
const forme = (l: ReturnType<typeof enLigneDuTemps>) => l.map((p) => (p.kind === "item" ? p.it.key : p.kind === "libre" ? `libre ${p.minutes}` : "maintenant"));

describe("la journée en ligne du temps", () => {
  it("dit le temps libre d'une heure ou plus entre deux moments", () => {
    expect(forme(enLigneDuTemps(jour, null))).toEqual(["a", "b", "libre 180", "c"]);
  });
  it("pose « Maintenant » avant le prochain moment", () => {
    expect(forme(enLigneDuTemps(jour, "12:30"))).toEqual(["a", "b", "libre 180", "maintenant", "c"]);
  });
  it("pendant une séance, pas de repère à part", () => {
    expect(forme(enLigneDuTemps(jour, "10:20"))).not.toContain("maintenant");
  });
  it("après la dernière, le repère va à la fin", () => {
    expect(forme(enLigneDuTemps(jour, "18:00")).at(-1)).toBe("maintenant");
  });
  it("écrit les durées comme on les dit", () => {
    expect([duree(45), duree(60), duree(90), duree(180)]).toEqual(["45 min", "1 h", "1 h 30", "3 h"]);
  });
});
