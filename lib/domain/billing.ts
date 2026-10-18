import type { Invoice, Period, Revenue, StableData } from "@/lib/domain/types";
import { addMonths, dateInPeriod } from "@/lib/utils/period";

/**
 * Ce qu'il faut facturer, personne par personne, pour un mois (le décompte
 * du planning du Clos, élargi) : la pension, les séances faites, les soins
 * refacturés. Le payeur d'une recette est noté sur elle ; à défaut, c'est
 * le propriétaire du cheval. Domaine pur.
 */
export interface BillLine {
  /** L'id de la recette : c'est elle qu'on retire si la ligne n'a pas eu lieu. */
  id: string;
  label: string;
  horse?: string;
  horseId?: string;
  amount: number;
  date: string;
  /** La séance d'origine (cours, balade…). */
  seanceId?: string;
  /** Un soin refacturé : la dépense d'origine. */
  rebillOf?: string;
  /** Réglée sur place, à la séance. */
  onSite?: boolean;
}
export interface Bill {
  payer: string;
  /**
   * Les recettes de chevaux sans propriétaire : personne à qui les
   * facturer. Elles sont dites telles quelles, jamais comptées dans ce qui
   * reste à recevoir.
   */
  orphan?: boolean;
  role: "proprietaire" | "cavalier";
  lines: BillLine[];
  total: number;
  paid: number;
  /**
   * Les avoirs faits sur ses factures du mois, et ce que chacun retire de ce
   * qu'il doit (positif). Une recette annulée par l'avoir puis retirée, ou
   * remise sur une nouvelle facture, ne se retire pas deux fois.
   */
  avoirs?: { number: string; amount: number }[];
  due: number;
}

export function monthKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** Le payeur des recettes d'un cheval sans propriétaire. */
export const SANS_PROPRIETAIRE = "Sans propriétaire";

/** Un même client, quelle que soit la casse ou les espaces (« hugo l. » = « Hugo L. »). */
export const cleClient = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();

export function billsFor(data: StableData, period: Period): Bill[] {
  // Rangées par client, casse et espaces confondus : Facturer et Clients
  // donnent le même dû pour la même personne.
  const map = new Map<string, Bill>();
  const owners = new Set((data.horses.map((h) => h.ownerName).filter(Boolean) as string[]).map(cleClient));
  const nomDe = (n: string) => data.people?.find((p) => cleClient(p.name) === cleClient(n))?.name ?? n.trim();
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name;
  for (const r of data.revenues) {
    if (!dateInPeriod(r.date, period)) continue;
    // L'argent hors chevaux (PAC, subvention) ne se facture à personne, sauf payeur nommé.
    if (!r.horseId && !r.payer) continue;
    const horse = data.horses.find((h) => h.id === r.horseId);
    const brut = r.payer?.trim() || horse?.ownerName?.trim();
    const orphan = !brut;
    const payer = orphan ? SANS_PROPRIETAIRE : nomDe(brut);
    const key = orphan ? "\u0000orphan" : cleClient(payer);
    const person = data.people?.find((p) => cleClient(p.name) === key);
    const role = orphan ? "proprietaire" : (person?.role ?? (owners.has(key) ? "proprietaire" : "cavalier"));
    const b = map.get(key) ?? { payer, role, lines: [], total: 0, paid: 0, due: 0, ...(orphan ? { orphan: true } : {}) };
    b.lines.push({
      id: r.id,
      label: r.note || catName(r.categoryId) || "Recette",
      horse: horse?.name,
      horseId: horse?.id,
      amount: r.amount,
      date: r.date,
      ...(r.seanceId ? { seanceId: r.seanceId } : {}),
      ...(r.rebillOf ? { rebillOf: r.rebillOf } : {}),
    });
    b.total += r.amount;
    map.set(key, b);
  }
  const mk = monthKey(period);
  for (const p of data.payments ?? []) {
    if (p.month !== mk) continue;
    const b = map.get(cleClient(p.payer));
    if (!b) continue;
    if (p.seanceId) {
      // Payé sur place : ne compte que si la séance est bien sur sa note du mois.
      const line = b.lines.find((l) => l.seanceId === p.seanceId && !l.onSite);
      if (!line) continue;
      line.onSite = true;
    }
    b.paid += p.amount;
  }
  for (const a of avoirsDuMois(data, mk)) {
    const b = map.get(cleClient(a.payer));
    if (b && !b.orphan && a.amount > 0) b.avoirs = [...(b.avoirs ?? []), { number: a.number, amount: a.amount }];
  }
  for (const b of map.values()) {
    b.total = Math.round(b.total * 100) / 100;
    const credit = (b.avoirs ?? []).reduce((t, a) => t + a.amount, 0);
    b.due = Math.max(0, Math.round((b.total - b.paid - credit) * 100) / 100);
  }
  for (const b of map.values()) if (b.orphan) b.due = 0;
  return [...map.values()].sort((a, b) => Number(!!a.orphan) - Number(!!b.orphan) || b.due - a.due || a.payer.localeCompare(b.payer));
}

