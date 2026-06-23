"use client";

import { useMemo } from "react";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import {
  horseMarginSeries,
  horsePnl,
  horseTrend,
  horseVolatility,
} from "@/lib/domain/calculations";
import type { Horse, HorsePnl, Trend } from "@/lib/domain/types";

export interface HorseWithPnl {
  horse: Horse;
  pnl: HorsePnl;
  trend: Trend;
  volatility: number;
  series: number[];
}

/** Active horses with their P&L for the active period, sorted by net result. */
export function useHorses(includeArchived = false): HorseWithPnl[] {
  const data = useDataStore();
  const period = usePeriodStore((s) => s.active);

  return useMemo(() => {
    const horses = data.horses.filter(
      (h) => includeArchived || !h.isArchived,
    );
    return horses
      .map((horse) => ({
        horse,
        pnl: horsePnl(data, horse.id, period),
        trend: horseTrend(data, horse.id, period),
        volatility: horseVolatility(data, horse.id, period),
        series: horseMarginSeries(data, horse.id, period, 12),
      }))
      .sort((a, b) => b.pnl.netResult - a.pnl.netResult);
  }, [data, period, includeArchived]);
}

export function useHorse(id: string): HorseWithPnl | undefined {
  return useHorses(true).find((h) => h.horse.id === id);
}
