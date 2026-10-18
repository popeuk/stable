import type {
  Payment,
  Person,
  Prestation,
  Seance,
  TaskList,
  TeamTask,
  Category,
  DirectExpense,
  Horse,
  Revenue,
  SharedExpense,
  StableData,
} from "@/lib/domain/types";
import type { CareEvent } from "@/lib/domain/care";
import { addDays } from "@/lib/domain/care";
import { weekdayOf } from "@/lib/domain/rhythm";
import { distribute } from "@/lib/domain/distribution";
import { revenuesForSeance } from "@/lib/domain/seances";
import { addMonths, currentPeriod, periodStart } from "@/lib/utils/period";
import { POSTES_AJOUTES, PREMIER_POSTE_AJOUTE } from "@/lib/domain/postes-communs";

const STABLE_ID = "demo-stable";

/** L'écurie de démonstration « Les Trois Pommiers » (fictive). */
const DEMO_HORSES: {
  name: string;
  breed: string;
  birthYear: number;
  pension: number;
  variableCost: number;
  formule: string;
  owner: string;
  coat: string;
  blaze: boolean;
}[] = [
  { name: "Sirius", breed: "SF", birthYear: 2015, pension: 590, variableCost: 90, formule: "Pension travail", owner: "Léa B.", coat: "alezan", blaze: true },
  { name: "Diva", breed: "PSA", birthYear: 2017, pension: 490, variableCost: 150, formule: "Box + paddock", owner: "Inès R.", coat: "gris", blaze: false },
  { name: "Belle", breed: "Connemara", birthYear: 2013, pension: 450, variableCost: 30, formule: "Retraite", owner: "Marc T.", coat: "isabelle", blaze: true },
  { name: "Tonnerre", breed: "PRE", birthYear: 2014, pension: 590, variableCost: 70, formule: "Pension travail", owner: "Hugo L.", coat: "noir", blaze: false },
  { name: "Princesse", breed: "TF", birthYear: 2008, pension: 390, variableCost: 45, formule: "Box seul", owner: "Nadia S.", coat: "pie", blaze: true },
  { name: "Vaillant", breed: "AA", birthYear: 2010, pension: 490, variableCost: 80, formule: "Box + paddock", owner: "Claire M.", coat: "bai", blaze: true },
  { name: "Pacha", breed: "Welsh", birthYear: 2018, pension: 490, variableCost: 150, formule: "Box + paddock", owner: "Julie P.", coat: "alezan", blaze: false },
  { name: "Mistral", breed: "SF", birthYear: 2009, pension: 590, variableCost: 55, formule: "Pension travail", owner: "Paul D.", coat: "gris", blaze: true },
  { name: "Câline", breed: "Haflinger", birthYear: 2004, pension: 450, variableCost: 30, formule: "Retraite", owner: "Sophie G.", coat: "bai", blaze: false },
];

export const DEFAULT_REVENUE_CATEGORIES: Category[] = [
  "Pension",
  "Cours",
  "Sport",
  "Transport",
  "Débourrage",
  "Demi-pension",
  "Vente",
  "Refacturation",
].map((name, i) => ({ id: `rev-${i}`, name }));

