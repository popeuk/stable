import type { Period, PersonRole, StableData } from "@/lib/domain/types";
import { dateInPeriod } from "@/lib/utils/period";

/**
 * Ce que chaque client a rapporté sur un mois : ce qu'il paie, rangé en
 * pension, cours et séances, soins refacturés, le reste. Seulement ce qui
 * rentre : les frais d'un cheval ne sont pas déduits du client, puisqu'un
 * cavalier ne choisit pas ce que coûte le cheval qu'il monte. Le payeur
 * d'une recette est noté sur elle ; à défaut, c'est le propriétaire du
 * cheval (même règle que la facturation). Domaine pur.
 */
export type ClientBucket = "pension" | "seances" | "soins" | "autres";
export const BUCKET_LABEL: Record<ClientBucket, string> = {
  pension: "Pension",
  seances: "Cours et séances",
  soins: "Soins refacturés",
  autres: "Autres",
};

export interface ClientRevenue {
  name: string;
  role: PersonRole;
  /** Les chevaux qu'il a en pension (propriétaire). */
  horses: string[];
  buckets: Record<ClientBucket, number>;
  total: number;
}

export function clientRevenues(
  data: StableData,
  period: Period,
): ClientRevenue[] {
  const owners = new Set(
    data.horses.map((h) => h.ownerName).filter(Boolean) as string[],
  );
  const catName = (id?: string) =>
    data.revenueCategories.find((c) => c.id === id)?.name ?? "";
  const map = new Map<string, ClientRevenue>();
  for (const r of data.revenues) {
    if (!dateInPeriod(r.date, period)) continue;
    const horse = data.horses.find((h) => h.id === r.horseId);
    const name = r.payer ?? horse?.ownerName;
    if (!name) continue;
    const role =
      data.people?.find((p) => p.name === name)?.role ??
      (owners.has(name) ? "proprietaire" : "cavalier");
    const c =
      map.get(name) ??
      ({
        name,
        role,
        horses: data.horses
          .filter((h) => !h.isArchived && h.ownerName === name)
          .map((h) => h.name),
        buckets: { pension: 0, seances: 0, soins: 0, autres: 0 },
        total: 0,
      } satisfies ClientRevenue);
    const quoi = `${catName(r.categoryId)} ${r.note ?? ""}`;
    const bucket: ClientBucket = r.rebillOf
      ? "soins"
      : r.seanceId
        ? "seances"
        : /pension/i.test(quoi)
          ? "pension"
          : /cours|s[ée]ance|monte|travail|coaching|balade|stage|le[cç]on/i.test(
                quoi,
              )
            ? "seances"
            : /refactur|soin|v[ée]t|mar[ée]chal|ferr|ost[ée]o|vermif|dent/i.test(quoi)
              ? "soins"
              : "autres";
    c.buckets[bucket] += r.amount;
    c.total += r.amount;
    map.set(name, c);
  }
  return [...map.values()]
    .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "fr"));
}
