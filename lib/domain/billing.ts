import type { Invoice, Period, Revenue, StableData } from "@/lib/domain/types";
import { addMonths } from "@/lib/utils/period";
import { r2 } from "@/lib/utils/arrondi";

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
  /** Ce que son avance (payée un mois d'avant ou ce mois-ci) a réglé sur ce mois. */
  avance?: number;
  /** Ce que tu lui as rendu sur ce mois (« Je l'ai remboursé » après un avoir) : de l'argent reçu qui ne compte plus. */
  rendu?: number;
  due: number;
}

export function monthKey(p: Period): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** Le payeur des recettes d'un cheval sans propriétaire. */
export const SANS_PROPRIETAIRE = "Sans propriétaire";

/** Un même client, quelle que soit la casse ou les espaces (« hugo l. » = « Hugo L. »). */
export const cleClient = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();

/** Le mois (AAAA-MM) qui est `k` mois après `mk` (avant si négatif). */
export function moisPlus(mk: string, k: number): string {
  return monthKey(addMonths({ year: Number(mk.slice(0, 4)), month: Number(mk.slice(5, 7)) }, k));
}

/**
 * Les notes de chaque client pour tous les mois de `de` à `a` (AAAA-MM
 * compris), en une seule passe sur les recettes, les paiements et les
 * avoirs : « Ils te doivent » regarde deux ans de mois sans relire deux ans
 * de recettes par mois. Rend, pour chaque mois qui a quelque chose, les notes
 * triées comme `billsFor`.
 */
