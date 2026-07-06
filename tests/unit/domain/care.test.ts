import { describe, it, expect } from "vitest";
import {
  addDays,
  diffDays,
  upcomingDeadlines,
  horseCareLog,
  plannedEvents,
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

describe("plannedEvents (l'agenda : cours, concours, rendez-vous)", () => {
  it("returns strictly future events, nearest first (today = fait)", () => {
    const agenda = plannedEvents(
      {
        horses: HORSES,
        careEvents: [
          ev({ id: "past", date: "2026-07-01" }),
          ev({ id: "concours", kind: "concours", date: "2026-07-15" }),
          ev({ id: "cours", kind: "cours_collectif", date: "2026-07-06" }),
          ev({ id: "today", kind: "veto", date: "2026-07-05" }),
          ev({ id: "ghost", horseId: "arch", kind: "concours", date: "2026-07-20" }),
        ],
      },
      "2026-07-05",
    );
    // Ni l'acte du jour (fait), ni le cheval archivé.
    expect(agenda.map((a) => a.event.id)).toEqual(["cours", "concours"]);
    expect(agenda[0].daysUntil).toBe(1);
    expect(agenda[1].daysUntil).toBe(10);
  });
});

describe("un rendez-vous pris ne solde pas l'échéance", () => {
  it("keeps the overdue deadline and flags the planned date", () => {
    const dl = upcomingDeadlines(
      {
        horses: HORSES,
        careEvents: [
          // Vaccin fait il y a 13 mois : en retard.
          ev({ id: "done", kind: "vaccin", date: "2025-06-01" }),
          // RDV véto pris pour dans 15 jours : ne doit PAS replanifier.
          ev({ id: "rdv", kind: "vaccin", date: "2026-07-20" }),
        ],
      },
      "2026-07-05",
    );
    const vaccin = dl.find((d) => d.kind === "vaccin")!;
    expect(vaccin.status).toBe("overdue");
    expect(vaccin.lastDate).toBe("2025-06-01");
    expect(vaccin.plannedFor).toBe("2026-07-20");
  });

  it("history views cut the future off", () => {
    const log = horseCareLog(
      { careEvents: [ev({ id: "past", date: "2026-07-01" }), ev({ id: "future", date: "2026-08-01" })] },
      "h1",
      "2026-07-05",
    );
    expect(log.map((e) => e.id)).toEqual(["past"]);
  });
});