/** Ce qu'un avoir retire d'un mois : pour le client, et cheval par cheval (`""` : l'argent sans cheval). */
export interface Annulation {
  number: string;
  payer: string;
  issuedAt: string;
  /** Ce que l'avoir retire de ce que le client doit, et de la recette du mois (positif). */
  amount: number;
  parCheval: { horseId: string; amount: number }[];
}

const cacheAnnulations = new WeakMap<Invoice[], { revenues: Revenue[]; parMois: Map<string, Annulation[]> }>();

/**
 * Ce que chaque avoir d'un mois (le mois de la facture) retire, une seule
 * fois, de ce que le client doit et de la recette du mois. Une ligne
 * d'avoir rend des recettes précises : chacune compte pour son prix, tant
 * qu'elle existe encore et qu'elle n'est pas repartie sur une autre facture
 * (sinon le client la doit de nouveau, ou elle a déjà été retirée). Un avoir
 * d'un montant compte pour son total, et se range sur les chevaux de la
 * facture au prorata de ce qu'ils y ont encore. Mon bilan, la fiche du cheval et celle du client lisent tous ceci.
 */
export function annulationsDuMois(data: Pick<StableData, "invoices" | "revenues">, month: string): Annulation[] {
  const invoices = data.invoices ?? [];
  if (!invoices.some((i) => i.kind === "avoir")) return [];
  let c = cacheAnnulations.get(invoices);
  if (!c || c.revenues !== data.revenues) {
    c = { revenues: data.revenues, parMois: new Map() };
    cacheAnnulations.set(invoices, c);
  }
  const vu = c.parMois.get(month);
  if (vu) return vu;
  const n = new Map<string, number>();
  for (const i of invoices) for (const id of i.revenueIds) n.set(id, (n.get(id) ?? 0) + (i.kind === "avoir" ? -1 : 1));
  const rev = new Map(data.revenues.map((r) => [r.id, r]));
  const rendue = (id: string) => rev.has(id) && (n.get(id) ?? 0) <= 0;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const out: Annulation[] = [];
  for (const a of invoices) {
    if (a.kind !== "avoir" || a.month !== month) continue;
    const par = new Map<string, number>();
    const ajoute = (h: string, x: number) => par.set(h, (par.get(h) ?? 0) + x);
    let libre = 0;
    for (const l of a.lines) {
      if (l.revenueIds?.length) for (const id of l.revenueIds.filter(rendue)) ajoute(rev.get(id)!.horseId ?? "", Math.abs(l.unitTTC));
      else libre += Math.abs(l.totalTTC);
    }
    if (libre > 0 && a.revenueIds.length) {
      // Un avoir d'avant les lignes détaillées : les recettes qu'il rend, à leur prix, tant qu'elles comptent.
      for (const id of a.revenueIds.filter(rendue)) ajoute(rev.get(id)!.horseId ?? "", rev.get(id)!.amount);
    } else if (libre > 0) {
      // Un avoir d'un montant : rangé sur les chevaux de la facture, au prorata de ce qu'ils y ont encore.
      const facture = invoices.find((i) => i.kind !== "avoir" && i.number === a.avoirDe?.number);
      const poids = new Map<string, number>();
      for (const id of facture?.revenueIds ?? []) {
        const r = rev.get(id);
        if (r && (n.get(id) ?? 0) > 0) poids.set(r.horseId ?? "", (poids.get(r.horseId ?? "") ?? 0) + r.amount);
      }
      const total = [...poids.values()].reduce((t, x) => t + x, 0);
      if (total > 0) {
        let reste = r2(libre);
        const ps = [...poids.entries()];
        ps.forEach(([h, w], k) => {
          const part = k === ps.length - 1 ? reste : r2((libre * w) / total);
          reste = r2(reste - part);
          ajoute(h, part);
        });
      } else ajoute("", libre);
    }
    const parCheval = [...par.entries()].map(([horseId, x]) => ({ horseId, amount: r2(x) })).filter((x) => x.amount > 0);
    out.push({ number: a.number, payer: a.payer, issuedAt: a.issuedAt, amount: r2(parCheval.reduce((t, x) => t + x.amount, 0)), parCheval });
  }
  c.parMois.set(month, out);
  return out;
}

