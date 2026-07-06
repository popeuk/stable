import { describe, it, expect } from "vitest";
import {
  addDays,
  diffDays,
  upcomingDeadlines,
  horseCareLog,
  type CareEvent,
} from "@/lib/domain/care";

function ev(partial: Partial<CareEvent>): CareEvent {
  return {
    id: "c1",
    stableId: "s",
    horseId: "h1",
    kind: "ferrure",
    date: "2026-06-01",
    ...partial,
  };
}

const HORSES = [
  { id: "h1", isArchived: false },
  { id: "h2", isArchived: false },
  { id: "arch", isArchived: true },
];

describe("date helpers", () => {
  it("adds days across month ends", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });
  it("diffs days signed", () => {
    expect(diffDays("2026-07-01", "2026-07-11")).toBe(10);
    expect(diffDays("2026-07-11", "2026-07-01")).toBe(-10);
  });
});

describe("upcomingDeadlines", () => {
  it("projects the next ferrure 49 days after the last one", () => {
    const dl = upcomingDeadlines(
      { horses: HORSES, careEvents: [ev({ date: "2026-06-01" })] },
      "2026-07-05",
    );
    expect(dl).toHaveLength(1);
    expect(dl[0].dueDate).toBe("2026-07-20");
    expect(dl[0].daysLeft).toBe(15);
    expect(dl[0].status).toBe("ok");
  });

  it("flags soon (≤14 j) and overdue", () => {
    const dl = upcomingDeadlines(
      {
        horses: HORSES,
        careEvents: [
          ev({ id: "a", date: "2026-06-01" }), // due 20/07 → soon at 10/07
          ev({ id: "b", horseId: "h2", kind: "vaccin", date: "2025-06-01" }), // due 01/06/26 → overdue
        ],
      },
      "2026-07-10",
    );
    const ferrure = dl.find((d) => d.kind === "ferrure")!;
    const vaccin = dl.find((d) => d.kind === "vaccin")!;
    expect(ferrure.status).toBe("soon");
    expect(vaccin.status).toBe("overdue");
    expect(vaccin.daysLeft).toBeLessThan(0);
    // Sorted by urgency: overdue first.
    expect(dl[0].kind).toBe("vaccin");
  });

  it("uses the LATEST act of each kind (done ✓ reschedules)", () => {
    const dl = upcomingDeadlines(
      {
        horses: HORSES,
        careEvents: [ev({ id: "old", date: "2026-05-01" }), ev({ id: "new", date: "2026-07-01" })],
      },
      "2026-07-05",
    );
    expect(dl[0].lastDate).toBe("2026-07-01");
    expect(dl[0].dueDate).toBe("2026-08-19");
  });

  it("no history means no deadline, and archived horses are ignored", () => {
    const dl = upcomingDeadlines(
      { horses: HORSES, careEvents: [ev({ horseId: "arch" })] },
      "2026-07-05",
    );
    expect(dl).toHaveLength(0);
  });

  it("non-cadenced kinds (véto, concours…) never create deadlines", () => {
    const dl = upcomingDeadlines(
      { horses: HORSES, careEvents: [ev({ kind: "veto" }), ev({ id: "c2", kind: "concours" })] },
      "2026-07-05",
    );
    expect(dl).toHaveLength(0);
  });
});

describe("horseCareLog", () => {
  it("returns one horse's events, newest first", () => {
    const log = horseCareLog(
      {
        careEvents: [
          ev({ id: "a", date: "2026-05-01" }),
          ev({ id: "b", date: "2026-07-01" }),
          ev({ id: "other", horseId: "h2" }),
        ],
      },
      "h1",
    );
    expect(log.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("explicit nextDue (documents, rendez-vous fixés)", () => {
  it("a document renewal creates a deadline from its explicit date", () => {
    const dl = upcomingDeadlines(
      {
        horses: HORSES,
        careEvents: [
          ev({ kind: "document", label: "Assurance", date: "2026-01-10", nextDue: "2026-07-10" }),
        ],
      },
      "2026-07-05",
    );
    expect(dl).toHaveLength(1);
    expect(dl[0].dueDate).toBe("2026-07-10");
    expect(dl[0].status).toBe("soon");
  });

  it("an explicit date on the latest act overrides the cadence", () => {
    const dl = upcomingDeadlines(
      {
        horses: HORSES,
        careEvents: [ev({ date: "2026-06-01", nextDue: "2026-09-01" })],
      },
      "2026-07-05",
    );
    // Ferrure cadence would say 20/07; the farrier said September.
    expect(dl[0].dueDate).toBe("2026-09-01");
  });
});
