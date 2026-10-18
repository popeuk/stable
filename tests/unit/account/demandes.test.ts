import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { nonVues, quandDemande } = await import("@/lib/account/demandes");

describe("les demandes des cavaliers", () => {
  it("la pastille compte les demandes pas encore vues", () => {
    const d = [
      { id: 1, vue: false },
      { id: 2, vue: true },
      { id: 3, vue: false },
    ];
    expect(nonVues(d)).toBe(2);
  });
  it("une demande vue sur cet appareil (site injoignable à ce moment) ne fait plus la pastille", () => {
    expect(nonVues([{ id: 1, vue: false }, { id: 3, vue: false }], [3])).toBe(1);
    expect(nonVues([])).toBe(0);
  });
  it("la date se dit comme à l'oral", () => {
    const now = new Date(2026, 9, 19, 10, 0);
    expect(quandDemande(new Date(2026, 9, 19, 8, 0).toISOString(), now)).toBe("aujourd’hui");
    expect(quandDemande(new Date(2026, 9, 18, 23, 0).toISOString(), now)).toBe("hier");
    expect(quandDemande(new Date(2026, 9, 12, 9, 0).toISOString(), now)).toBe("le 12 octobre");
    expect(quandDemande(new Date(2025, 11, 2, 9, 0).toISOString(), now)).toBe("le 2 décembre 2025");
    expect(quandDemande("pas une date", now)).toBe("");
  });
});
