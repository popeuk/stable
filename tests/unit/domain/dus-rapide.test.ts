import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/data/demo-data";
import { clientDues } from "@/lib/domain/clients";
import type { Person, Revenue } from "@/lib/domain/types";

/**
 * Banc d'essai : « Ils te doivent » pour une école de deux ans (15 séances
 * payées par jour, 120 cavaliers, environ 11 000 recettes). Le calcul se
 * fait en une passe : moins de 20 ms visés sur un Mac récent (155 ms avant).
 * Mesuré : 4 ms.
 */
describe("Ils te doivent, sur une grosse écurie", () => {
  it("se calcule en une passe, sans relire 25 mois par client", () => {
    const d = buildDemoData(new Date("2026-10-19"));
    const people: Person[] = Array.from({ length: 120 }, (_, i) => ({ id: `p${i}`, name: `Cavalier ${i}`, role: "cavalier", active: true }) as Person);
    d.people = [...(d.people ?? []), ...people];
    const revs: Revenue[] = [];
    for (let day = 0; day < 730; day++) {
      const dt = new Date(Date.UTC(2024, 9, 20) + day * 86400000).toISOString().slice(0, 10);
      for (let k = 0; k < 15; k++) revs.push({ id: `r${day}-${k}`, stableId: "demo-stable", horseId: d.horses[k % d.horses.length].id, amount: 25, date: dt, source: "manual", payer: `Cavalier ${(day * 15 + k) % 120}` } as Revenue);
    }
    d.revenues = [...d.revenues, ...revs];
    const period = { year: 2026, month: 10 };
    const premier = clientDues(d, period);
    expect(premier.filter((c) => c.due > 0).length).toBeGreaterThan(100);
    const t = performance.now();
    for (let i = 0; i < 5; i++) clientDues(d, period);
    const ms = (performance.now() - t) / 5;
    console.log(`clientDues : ${ms.toFixed(1)} ms par appel (${d.revenues.length} recettes)`);
    // 20 ms sur un Mac ; le serveur de construction de GitHub est 2 à 3 fois plus lent. Avant la correction : 155 ms sur le Mac.
    expect(ms).toBeLessThan(process.env.CI ? 80 : 20);
  });
});
