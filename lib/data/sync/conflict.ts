/**
 * Conflict resolution (spec section 13.4).
 *
 * General strategy: last-write-wins on `updated_at`. Exception: mutualised
 * charges are merged — the total is LWW, but the set of horses is the union
 * of both sides and the split is recomputed from scratch.
 */
import type { Horse, SharedExpense } from "@/lib/domain/types";
import { distribute } from "@/lib/domain/distribution";

export type Winner = "local" | "remote";

/** Newer timestamp wins; ties resolve to the server copy. */
export function resolveLWW(
  localUpdatedAt: number | string,
  remoteUpdatedAt: number | string,
): Winner {
  const l = toMillis(localUpdatedAt);
  const r = toMillis(remoteUpdatedAt);
  return l > r ? "local" : "remote";
}

export interface MergeContext {
  localUpdatedAt: number | string;
  remoteUpdatedAt: number | string;
  /** All known horses, used to recompute a presence-weighted split. */
  horses: Horse[];
}

/**
 * Merge two versions of the same mutualised charge. The total amount and the
 * distribution mode follow last-write-wins; the horse set is the union of
 * both allocations; the per-horse amounts are recomputed so they stay
 * consistent with the (possibly new) horse set.
 */
export function mergeSharedExpense(
  local: SharedExpense,
  remote: SharedExpense,
  ctx: MergeContext,
): SharedExpense {
  const winner = resolveLWW(ctx.localUpdatedAt, ctx.remoteUpdatedAt);
  const base = winner === "local" ? local : remote;

  const horseIds = new Set<string>([
    ...local.allocations.map((a) => a.horseId),
    ...remote.allocations.map((a) => a.horseId),
  ]);
  const horses = ctx.horses.filter((h) => horseIds.has(h.id));

  const period = { year: base.periodYear, month: base.periodMonth };
  const allocations = distribute(
    base.totalAmount,
    horses,
    base.distributionMode,
    period,
  );

  return { ...base, allocations };
}

function toMillis(v: number | string): number {
  if (typeof v === "number") return v;
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? 0 : parsed;
}
