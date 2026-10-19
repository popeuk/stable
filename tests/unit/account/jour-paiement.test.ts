import { describe, expect, it } from "vitest";

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: object }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};

const { useDataStore } = await import("@/stores/data-store");
const { noterPaiement } = await import("@/components/bs/noter-paiement");
const { horodatage, jourDit, jourPossible, joursProposes } = await import("@/lib/domain/jour-paiement");
const { regleeDe } = await import("@/lib/domain/facture");
const { lignesComptables } = await import("@/lib/domain/comptable");

const st = () => useDataStore.getState();
const auJour = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("le jour d'un paiement", () => {
  const today = "2026-10-19";

  it("Aujourd'hui, Hier, Avant-hier, ou un autre jour passé", () => {
    expect(joursProposes(today).map((j) => [j.label, j.date])).toEqual([
      ["Aujourd’hui", "2026-10-19"],
      ["Hier", "2026-10-18"],
      ["Avant-hier", "2026-10-17"],
    ]);
    expect(joursProposes("2026-03-01")[1].date).toBe("2026-02-28");
    expect(jourPossible("2026-09-30", today)).toBe(true);
    expect(jourPossible("2026-10-20", today)).toBe(false);
    expect(jourPossible("", today)).toBe(false);
    expect([jourDit(today, today), jourDit("2026-10-18", today), jourDit("2026-10-17", today), jourDit("2026-10-01", today), jourDit("2026-09-12", today)]).toEqual(["aujourd’hui", "hier", "avant-hier", "le 1er octobre", "le 12 septembre"]);
  });

  it("aujourd'hui garde l'heure ; un autre jour tombe à midi ce jour-là ; jamais dans le futur", () => {
    const now = new Date("2026-10-19T08:30:00Z");
    expect(horodatage(today, today, now)).toBe(now.toISOString());
    expect(auJour(horodatage("2026-10-17", today, now))).toBe("2026-10-17");
    expect(horodatage("2026-11-02", today, now)).toBe(now.toISOString());
  });

  it("la date choisie sert à l'historique, au comptable et à « Payée le » de la facture", () => {
    st().startEmpty();
    const hier = joursProposes(today)[1].date;
    const ids = noterPaiement({ name: "Léa B.", anciens: [], dueMois: 450, due: 450 }, 450, "2026-10", { method: "cheque", at: horodatage(hier, today) });
    const p = st().payments!.find((x) => x.id === ids[0])!;
    expect(auJour(p.at!)).toBe("2026-10-18");
    expect(regleeDe(st().payments, "Léa B.", "2026-10")).toEqual({ date: "2026-10-18", moyen: "par chèque" });
    const ligne = lignesComptables(st(), 2026, today).find((l) => l.type === "Encaissement" && l.client === "Léa B.");
    expect(ligne?.date).toBe("2026-10-18");
  });

  it("sans jour choisi, le paiement est d'aujourd'hui (comme avant)", () => {
    st().startEmpty();
    const avant = Date.now();
    const [id] = noterPaiement({ name: "Hugo L.", anciens: [], dueMois: 100, due: 100 }, 100, "2026-10", { method: "especes" });
    const at = Date.parse(st().payments!.find((x) => x.id === id)!.at!);
    expect(at).toBeGreaterThanOrEqual(avant - 5);
    expect(at).toBeLessThanOrEqual(Date.now() + 5);
  });
});
