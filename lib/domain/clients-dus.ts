import type { Period, PersonRole, StableData } from "@/lib/domain/types";
import { dateInPeriod } from "@/lib/utils/period";
import { avanceEtARendre, cleClient, monthKey, moisPlus, notesParMois, surplusDe, type Bill } from "@/lib/domain/billing";
import { r2 } from "@/lib/utils/arrondi";

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
  const owners = new Set((data.horses.map((h) => h.ownerName).filter(Boolean) as string[]).map(cleClient));
  const catName = (id?: string) =>
    data.revenueCategories.find((c) => c.id === id)?.name ?? "";
  const map = new Map<string, ClientRevenue>();
  for (const r of data.revenues) {
    if (!dateInPeriod(r.date, period)) continue;
    const horse = data.horses.find((h) => h.id === r.horseId);
    const name = (r.payer ?? horse?.ownerName)?.trim();
    if (!name) continue;
    const k = cleClient(name);
    const role =
      data.people?.find((p) => cleClient(p.name) === k)?.role ??
      (owners.has(k) ? "proprietaire" : "cavalier");
    const c =
      map.get(k) ??
      ({
        name,
        role,
        horses: data.horses
          .filter((h) => !h.isArchived && !!h.ownerName && cleClient(h.ownerName) === k)
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
    map.set(k, c);
  }
  return [...map.values()]
    .map((c) => ({ ...c, total: r2(c.total) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "fr"));
}

/* ------------------------------------------------------------------ */
/* Tes clients : qui te doit quoi                                       */
/* ------------------------------------------------------------------ */

/**
 * Une ligne de la liste « Tes clients ». Client = toute personne qui te
 * rapporte de l'argent (propriétaire ou cavalier) ; les pros n'en sont pas.
 * Ce qu'il doit vient de `billsFor` : ce qui a compté ce mois, moins ce
 * qu'il a payé.
 */
export interface ClientDue {
  name: string;
  personId?: string;
  role: PersonRole;
  /** Ses chevaux en pension (noms). */
  horses: string[];
  /** Ce qui a compté ce mois. */
  total: number;
  paid: number;
  /** Ce qu'il te doit encore, tous mois confondus (jamais négatif). */
  due: number;
  /** Ce qu'il doit encore sur le mois lui-même. */
  dueMois: number;
  /** Ce qu'il doit encore des mois d'avant, du plus ancien au plus récent (AAAA-MM). */
  anciens: { month: string; due: number }[];
  /** Son avance : payée en plus, pas encore déduite (elle se déduit toute seule des mois qui suivent). */
  avance: number;
  /** Ce que tu dois lui rendre : un avoir sur un mois déjà payé, moins ce que tu lui as remboursé. */
  aRendre: number;
  paieALaSeance: boolean;
  phone?: string;
}

/** Jusqu'où remonter pour retrouver un impayé ancien : deux ans. */
const RECUL = 24;

type Ancien = { name: string; role: PersonRole; month: string; due: number };

/** Le premier mois à regarder : celui de la plus ancienne recette, sans remonter plus de deux ans avant `pk`. */
function premierMois(data: StableData, pk: string): string {
  let premier = pk;
  for (const r of data.revenues) if (r.date.slice(0, 7) < premier) premier = r.date.slice(0, 7);
  const borne = moisPlus(pk, -RECUL);
  return premier < borne ? borne : premier;
}

/** Les impayés des mois d'avant `pk`, lus dans des notes déjà faites (notesParMois). */
function anciensDe(notes: Map<string, Bill[]>, pk: string): Map<string, Ancien[]> {
  const out = new Map<string, Ancien[]>();
  for (const mk of [...notes.keys()].filter((m) => m < pk).sort()) {
    for (const b of notes.get(mk)!) {
      if (b.orphan || b.due <= 0) continue;
      const key = cleClient(b.payer);
      const l = out.get(key);
      const x = { name: b.payer, role: b.role, month: mk, due: b.due };
      if (l) l.push(x);
      else out.set(key, [x]);
    }
  }
  return out;
}

/**
 * Les impayés des mois d'avant `period`, client par client (casse et espaces
 * confondus, cleClient) : pour chaque mois encore dû, le mois et ce qui reste.
 * Du plus ancien au plus récent. Le premier mois regardé est celui de la plus
 * ancienne recette, sans remonter plus de deux ans.
 */
export function impayesAnciens(data: StableData, period: Period): Map<string, Ancien[]> {
  const pk = monthKey(period);
  return anciensDe(notesParMois(data, premierMois(data, pk), moisPlus(pk, -1)), pk);
}

/**
 * Qui te doit quoi au mois `period` : ce qui a compté ce mois, ce qu'il a
 * payé, et ce qu'il doit encore, tous mois confondus. Un impayé de
 * septembre reste dans « Ils te doivent » en novembre, avec son mois. Tout
 * est lu en une passe (notesParMois), du premier mois regardé à `period`.
 */
export function clientDues(data: StableData, period: Period): ClientDue[] {
  const pk = monthKey(period);
  const notes = notesParMois(data, premierMois(data, pk), pk);
  const bills = (notes.get(pk) ?? []).filter((b) => !b.orphan);
  const personnes = new Map<string, NonNullable<StableData["people"]>[number]>();
  for (const p of data.people ?? []) if (!personnes.has(cleClient(p.name))) personnes.set(cleClient(p.name), p);
  const chevaux = new Map<string, string[]>();
  for (const h of data.horses) {
    if (h.isArchived || !h.ownerName) continue;
    const k = cleClient(h.ownerName);
    chevaux.set(k, [...(chevaux.get(k) ?? []), h.name]);
  }
  const map = new Map<string, ClientDue>();
  const add = (name: string, role: PersonRole) => {
    const k = cleClient(name);
    const deja = map.get(k);
    if (deja) return deja;
    const p = personnes.get(k);
    const c: ClientDue = {
      name,
      personId: p?.id,
      role: p?.role ?? role,
      horses: chevaux.get(k) ?? [],
      total: 0,
      paid: 0,
      due: 0,
      dueMois: 0,
      anciens: [],
      avance: 0,
      aRendre: 0,
      paieALaSeance: !!p?.paieALaSeance,
      phone: p?.phone,
    };
    map.set(k, c);
    return c;
  };
  for (const b of bills) {
    const c = add(b.payer, b.role);
    c.total = r2(c.total + b.total);
    c.paid = r2(c.paid + b.paid);
    c.due = r2(c.due + b.due);
    c.dueMois = c.due;
  }
  for (const [, mois] of anciensDe(notes, pk)) {
    const c = add(mois[0].name, mois[0].role);
    c.anciens = mois.map(({ month, due }) => ({ month, due }));
    c.due = r2(c.dueMois + mois.reduce((t, m) => t + m.due, 0));
  }
  // Une avance ou un trop-perçu : seulement pour qui a déjà payé quelque chose d'à part.
  const aPart = new Set((data.payments ?? []).filter((p) => p.kind && p.month <= pk).map((p) => cleClient(p.payer)));
  const avecTrop = new Set<string>();
  for (const bs of notes.values()) for (const b of bs) if (!b.orphan && surplusDe(b) > 0) avecTrop.add(cleClient(b.payer));
  for (const k of new Set([...aPart, ...avecTrop])) {
    const nom = [...notes.values()].flat().find((b) => !b.orphan && cleClient(b.payer) === k)?.payer ?? (data.payments ?? []).find((p) => cleClient(p.payer) === k)!.payer;
    const c = add(nom, "cavalier");
    Object.assign(c, avanceEtARendre(data, notes, nom, pk));
  }
  for (const p of data.people ?? []) if (p.active) add(p.name, p.role);
  for (const h of data.horses) if (!h.isArchived && h.ownerName) add(h.ownerName, "proprietaire");
  return [...map.values()].sort(
    (a, b) => (b.due > 0 ? 1 : 0) - (a.due > 0 ? 1 : 0) || b.due - a.due || a.name.localeCompare(b.name, "fr"),
  );
}

/** Ce qu'un client doit en tout au mois `period` (tous mois confondus, avec le détail), ou undefined s'il n'est pas connu. */
export function dusDuClient(data: StableData, payer: string, period: Period): ClientDue | undefined {
  const k = cleClient(payer);
  return clientDues(data, period).find((c) => cleClient(c.name) === k);
}
