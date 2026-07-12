import type {
  Category,
  DirectExpense,
  Horse,
  Revenue,
  SharedExpense,
  StableData,
} from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";
import { addDays } from "@/lib/domain/care";
import type { Rhythm } from "@/lib/domain/rhythm";
import { weekdayOf } from "@/lib/domain/rhythm";
import { distribute } from "@/lib/domain/distribution";
import { addMonths, currentPeriod, periodStart } from "@/lib/utils/period";

const STABLE_ID = "demo-stable";

/** Seed horses from section 20.2 of the spec. */
const DEMO_HORSES: {
  name: string;
  breed: string;
  birthYear: number;
  pension: number;
  variableCost: number;
}[] = [
  { name: "Sirius", breed: "SF", birthYear: 2015, pension: 600, variableCost: 240 },
  { name: "Diva", breed: "PSA", birthYear: 2017, pension: 500, variableCost: 195 },
  { name: "Belle", breed: "Connemara", birthYear: 2013, pension: 450, variableCost: 180 },
  { name: "Tonnerre", breed: "PRE", birthYear: 2014, pension: 380, variableCost: 165 },
  { name: "Princesse", breed: "TF", birthYear: 2008, pension: 420, variableCost: 230 },
  { name: "Vaillant", breed: "AA", birthYear: 2010, pension: 450, variableCost: 310 },
  { name: "Pacha", breed: "Welsh", birthYear: 2018, pension: 250, variableCost: 110 },
  { name: "Mistral", breed: "SF", birthYear: 2009, pension: 300, variableCost: 175 },
];

export const DEFAULT_REVENUE_CATEGORIES: Category[] = [
  "Pension",
  "Cours",
  "Sport",
  "Transport",
  "Débourrage",
  "Demi-pension",
  "Vente",
].map((name, i) => ({ id: `rev-${i}`, name }));

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  ...["Maréchal-ferrant", "Vétérinaire", "Médicaments", "Équipement", "Concours", "Transport", "Compléments"].map(
    (name, i) => ({ id: `exp-d-${i}`, name, isDirect: true }),
  ),
  ...["Foin", "Granulés", "Litière", "Personnel", "Loyer / foncier", "Eau", "Électricité", "Assurance", "Entretien", "Fournitures"].map(
    (name, i) => ({ id: `exp-s-${i}`, name, isDirect: false }),
  ),
];

/** A small deterministic pseudo-random generator so the demo is stable. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Build 12 months of realistic data for the demo stable, ending at the
 * current month. Each horse gets a monthly pension plus occasional extra
 * revenue, monthly direct costs, and a share of the mutualised charges.
 */