export function notesParMois(data: StableData, de: string, a: string): Map<string, Bill[]> {
  // Rangées par client, casse et espaces confondus : Facturer et Clients
  // donnent le même dû pour la même personne.
  const parMois = new Map<string, Map<string, Bill>>();
  if (de > a) return new Map();
  // Une avance se déduit des mois qui suivent : il faut les notes depuis la première avance.
  // Une avance rendue (deAvance) la fait baisser le mois où elle est rendue.
  const avances = (data.payments ?? []).filter((p) => (p.kind === "avance" || (p.kind === "remboursement" && p.deAvance)) && p.month <= a);
  const debut = avances.reduce((m, p) => (p.month < m ? p.month : m), de);
  const voulu = de;
  de = debut;
  const owners = new Set((data.horses.map((h) => h.ownerName).filter(Boolean) as string[]).map(cleClient));
  const personnes = new Map<string, NonNullable<StableData["people"]>[number]>();
  for (const p of data.people ?? []) if (!personnes.has(cleClient(p.name))) personnes.set(cleClient(p.name), p);
  const chevaux = new Map(data.horses.map((h) => [h.id, h]));
  const categories = new Map(data.revenueCategories.map((c) => [c.id, c.name]));
  for (const r of data.revenues) {
    const mk = r.date.slice(0, 7);
    if (mk < de || mk > a) continue;
    // L'argent hors chevaux (PAC, subvention) ne se facture à personne, sauf payeur nommé.
    if (!r.horseId && !r.payer) continue;
    const horse = r.horseId ? chevaux.get(r.horseId) : undefined;
    const brut = r.payer?.trim() || horse?.ownerName?.trim();
    const orphan = !brut;
    const key = orphan ? "\u0000orphan" : cleClient(brut);
    const person = orphan ? undefined : personnes.get(key);
    const payer = orphan ? SANS_PROPRIETAIRE : (person?.name ?? brut);
    const role = orphan ? "proprietaire" : (person?.role ?? (owners.has(key) ? "proprietaire" : "cavalier"));
    let mois = parMois.get(mk);
    if (!mois) parMois.set(mk, (mois = new Map()));
    let b = mois.get(key);
    if (!b) mois.set(key, (b = { payer, role, lines: [], total: 0, paid: 0, due: 0, ...(orphan ? { orphan: true } : {}) }));
    b.lines.push({
      id: r.id,
      label: r.note || (r.categoryId ? categories.get(r.categoryId) : undefined) || "Recette",
      horse: horse?.name,
      horseId: horse?.id,
      amount: r.amount,
      date: r.date,
      ...(r.seanceId ? { seanceId: r.seanceId } : {}),
      ...(r.rebillOf ? { rebillOf: r.rebillOf } : {}),
    });
    b.total += r.amount;
  }
  for (const p of data.payments ?? []) {
    if (p.kind === "remboursement" && p.deAvance) continue;
    if (p.kind === "remboursement") {
      // Rendu sur le mois du trop-perçu : il se retire de ce qui a été payé ce mois-là.
      const b = parMois.get(p.month)?.get(cleClient(p.payer));
      if (b) b.rendu = r2((b.rendu ?? 0) + p.amount);
      continue;
    }
    if (p.kind) continue;
    const b = parMois.get(p.month)?.get(cleClient(p.payer));
    if (!b) continue;
    if (p.seanceId) {
      // Payé sur place : ne compte que si la séance est bien sur sa note du mois.
      const line = b.lines.find((l) => l.seanceId === p.seanceId && !l.onSite);
      if (!line) continue;
      line.onSite = true;
    }
    b.paid += p.amount;
  }
  // L'avance de chaque client, mois après mois : reçue, puis déduite de ce qu'il doit.
  const reserve = new Map<string, number>();
  const recues = new Map<string, Map<string, number>>();
  for (const p of avances) {
    const m = recues.get(p.month) ?? new Map<string, number>();
    m.set(cleClient(p.payer), (m.get(cleClient(p.payer)) ?? 0) + (p.kind === "avance" ? p.amount : -p.amount));
    recues.set(p.month, m);
  }
  const out = new Map<string, Bill[]>();
  const tous = [...new Set([...parMois.keys(), ...recues.keys()])].sort();
  for (const mk of tous) {
    const mois = parMois.get(mk) ?? new Map<string, Bill>();
    for (const [k, x] of recues.get(mk) ?? []) reserve.set(k, Math.max(0, r2((reserve.get(k) ?? 0) + x)));
    for (const x of avoirsDuMois(data, mk)) {
      const b = mois.get(cleClient(x.payer));
      if (b && !b.orphan && x.amount > 0) b.avoirs = [...(b.avoirs ?? []), { number: x.number, amount: x.amount }];
    }
    for (const [k, b] of mois) {
      b.total = r2(b.total);
      b.paid = r2(b.paid);
      const credit = (b.avoirs ?? []).reduce((t, x) => t + x.amount, 0);
      // Ce qui est payé en trop ou rendu par un avoir ne passe pas en négatif ici (voir surplusDe).
      b.due = b.orphan ? 0 : Math.max(0, r2(b.total - (b.paid - (b.rendu ?? 0)) - credit));
      const r = reserve.get(k) ?? 0;
      if (r > 0 && b.due > 0) {
        const pris = Math.min(r, b.due);
        b.avance = r2(pris);
        b.due = r2(b.due - pris);
        reserve.set(k, r2(r - pris));
      }
    }
    if (mk >= voulu && mois.size) out.set(mk, [...mois.values()].sort((x, y) => Number(!!x.orphan) - Number(!!y.orphan) || y.due - x.due || x.payer.localeCompare(y.payer)));
  }
  return out;
}

/**
 * Ce qu'une note a reçu au-delà de ce qu'elle demandait : paiements et avoirs
 * au-delà du total (un avoir sur un mois déjà payé, une séance retirée après
 * paiement). C'est de l'argent à lui rendre (voir avanceEtARendre).
 */
export function surplusDe(b: Pick<Bill, "total" | "paid" | "avoirs" | "rendu">): number {
  const credit = (b.avoirs ?? []).reduce((t, x) => t + x.amount, 0);
  return Math.max(0, r2(b.paid - (b.rendu ?? 0) + credit - b.total));
}