/** Ce que chaque avoir d'un mois retire de ce que le client doit (positif). */
export function avoirsDuMois(data: Pick<StableData, "invoices" | "revenues">, month: string): { number: string; payer: string; amount: number }[] {
  return annulationsDuMois(data, month).map(({ number, payer, amount }) => ({ number, payer, amount }));
}

/** Ce que les avoirs retirent de la recette d'un cheval (`""` : l'argent sans cheval) pour un mois. */
export function annuleSurCheval(data: Pick<StableData, "invoices" | "revenues">, horseId: string, period: Period): number {
  let t = 0;
  for (const a of annulationsDuMois(data, monthKey(period))) for (const x of a.parCheval) if (x.horseId === horseId) t += x.amount;
  return Math.round(t * 100) / 100;
}

/** La note d'un client ce mois-ci (casse et espaces confondus), ou undefined. */
export function billOf(data: StableData, payer: string, period: Period): Bill | undefined {
  return billsFor(data, period).find((b) => !b.orphan && cleClient(b.payer) === cleClient(payer));
}

/** Ce qu'un client doit ce mois-ci (0 s'il ne doit rien ou n'a rien eu). */
export function dueOf(data: StableData, payer: string, period: Period): number {
  return billOf(data, payer, period)?.due ?? 0;
}

/**
 * Les totaux de Facturer : ce qui est à facturer à quelqu'un, reçu, encore
 * à recevoir. L'argent des chevaux sans propriétaire est à part
 * (`sansProprietaire`) : il n'y a personne à qui le demander.
 */
export function billTotals(bills: Bill[]) {
  const real = bills.filter((b) => !b.orphan);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const total = r2(real.reduce((t, b) => t + b.total, 0));
  const paid = r2(real.reduce((t, b) => t + Math.min(b.paid, b.total), 0));
  return { total, paid, due: r2(real.reduce((t, b) => t + b.due, 0)), sansProprietaire: r2(bills.filter((b) => b.orphan).reduce((t, b) => t + b.total, 0)) };
}

export interface MonthSummary {
  period: Period;
  total: number;
  paid: number;
  due: number;
}

/**
 * Les mois d'avant d'un client : pour chacun, ce qu'il y avait en tout et ce
 * qu'il a payé. Les mois vides sont sautés. Du plus récent au plus ancien.
 */
export function monthsBefore(data: StableData, payer: string, period: Period, count = 3, lookback = 12): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let k = 1; k <= lookback && out.length < count; k++) {
    const p = addMonths(period, -k);
    const b = billOf(data, payer, p);
    if (b && b.total > 0) out.push({ period: p, total: b.total, paid: Math.round(b.paid * 100) / 100, due: b.due });
  }
  return out;
}