export const DEFAULT_EXPENSE_CATEGORIES: Category[] = [
  ...["Maréchal-ferrant", "Vétérinaire", "Médicaments", "Équipement", "Concours", "Transport", "Compléments"].map(
    (name, i) => ({ id: `exp-d-${i}`, name, isDirect: true }),
  ),
  ...["Foin", "Granulés", "Litière", "Personnel", "Loyer / foncier", "Eau", "Électricité", "Assurance", "Entretien", "Fournitures"].map(
    (name, i) => ({ id: `exp-s-${i}`, name, isDirect: false }),
  ),
  // Emprunt, MSA, carburant, soins non refacturés : les mêmes pour une écurie déjà enregistrée (postes-communs.ts).
  ...POSTES_AJOUTES.map((name, i) => ({ id: `exp-s-${PREMIER_POSTE_AJOUTE + i}`, name, isDirect: false })),
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
    // Entrés il y a 12 à 40 mois : présents sur les 12 mois de l'exemple
    // (un cheval ne partage les frais communs qu'à partir de son arrivée).
    entryDate: periodStart(addMonths(end, -(12 + idx * 3))),
    exitDate: null,
    isArchived: false,
    pensionType: DEMO_HORSES[idx].formule,
    ownerName: DEMO_HORSES[idx].owner,
    coat: DEMO_HORSES[idx].coat,
    blaze: DEMO_HORSES[idx].blaze,
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

      // Direct variable costs (farrier / vet) most months. Chaque libellé dans sa catégorie (le CSV du comptable les range).
      const marechal = rng() > 0.5;
      directExpenses.push({
        id: `dexp-${horse.id}-${monthDate}`,
        stableId: STABLE_ID,
        horseId: horse.id,
        categoryId: (DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === (marechal ? "Maréchal-ferrant" : "Compléments")) ?? DEFAULT_EXPENSE_CATEGORIES[0]).id,
        label: marechal ? "Maréchal-ferrant" : "Compléments",
        amount: Math.round(base.variableCost * (0.7 + rng() * 0.5)),
        date: monthDate,
        source: "manual",
      });

      // ~20% of months: a vet bill.
      if (rng() > 0.88) {
        directExpenses.push({
          id: `vet-${horse.id}-${monthDate}`,
          stableId: STABLE_ID,
          horseId: horse.id,
          categoryId: DEFAULT_EXPENSE_CATEGORIES[1].id,
          label: "Vétérinaire",
          amount: 60 + Math.round(rng() * 120),
          date: monthDate,
          source: "photo",
        });
      }
    });

    // Mutualised charges, split across all horses.
    const sharedDefs: { label: string; cat: number; total: number; mode: "equal" | "weighted_by_days" }[] = [
      { label: "Foin", cat: 7, total: 930 + Math.round(rng() * 100), mode: "weighted_by_days" },
      { label: "Granulés", cat: 8, total: 480 + Math.round(rng() * 80), mode: "weighted_by_days" },
      { label: "Litière", cat: 9, total: 380, mode: "equal" },
      { label: "Personnel", cat: 10, total: 1100, mode: "equal" },
      { label: "Loyer / foncier", cat: 11, total: 780, mode: "equal" },
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
      label: "Assurance",
      amount: 120,
      categoryId: DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === "Assurance")?.id,
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
  care(6, "ferrure", 0, { label: "Ferrure orthopédique", provider: "M. Roche", pending: true, cost: 85, start: "11:30" });
  careEvents.find((e) => e.kind === "veto" && e.pending)!.start = "09:00";

  // Les personnes : les propriétaires des chevaux, et les cavaliers des cours.
  const people: Person[] = [
    ...DEMO_HORSES.map((h, i) => ({ id: `pers-owner-${i}`, name: h.owner, role: "proprietaire" as const, active: true })),
    ...["Emma", "Hugo", "Lou", "Nina"].map((n, i) => ({ id: `pers-cav-${i}`, name: n, role: "cavalier" as const, active: true })),
  ];
  const prestations: Prestation[] = [
    { id: "prest-cours", label: "Cours d’équitation", price: 25, hasFormat: true, active: true },
    { id: "prest-particulier", label: "Cours particulier", price: 35, active: true },
    { id: "prest-travail", label: "Travail du cheval", price: 30, active: true },
    { id: "prest-balade", label: "Balade encadrée", price: 20, active: true },
  ];

  // Les séances : le cours du soir chaque semaine (collectif, 6 places),
  // deux cours particuliers réguliers. Le passé est validé, la dernière
  // séance passée attend sa validation.
  const seances: Seance[] = [];
  const mkSeries = (
    key: string,
    weekday: number,
    weeksBack: number,
    weeksAhead: number,
    base: Omit<Seance, "id" | "date" | "status" | "seriesId" | "rev">,
  ) => {
    const offset = (weekdayOf(today) - weekday + 7) % 7;
    const anchor = addDays(today, -offset);
    for (let w = -weeksBack; w <= weeksAhead; w++) {
      const date = addDays(anchor, w * 7);
      seances.push({ ...base, id: `seance-${key}-${date}`, date, status: "planned", seriesId: `serie-${key}`, rev: 1 });
    }
  };
  const cav = (i: number, horse: number) => ({ personId: `pers-cav-${i}`, horseId: horses[horse].id });
  mkSeries("soir", (weekdayOf(today) + 6) % 7, 5, 9, {
    prestationId: "prest-cours", title: "Cours du soir", format: "collectif", places: 6,
    participants: [cav(0, 0), cav(1, 3), cav(2, 5), cav(3, 7)], horseIds: [horses[0].id, horses[3].id, horses[5].id, horses[7].id],
    start: "18:00", end: "19:00", lieu: "Carrière", unitPrice: 25,
  });
  mkSeries("lea", weekdayOf(today), 5, 9, {
    prestationId: "prest-particulier", title: "Cours de Sirius", format: "particulier", places: 1,
    participants: [{ personId: "pers-owner-0", horseId: horses[0].id }], horseIds: [horses[0].id],
    start: "10:00", end: "11:00", lieu: "Carrière", unitPrice: 35,
  });
  mkSeries("paul", (weekdayOf(today) + 5) % 7, 5, 9, {
    prestationId: "prest-particulier", title: "Cours de Mistral", format: "particulier", places: 1,
    participants: [{ personId: "pers-owner-7", horseId: horses[7].id }], horseIds: [horses[7].id],
    start: "10:00", end: "11:00", unitPrice: 35,
  });
  // Le passé (avant hier) est validé, recettes comprises ; hier attend.
  const yesterday = addDays(today, -1);
  let n = 0;
  for (const se of seances) {
    if (se.date >= yesterday) continue;
    se.status = "done";
    se.participants = se.participants.map((p) => ({ ...p, present: true }));
    revenues.push(...revenuesForSeance(se, { people, revenueCategories: DEFAULT_REVENUE_CATEGORIES }, () => `rev-seance-${n++}`, STABLE_ID));
  }

  const taskLists: TaskList[] = [
    { id: "list-todo", title: "À faire" },
    { id: "list-doing", title: "En cours" },
    { id: "list-done", title: "Fait", isDone: true },
  ];
  const tasks: TeamTask[] = [
    { id: "task-cloture", title: "Réparer la clôture du pré 2", listId: "list-todo", labels: ["Urgent", "Écurie"], due: `${today}T17:00`, forWho: ["Marc"], cost: 120, checklist: [{ id: "c1", text: "Acheter 4 piquets", done: true }, { id: "c2", text: "Retendre le fil", done: false }, { id: "c3", text: "Vérifier le courant", done: false }], comments: [{ by: "Julie", at: new Date(now.getTime() - 2 * 3600e3).toISOString(), text: "Les chevaux du pré 2 sont rentrés au paddock en attendant." }], sort: 1 },
    { id: "task-dentiste", title: "Prendre rendez-vous dentiste pour Mistral", listId: "list-todo", labels: ["Chevaux"], due: `${addDays(today, 3)}`, forWho: ["Julie"], checklist: [], comments: [], sort: 2 },
    { id: "task-cavaliere", title: "Rappeler la cavalière intéressée par un box", listId: "list-todo", labels: ["Clients"], forWho: [], checklist: [], comments: [], sort: 3 },
    { id: "task-tarifs", title: "Envoyer la lettre de tarifs 2027", listId: "list-todo", labels: ["Admin"], due: `${addDays(today, 6)}`, forWho: [], checklist: [], comments: [], sort: 4 },
    { id: "task-abri", title: "Abri du paddock 3", listId: "list-doing", labels: ["Travaux"], due: `${addDays(today, 19)}`, forWho: ["Marc"], checklist: [], comments: [], sort: 1 },
    { id: "task-foin", title: "Deux devis de foin à l’année", listId: "list-doing", labels: ["Écurie"], forWho: [], checklist: [], comments: [], sort: 2 },
  ];
  const monthKeyNow = today.slice(0, 7);
  // Paiements réalistes : les mois d'avant sont réglés. Ce mois-ci, la plupart
  // des propriétaires ont payé leur pension, trois doivent encore la leur, et
  // les extras (cours, soins refacturés) restent dus.
  const owner = new Map(horses.map((h) => [h.id, h.ownerName ?? ""]));
  const dues = new Map<string, number>();
  for (const r of revenues) {
    const m = r.date.slice(0, 7);
    if (m >= monthKeyNow) continue;
    const who = r.payer ?? owner.get(r.horseId) ?? "";
    if (!who) continue;
    const k = `${who}|${m}`;
    dues.set(k, (dues.get(k) ?? 0) + r.amount);
  }
  const payments: Payment[] = [...dues].map(([k, amount], i) => {
    const [payer, month] = k.split("|");
    return { id: `pay-old-${i}`, payer, month, amount: Math.round(amount * 100) / 100, at: `${month}-05T09:00:00.000Z` };
  });
  // Ce mois : la pension réellement comptée, payée par tous sauf trois.
  const pensionDuMois = new Map<string, number>();
  for (const r of revenues) {
    if (r.date.slice(0, 7) !== monthKeyNow || r.categoryId !== pensionCat || r.payer) continue;
    const who = owner.get(r.horseId) ?? "";
    if (who) pensionDuMois.set(who, (pensionDuMois.get(who) ?? 0) + r.amount);
  }
  const doiventEncore = new Set([1, 4, 6].map((i) => DEMO_HORSES[i].owner));
  [...pensionDuMois].forEach(([payer, amount], i) => {
    if (doiventEncore.has(payer)) return;
    payments.push({ id: `pay-${i}`, payer, month: monthKeyNow, amount: Math.round(amount * 100) / 100, at: now.toISOString() });
  });

  return {
    horses,
    revenues,
    directExpenses,
    sharedExpenses,
    revenueCategories: DEFAULT_REVENUE_CATEGORIES,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    recurringExpenses,
    careEvents,
    rhythms: [],
    people,
    prestations,
    seances,
    taskLists,
    tasks,
    actions: [],
    payments,
    // La grille tarifaire de la démo : les prix se préremplissent partout.
    tariffs: { pension: 450, cours_collectif: 25, cours_individuel: 35, entrainement: 30 },
    // Les prestations libres du gérant, avec leur prix par défaut.
    services: [
      { id: "svc-balade", name: "Balade encadrée", price: 20 },
      { id: "svc-transport", name: "Transport concours", price: 50 },
    ],
    // L'équipe : les gens qui travaillent à l'écurie ; on leur assigne les tâches du planning.
    team: [
      { id: "tm-julie", name: "Julie", role: "employe", job: "Monitrice" },
      { id: "tm-marc", name: "Marc", role: "employe", job: "Palefrenier" },
    ],
    // Les pros qui viennent : proposés dans « Qui vient ».
    pros: [
      { id: "tm-roche", name: "M. Roche", metier: "marechal", phone: "06 12 34 56 78" },
      { id: "tm-lavigne", name: "Dr Lavigne", metier: "veto", phone: "02 43 00 00 00" },
    ],
  };
}

export const DEMO_STABLE_ID = STABLE_ID;
