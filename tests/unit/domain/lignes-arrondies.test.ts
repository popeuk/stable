import { describe, expect, it } from "vitest";
import { lignesArrondies, type TicketLine } from "@/lib/domain/ticket";

describe("les lignes du ticket tombent juste sur le total affiché", () => {
  const lignes: TicketLine[] = [
    { key: "p", label: "Pension", amount: 450, kind: "in" },
    { key: "share", label: "Sa part des frais", amount: -264.67, kind: "share" },
  ];

  it("la part des frais prend l'écart d'arrondi", () => {
    const r = lignesArrondies(lignes, 186);
    expect(r.map((l) => l.amount)).toEqual([450, -264]);
    expect(r.reduce((t, l) => t + l.amount, 0)).toBe(186);
  });

  it("sans écart, chaque ligne est seulement arrondie", () => {
    expect(lignesArrondies(lignes, 185).map((l) => l.amount)).toEqual([450, -265]);
  });

  it("sans part des frais, la plus grosse ligne prend l'écart", () => {
    const r = lignesArrondies([{ key: "a", label: "Pension", amount: 450.4, kind: "in" }, { key: "b", label: "Maréchal", amount: -80.4, kind: "out" }], 371);
    expect(r.map((l) => l.amount)).toEqual([451, -80]);
  });
});