/**
 * L'avance qui reste à un client au mois `pk` (reçue, pas encore déduite), et
 * ce que tu dois lui rendre (le trop-perçu de ses mois, moins ce que tu lui
 * as déjà remboursé). Lit des notes déjà faites depuis le premier mois utile.
 */
export function avanceEtARendre(data: StableData, notes: Map<string, Bill[]>, payer: string, pk: string): { avance: number; aRendre: number } {
  const k = cleClient(payer);
  let recu = 0;
  let rendu = 0;
  for (const p of data.payments ?? []) {
    if (p.month > pk || cleClient(p.payer) !== k) continue;
    if (p.kind === "avance") recu += p.amount;
    else if (p.kind === "remboursement" && p.deAvance) recu -= p.amount;
    else if (p.kind === "remboursement") rendu += p.amount;
  }
  let pris = 0;
  let trop = 0;
  for (const [mk, bills] of notes) {
    if (mk > pk) continue;
    const b = bills.find((x) => !x.orphan && cleClient(x.payer) === k);
    if (!b) continue;
    pris += b.avance ?? 0;
    trop += surplusDe(b);
    // Ce qui est rendu sur un mois connu est déjà retiré de son trop-perçu.
    rendu -= b.rendu ?? 0;
  }
  return { avance: Math.max(0, r2(recu - pris)), aRendre: Math.max(0, r2(trop - rendu)) };
}

/**
 * « Je l'ai remboursé » : ce que tu rends, mois par mois, le plus ancien
 * d'abord. Chaque part va sur le mois de son trop-perçu, pour que ce mois
 * dise juste (Facturer, la fiche, le comptable).
 */
export function partsARendre(data: StableData, payer: string, pk: string): { month: string; amount: number }[] {
  const k = cleClient(payer);
  const premier = [...data.revenues.map((r) => r.date.slice(0, 7)), ...(data.payments ?? []).map((p) => p.month)].filter((m) => m <= pk).sort()[0] ?? pk;
  const out: { month: string; amount: number }[] = [];
  for (const [mk, bills] of [...notesParMois(data, premier, pk)].sort(([x], [y]) => x.localeCompare(y))) {
    const b = bills.find((x) => !x.orphan && cleClient(x.payer) === k);
    const s = b ? surplusDe(b) : 0;
    if (s > 0) out.push({ month: mk, amount: s });
  }
  return out;
}

export function billsFor(data: StableData, period: Period): Bill[] {
  const mk = monthKey(period);
  return notesParMois(data, mk, mk).get(mk) ?? [];
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

const cacheAnnulations = new WeakMap<Invoice[], { revenues: Revenue[]; parMois: Map<string, Annulation[]>; n: Map<string, number>; rev: Map<string, Revenue> }>();

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
    // Combien de fois chaque recette est facturée (un avoir la rend), et les recettes par id : une fois pour tous les mois.
    const n = new Map<string, number>();
    for (const i of invoices) for (const id of i.revenueIds) n.set(id, (n.get(id) ?? 0) + (i.kind === "avoir" ? -1 : 1));
    c = { revenues: data.revenues, parMois: new Map(), n, rev: new Map(data.revenues.map((r) => [r.id, r])) };
    cacheAnnulations.set(invoices, c);
  }
  const vu = c.parMois.get(month);
  if (vu) return vu;
  const { n, rev } = c;
  const rendue = (id: string) => rev.has(id) && (n.get(id) ?? 0) <= 0;
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
  return r2(t);
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
  const mk = monthKey(period);
  const notes = notesParMois(data, moisPlus(mk, -lookback), moisPlus(mk, -1));
  const k = cleClient(payer);
  for (let i = 1; i <= lookback && out.length < count; i++) {
    const p = addMonths(period, -i);
    const b = notes.get(monthKey(p))?.find((x) => !x.orphan && cleClient(x.payer) === k);
    if (b && b.total > 0) out.push({ period: p, total: b.total, paid: b.paid, due: b.due });
  }
  return out;
}
