import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Period } from "@/lib/domain/types";

export function formatLongDate(d: Date): string {
  return format(d, "EEEE d MMMM", { locale: fr });
}

export function formatShortMonth(p: Period): string {
  return format(new Date(p.year, p.month - 1, 1), "MMM", { locale: fr });
}

export function formatMonthYear(p: Period): string {
  return format(new Date(p.year, p.month - 1, 1), "MMMM yyyy", { locale: fr });
}

/** Capitalised greeting-friendly month, e.g. "Novembre". */
export function formatMonthName(p: Period): string {
  const m = format(new Date(p.year, p.month - 1, 1), "MMMM", { locale: fr });
  return m.charAt(0).toUpperCase() + m.slice(1);
}
