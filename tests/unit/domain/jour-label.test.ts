import { describe, expect, it } from "vitest";
import { jourLabel } from "@/components/bs/seance-form";

/** « Quel jour » d'une dépense : hier et avant-hier se disent comme on les dit. */
describe("le jour dit", () => {
  it("aujourd'hui, demain, hier, avant-hier, puis le jour et sa date", () => {
    const t = "2026-10-19";
    expect(jourLabel(t, t)).toBe("aujourd’hui");
    expect(jourLabel("2026-10-20", t)).toBe("demain");
    expect(jourLabel("2026-10-18", t)).toBe("hier");
    expect(jourLabel("2026-10-17", t)).toBe("avant-hier");
    expect(jourLabel("2026-10-16", t)).toBe("vendredi 16");
  });
});