export function buildDemoData(now = new Date()): StableData {
  const end = currentPeriod(now);
  const periods = Array.from({ length: 12 }, (_, i) => addMonths(end, -(11 - i)));
  const rng = makeRng(42);

  const horses: Horse[] = DEMO_HORSES.map((h, idx) => ({
    id: `horse-${idx}`,
    stableId: STABLE_ID,
    name: h.name,
    breed: h.breed,
    birthYear: h.birthYear,
    // Entered between 8 and 36 months ago to vary "ancienneté".
    entryDate: periodStart(addMonths(end, -(8 + idx * 3))),
    exitDate: null,
    isArchived: false,
    pensionType: "Pension complète",
    // Le contrat : la pension se poste toute seule chaque mois.
    pension: h.pension,
  }));

  const revenues: Revenue[] = [];
  const directExpenses: DirectExpense[] = [];
  const sharedExpenses: SharedExpense[] = [];

  const pensionCat = DEFAULT_REVENUE_CATEGORIES[0].id;
  const coursCat = DEFAULT_REVENUE_CATEGORIES[1].id;

  for (const period of periods) {
    const monthDate = periodStart(period);

    horses.forEach((horse, idx) => {
      const base = DEMO_HORSES[idx];
      // Pension every month (slight drift to create trends/volatility).
      const drift = 1 + (rng() - 0.5) * 0.08;
      revenues.push({
        id: `rev-${horse.id}-${monthDate}`,
        stableId: STABLE_ID,
        horseId: horse.id,
        categoryId: pensionCat,
        amount: Math.round(base.pension * drift),
        date: monthDate,
        source: "recurring",
      });

      // ~40% of months: extra revenue (cours, transport).
      if (rng() > 0.6) {
        revenues.push({
          id: `rev2-${horse.id}-${monthDate}`,
          stableId: STABLE_ID,
          horseId: horse.id,
          categoryId: coursCat,
          amount: 40 + Math.round(rng() * 160),
          date: monthDate,
          source: "manual",
        });
      }

      // Direct variable costs (farrier / vet) most months.
      directExpenses.push({
        id: `dexp-${horse.id}-${monthDate}`,
        stableId: STABLE_ID,
        horseId: horse.id,
        categoryId: DEFAULT_EXPENSE_CATEGORIES[0].id,
        label: rng() > 0.5 ? "Maréchal-ferrant" : "Compléments",
        amount: Math.round(base.variableCost * (0.7 + rng() * 0.5)),
        date: monthDate,
        source: "manual",
      });

      // ~20% of months: a vet bill.
      if (rng() > 0.8) {
        directExpenses.push({
          id: `vet-${horse.id}-${monthDate}`,
          stableId: STABLE_ID,
          horseId: horse.id,
          categoryId: DEFAULT_EXPENSE_CATEGORIES[1].id,
          label: "Vétérinaire",
          amount: 60 + Math.round(rng() * 240),
          date: monthDate,
          source: "photo",
        });
      }
    });

    // Mutualised charges, split across all horses.
    const sharedDefs: { label: string; cat: number; total: number; mode: "equal" | "weighted_by_days" }[] = [
      { label: "Foin", cat: 7, total: 900 + Math.round(rng() * 200), mode: "weighted_by_days" },
      { label: "Granulés", cat: 8, total: 600 + Math.round(rng() * 150), mode: "weighted_by_days" },
      { label: "Litière", cat: 9, total: 400, mode: "equal" },
      { label: "Personnel", cat: 10, total: 2200, mode: "equal" },
      { label: "Loyer / foncier", cat: 11, total: 1500, mode: "equal" },
    ];

    for (const def of sharedDefs) {
      const cat = DEFAULT_EXPENSE_CATEGORIES[def.cat];
      const allocations = distribute(def.total, horses, def.mode, period);
      sharedExpenses.push({
        id: `shared-${def.label}-${monthDate}`,
        stableId: STABLE_ID,
        categoryId: cat?.id,
        label: def.label,
        totalAmount: def.total,
        periodMonth: period.month,
        periodYear: period.year,
        distributionMode: def.mode,
        source: "recurring",
        allocations,
      });
    }
  }

  // A real-world recurring charge: a loan with a start and an end date.
  const creditStart = periodStart(addMonths(end, -10));
  const creditEnd = periodStart(addMonths(end, 38)); // ~4-year loan
  const recurringExpenses = [
    {
      id: "rec-credit",
      stableId: STABLE_ID,
      label: "Crédit matériel",
      amount: 340,
      categoryId: undefined,
      isShared: true,
      distributionMode: "equal" as const,
      frequency: "monthly" as const,
      startDate: creditStart,
      endDate: creditEnd,
      source: "recurring" as const,
    },
  ];

  // Le carnet de vie : un historique de soins réaliste qui alimente le
  // moteur d'anticipation (ferrures proches, un vaccin en retard…).
  const today = now.toISOString().slice(0, 10);
  const careEvents: CareEvent[] = [];
  const care = (
    horseIdx: number,
    kind: CareEvent["kind"],
    daysAgo: number,
    extra: Partial<CareEvent> = {},
  ) =>
    careEvents.push({
      id: `care-${kind}-${horseIdx}-${daysAgo}`,
      stableId: STABLE_ID,
      horseId: horses[horseIdx].id,
      kind,
      date: addDays(today, -daysAgo),
      ...extra,
    });

  horses.forEach((_, i) => {
    // Ferrures étalées : certaines arrivent à échéance, d'autres non.
    care(i, "ferrure", 20 + i * 5, { provider: "M. Roche", label: "Ferrure 4 pieds" });
    // Vermifuges il y a ~2 à 3 mois.
    care(i, "vermifuge", 60 + i * 4);
    // Vaccins : Princesse (4) et Mistral (7) sont en retard.
    care(i, "vaccin", i === 4 || i === 7 ? 380 + i : 120 + i * 20, {
      provider: "Dr Lavigne",
      label: "Grippe + tétanos",
    });
  });
  // De la vie dans les carnets des trois premiers chevaux.
  care(0, "dentiste", 200, { provider: "Dr Faure" });
  care(0, "concours", 35, { label: "CSO Club 2, 3e place" });
  care(1, "osteo", 90, { provider: "C. Bonnet" });
  care(1, "veto", 12, { label: "Boiterie légère, repos 1 semaine" });
  care(2, "entrainement", 3, { label: "Séance de plat, bon travail" });
  // L'agenda : ce qui arrive (daysAgo négatif = jours dans le futur).
  // Tout rendez-vous est en attente de confirmation (pending).
  care(0, "concours", -9, { label: "CSO Amateur 2, Deauville", pending: true });
  care(1, "veto", -2, { provider: "Dr Lavigne", label: "Contrôle boiterie", pending: true });
  care(2, "cours_individuel", -1, { label: "Mise en selle, 10 h", pending: true, revenue: 35 });
  // Un cours collectif AUJOURD'HUI, à confirmer : la feuille de présence.
  for (const idx of [2, 4, 6]) {
    care(idx, "cours_collectif", 0, {
      label: "Cours du soir, 18 h",
      pending: true,
      revenue: 25,
      groupId: "grp-demo-cours",
    });
  }

  // Le rythme : ce même cours revient chaque semaine, tout seul. La borne
  // est à aujourd'hui — l'occurrence du jour est déjà semée ci-dessus,
  // l'autopilote générera la suivante.
  const rhythms: Rhythm[] = [
    {
      id: "rh-demo-cours",
      stableId: STABLE_ID,
      kind: "cours_collectif",
      weekday: weekdayOf(today),
      label: "Cours du soir, 18 h",
      horseIds: [horses[2].id, horses[4].id, horses[6].id],
      revenue: 25,
      active: true,
      materializedUntil: today,
    },
  ];

  return {
    horses,
    revenues,
    directExpenses,
    sharedExpenses,
    revenueCategories: DEFAULT_REVENUE_CATEGORIES,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    recurringExpenses,
    careEvents,
    rhythms,
    // La grille tarifaire de la démo : les prix se préremplissent partout.
    tariffs: { pension: 450, cours_collectif: 25, cours_individuel: 35, entrainement: 30 },
  };
}

export const DEMO_STABLE_ID = STABLE_ID;
