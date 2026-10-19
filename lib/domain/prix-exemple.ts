import type { Prestation, Seance } from "@/lib/domain/types";

/**
 * Les cours d'une écurie partie de zéro venaient avec les prix de l'écurie
 * d'exemple (35 € le cours particulier…), que le gérant n'avait jamais
 * saisis. Une prestation encore à son prix d'exemple et jamais employée dans
 * une séance perd ce prix : « Pas de prix pour l'instant ». Les tarifs saisis
 * prennent alors le relais (prixDe).
 */
export function sansPrixDExemple(prestations: Prestation[], exemple: Prestation[], seances: Pick<Seance, "prestationId">[]): Prestation[] {
  const used = new Set(seances.map((s) => s.prestationId));
  return prestations.map((p) => {
    const ex = exemple.find((e) => e.id === p.id);
    return ex && ex.price === p.price && p.price > 0 && !used.has(p.id) ? { ...p, price: 0 } : p;
  });
}
