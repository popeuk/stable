/** Petites aides de dates locales (AAAA-MM-JJ), lundi en premier. */
export { addDays } from "@/lib/domain/care";
export function weekdayIndex(iso: string): number {
  return (new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7;
}
