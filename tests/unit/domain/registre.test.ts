import { describe, it, expect } from "vitest";
import type { Horse } from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";
import {
  buildRegister,
  careInPeriod,
  currentQuarter,
  holdingGaps,
  horseGaps,
  horsesPresent,
  movementsIn,
  ownerLine,
  registerPeriod,
  temporaryInPeriod,
} from "@/lib/domain/registre";

const horse = (p: Partial<Horse>): Horse => ({ id: "h", stableId: "s", name: "Cheval", entryDate: "2025-01-01", isArchived: false, ...p });
const ev = (p: Partial<CareEvent>): CareEvent => ({ id: "c", stableId: "s", horseId: "a", kind: "vaccin", date: "2026-08-01", ...p });

describe("registerPeriod", () => {
  it("gives the quarter bounds", () => {
    expect(registerPeriod("trimestre", 2026, 1)).toMatchObject({ start: "2026-01-01", end: "2026-03-31", label: "1er trimestre 2026" });
    expect(registerPeriod("trimestre", 2024, 1).end).toBe("2024-03-31");
    expect(registerPeriod("trimestre", 2026, 4)).toMatchObject({ start: "2026-10-01", end: "2026-12-31" });
    expect(registerPeriod("annee", 2026)).toMatchObject({ start: "2026-01-01", end: "2026-12-31", label: "Année 2026" });
  });
  it("defaults to the current quarter", () => {
    expect(currentQuarter("2026-10-17")).toMatchObject({ quarter: 4, start: "2026-10-01", end: "2026-12-31" });
    expect(currentQuarter("2026-06-30").quarter).toBe(2);
  });
});

describe("horsesPresent", () => {
  const horses = [
    horse({ id: "ici", name: "Ici", entryDate: "2024-05-01" }),
    horse({ id: "arrive", name: "Arrive", entryDate: "2026-08-15" }),
    horse({ id: "apres", name: "Après", entryDate: "2026-10-01" }),
    horse({ id: "parti", name: "Parti", entryDate: "2023-01-01", exitDate: "2026-07-10", isArchived: true }),
    horse({ id: "avant", name: "Avant", entryDate: "2023-01-01", exitDate: "2026-06-30", isArchived: true }),
    horse({ id: "flou", name: "Flou", entryDate: "2023-01-01", isArchived: true, exitDate: null }),
  ];
  it("keeps every horse present at some point of the period, archived ones included", () => {
    const ids = horsesPresent(horses, "2026-07-01", "2026-09-30").map((h) => h.id);
    expect(ids).toEqual(["flou", "parti", "ici", "arrive"]);
  });
  it("counts the exit day and the entry day as present", () => {
    expect(horsesPresent(horses, "2026-06-30", "2026-06-30").map((h) => h.id)).toContain("avant");
    expect(horsesPresent(horses, "2026-10-01", "2026-10-01").map((h) => h.id)).toContain("apres");
  });
});

describe("movementsIn", () => {
  it("lists dated entries and exits of the period with origin and destination", () => {
    const horses = [
      horse({ id: "a", name: "Arrive", entryDate: "2026-08-15", origin: "Haras du Pin", entryReason: "pension" }),
      horse({ id: "p", name: "Parti", entryDate: "2020-01-01", exitDate: "2026-07-10", destination: "Écurie du Lac", exitReason: "vente" }),
      horse({ id: "x", name: "Vieux", entryDate: "2020-01-01" }),
    ];
    expect(movementsIn(horses, "2026-07-01", "2026-09-30")).toEqual([
      { date: "2026-07-10", horseId: "p", horseName: "Parti", kind: "sortie", reason: "vente", place: "Écurie du Lac" },
      { date: "2026-08-15", horseId: "a", horseName: "Arrive", kind: "entree", reason: "pension", place: "Haras du Pin" },
    ]);
  });
});

describe("care of the period", () => {
  const events = [
    ev({ id: "1", kind: "vermifuge", date: "2026-09-02", label: "Equest" }),
    ev({ id: "2", kind: "vaccin", date: "2026-07-05" }),
    ev({ id: "3", kind: "cours_collectif", date: "2026-08-01" }),
    ev({ id: "4", kind: "veto", date: "2026-09-20", pending: true }),
    ev({ id: "5", kind: "soin", date: "2026-06-30" }),
    ev({ id: "6", kind: "concours", date: "2026-08-10", label: "CSO Club" }),
    ev({ id: "7", kind: "soin", date: "2026-09-25" }),
  ];
  it("keeps done care and treatments, in chronological order", () => {
    expect(careInPeriod(events, "2026-07-01", "2026-09-30", "2026-09-22").map((e) => e.id)).toEqual(["2", "1"]);
  });
  it("leaves out what is still to come", () => {
    expect(careInPeriod(events, "2026-07-01", "2026-09-30", "2026-09-30").map((e) => e.id)).toEqual(["2", "1", "7"]);
  });
  it("takes shows as temporary movements", () => {
    expect(temporaryInPeriod(events, "2026-07-01", "2026-09-30", "2026-09-30").map((e) => e.id)).toEqual(["6"]);
  });
  it("buildRegister keeps only care of horses present", () => {
    const reg = buildRegister(
      { horses: [horse({ id: "a", entryDate: "2026-01-01" }), horse({ id: "b", entryDate: "2026-12-01" })], careEvents: [...events, ev({ id: "b1", horseId: "b", date: "2026-08-01" })] },
      registerPeriod("trimestre", 2026, 3),
      "2026-10-17",
    );
    expect(reg.horses.map((h) => h.id)).toEqual(["a"]);
    expect(reg.care.map((e) => e.id)).toEqual(["2", "1", "7"]);
  });
});

describe("gaps", () => {
  it("names what the horse sheet misses, destination only after a departure", () => {
    expect(horseGaps(horse({}))).toEqual(["sire", "puce", "proprietaire", "provenance"]);
    expect(horseGaps(horse({ sireNumber: "25012345X", chipNumber: "250", ownerName: "Léa", origin: "Paris", exitDate: "2026-01-01" }))).toEqual(["destination"]);
  });
  it("asks for the sanitary vet only from 3 horses", () => {
    const h = { placeAddress: "1 rue", holderName: "Claire", holderNumber: "123" };
    expect(holdingGaps(h, 2)).toEqual([]);
    expect(holdingGaps(h, 3)).toEqual(["veto_sanitaire"]);
    expect(holdingGaps(undefined, 0)).toEqual(["lieu", "detenteur", "numero"]);
  });
  it("adds the owner's contact details when known", () => {
    expect(ownerLine(horse({ ownerName: "Léa Martin" }), [{ id: "p", name: "léa martin", role: "proprietaire", phone: "0600", active: true }])).toBe("Léa Martin, 0600");
    expect(ownerLine(horse({}), [])).toBe("");
  });
});
