import type { Period, StableData } from "@/lib/domain/types";
import { horsePnl, horseTrend } from "@/lib/domain/calculations";

/**
 * Pick the most relevant concept to surface right now, from the user's data.
 * This is how learning stays contextual instead of living in a "lessons" tab.
 */
export function pickNotion(data: StableData, period: Period): string {
  const horses = data.horses.filter((h) => !h.isArchived);

  // A horse below its break-even → teach the threshold.
  const underThreshold = horses.some((h) => horsePnl(data, h.id, period).netResult < 0);
  if (underThreshold) return "seuil_rentabilite";

  // A declining horse → teach trend.
  const declining = horses.some((h) => horseTrend(data, h.id, period) === "baisse");
  if (declining) return "tendance";

  // Mutualised costs present → teach how they are shared.
  const hasShared = data.sharedExpenses.some(
    (s) => s.periodYear === period.year && s.periodMonth === period.month,
  );
  if (hasShared) return "charges_mutualisees";

  return "marge_nette";
}
