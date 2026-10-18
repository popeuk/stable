import type { Period, StableData } from "@/lib/domain/types";
import { horsePnl, horseSharedCosts, isOutside, stablePnl } from "@/lib/domain/calculations";
import { dateInPeriod } from "@/lib/utils/period";
import { montantsDuMois, recurringList, recurringDue, recurringDirectDue, recurringRevenuesDue } from "@/lib/domain/recurring";
import { chevauxDuMois, chevauxPresents, repartition } from "@/lib/domain/presence";
import { presenceDays } from "@/lib/domain/distribution";
import { daysInMonth, periodEnd, periodStart } from "@/lib/utils/period";
import { debutCompte, finCompte, sejourDuMois } from "@/lib/domain/sejours";

/**
 * Le ticket du mois d'un cheval, et le bilan du mois de l'écurie, dans la
 * forme que l'app montre : des lignes lisibles, un total. Les totaux
 * viennent des calculs existants (calculations.ts) : le ticket ne recalcule
 * rien, il range. Domaine pur, zéro framework.
 */

export interface TicketLine {
  key: string;
  label: string;
  /** Positif = ce qui rentre, négatif = ce qui sort. */
  amount: number;
  /** Identifiant de la ligne source (revenu, dépense) pour la retrouver. */
  sourceId?: string;
  date?: string;
  kind: "in" | "out" | "share";
}

export interface HorseTicket {
  horseId: string;
  lines: TicketLine[];
  revenue: number;
  direct: number;
  share: number;
  net: number;
}

function catName(data: StableData, id?: string): string | undefined {
  if (!id) return undefined;
  return (
    data.revenueCategories.find((c) => c.id === id)?.name ??
    data.expenseCategories.find((c) => c.id === id)?.name
  );
}

export function horseTicket(data: StableData, horseId: string, period: Period): HorseTicket {
  const lines: TicketLine[] = [];
  for (const r of data.revenues) {
    if (r.horseId !== horseId || !dateInPeriod(r.date, period)) continue;
    lines.push({
      key: r.id,
      sourceId: r.id,
      date: r.date,
      label: r.note || catName(data, r.categoryId) || "Recette",
      amount: r.amount,
      kind: "in",
    });
  }
  for (const rec of recurringRevenuesDue(data, horseId, period)) {
    lines.push({ key: rec.id, label: rec.label || catName(data, rec.categoryId) || "Recette", amount: rec.amount, kind: "in" });
  }
  for (const e of data.directExpenses) {
    if (e.horseId !== horseId || !dateInPeriod(e.date, period)) continue;
    lines.push({ key: e.id, sourceId: e.id, date: e.date, label: e.label, amount: -e.amount, kind: "out" });
  }
  for (const rec of recurringDirectDue(data, horseId, period)) {
    lines.push({ key: rec.id, label: rec.label, amount: -rec.amount, kind: "out" });
  }
  const share = horseSharedCosts(data, horseId, period);
  if (share > 0) lines.push({ key: "share", label: "Sa part des frais", amount: -share, kind: "share" });

  // Ce qui rentre d'abord (pension en tête), puis ce qui sort, la part en dernier.
  lines.sort((a, b) => {
    const order = { in: 0, out: 1, share: 2 } as const;
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    if (a.kind === "in") return /pension/i.test(a.label) ? -1 : /pension/i.test(b.label) ? 1 : 0;
    return (a.date ?? "").localeCompare(b.date ?? "");
  });

  const p = horsePnl(data, horseId, period);
  return { horseId, lines, revenue: p.revenue, direct: p.directCosts, share: p.sharedCosts, net: p.netResult };
}

/**
 * Comment se dit la part des frais communs d'un cheval pour un mois, avec
 * le même diviseur partout (fiche, frais communs, Chevaux) : les chevaux qui
 * comptaient ce mois-là, pas ceux d'aujourd'hui. « ÷ 9 » quand sa part est
 * la part égale ; sinon au prorata de ses jours (arrivé ou parti en cours de
 * mois, réparti selon les jours), ou telle que fixée à la saisie.
 */
export function partEnMots(data: StableData, horseId: string, period: Period): string {
  const presents = chevauxPresents(data, period);
  const n = presents.length;
  const mine = horseSharedCosts(data, horseId, period);
  const total = presents.reduce((t, h) => t + horseSharedCosts(data, h.id, period), 0);
  const h = data.horses.find((x) => x.id === horseId);
  const jours = h ? presenceDays(h, period) : 0;
  const plein = jours >= daysInMonth(period);
  if (n > 0 && presents.some((x) => x.id === horseId) && Math.abs(mine - total / n) < 0.5) {
    if (plein || !h) return `÷ ${n}`;
    // Arrivé ou parti en cours de mois : une part entière, comme un mois plein (sa pension aussi est entière).
    const s = sejourDuMois(h, period);
    const ms = periodStart(period);
    const me = periodEnd(period);
    const j = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const f = s ? finCompte(s) : null;
    const quand = s && debutCompte(s) > ms ? `arrivé le ${j(debutCompte(s))}` : f && f < me ? `parti le ${j(f)}` : "";
    return quand ? `÷ ${n} : une part entière, même ${quand}` : `÷ ${n}`;
  }
  if (h && !plein) return `au prorata de ses ${jours} jour${jours > 1 ? "s" : ""} ici`;
  return "sa part, fixée à la saisie";
}

/**
 * Les résultats par cheval arrondis à l'euro, de sorte que leur somme tombe
 * exactement sur le résultat de l'écurie (méthode du plus fort reste) : un
 * gérant qui additionne les tickets retrouve le chiffre du mois.
 */
export function reconciledNets(data: StableData, period: Period): Record<string, number> {
  const s = stablePnl(data, period);
  // Les tickets se réconcilient avec ce que laissent les chevaux, sans l'argent hors chevaux.
  const target = Math.round(s.horsesNet);
  const fl = s.perHorse.map((p) => ({ id: p.horseId, f: Math.floor(p.netResult), r: p.netResult - Math.floor(p.netResult) }));
  let left = target - fl.reduce((t, x) => t + x.f, 0);
  [...fl].sort((a, b) => b.r - a.r).forEach((x) => {
    if (left > 0) {
      x.f += 1;
      left -= 1;
    }
  });
  return Object.fromEntries(fl.map((x) => [x.id, x.f]));
}

export interface MonthLine {
  label: string;
  amount: number;
}

export interface MonthBreakdown {
  ins: MonthLine[];
  shared: MonthLine[];
  /** Les dépenses qui ne concernent aucun cheval (tracteur, matériel…). */
  outs: MonthLine[];
  /** Tout ce qui rentre, chevaux et hors chevaux. */
  revenue: number;
  /** Les soins et frais des chevaux (sans les dépenses hors chevaux). */
  direct: number;
  /** Ce qui sort sans concerner aucun cheval. */
  outside: number;
  sharedTotal: number;
  net: number;
  horseCount: number;
  /** Les pensions du mois : les chevaux du mois, sans ceux du gérant. */
  pensions: number;
  /** Les chevaux du gérant ce mois (« À moi ») : une place, pas de pension. */
  miens: number;
  /** Ce que les pensions doivent payer : les frais de l'écurie et ce que coûtent les chevaux du gérant. */
  aCouvrir: number;
  /** Ce que laisse une pension en moyenne, une fois ses soins payés. */
  contribution: number;
  /** Le nombre de pensions qui paient tout (Infinity si une pension ne laisse rien). */
  seuil: number;
}

/** Un cheval du gérant : la formule « À moi » (components/bs/parcours, A_MOI). */
export const estAuGerant = (h: { pensionType?: string }) => h.pensionType === "À moi";

/**
 * Le seuil face aux places : combien de places peuvent recevoir une pension
 * (les places moins les chevaux du gérant), et ce qui manque encore par mois
 * quand le seuil dépasse ces places, même toutes pleines. Sans nombre de
 * places connu, le seuil n'est pas borné.
 */
export function seuilEtPlaces(m: Pick<MonthBreakdown, "seuil" | "miens" | "aCouvrir" | "contribution">, capacity: number): { placesPensions: number | null; atteignable: boolean; manque: number } {
  if (!isFinite(m.seuil)) return { placesPensions: capacity > 0 ? Math.max(0, capacity - m.miens) : null, atteignable: false, manque: 0 };
  if (!(capacity > 0)) return { placesPensions: null, atteignable: true, manque: 0 };
  const placesPensions = Math.max(0, capacity - m.miens);
  const besoin = Math.ceil(m.seuil - 1e-9);
  if (besoin <= placesPensions) return { placesPensions, atteignable: true, manque: 0 };
  return { placesPensions, atteignable: false, manque: Math.max(0, Math.round(m.aCouvrir - placesPensions * m.contribution)) };
}

export function monthBreakdown(data: StableData, period: Period): MonthBreakdown {
  const s = stablePnl(data, period);
  // Les chevaux de ce mois-là (un cheval parti garde son passé).
  const active = new Set(chevauxDuMois(data, period).map((h) => h.id));

  const insMap = new Map<string, number>();
  const addIn = (label: string, a: number) => insMap.set(label, (insMap.get(label) ?? 0) + a);
  for (const r of data.revenues) {
    if (!active.has(r.horseId) || !dateInPeriod(r.date, period)) continue;
    addIn(catName(data, r.categoryId) ?? "Autres recettes", r.amount);
  }
  // Les récurrentes des chevaux du mois (pension en modèle), seulement s'ils sont encore là.
  for (const hid of active)
    for (const rec of recurringRevenuesDue(data, hid, period)) addIn(catName(data, rec.categoryId) ?? rec.label ?? "Autres recettes", rec.amount);
  // L'argent qui rentre sans concerner aucun cheval (PAC, subvention…), sous son nom.
  for (const r of data.revenues) {
    if (!isOutside(r) || !dateInPeriod(r.date, period)) continue;
    addIn(r.note || catName(data, r.categoryId) || "Hors chevaux", r.amount);
  }
  const outMap = new Map<string, number>();
  for (const e of data.directExpenses) {
    if (!isOutside(e) || !dateInPeriod(e.date, period)) continue;
    const label = e.label || catName(data, e.categoryId) || "Hors chevaux";
    outMap.set(label, (outMap.get(label) ?? 0) + e.amount);
  }

  // Les factures communes, à hauteur de ce qui est réparti sur les chevaux présents.
  const shMap = new Map<string, number>();
  const addSh = (label: string, a: number) => shMap.set(label, (shMap.get(label) ?? 0) + a);
  for (const se of data.sharedExpenses) {
    if (se.periodYear !== period.year || se.periodMonth !== period.month) continue;
    const parts = repartition(data, se);
    // Sans aucun cheval ce mois-là, la facture compte quand même, en entier.
    const a = parts.length ? parts.filter((x) => active.has(x.horseId)).reduce((t, x) => t + x.allocatedAmount, 0) : se.totalAmount;
    if (a > 0) addSh(se.label, a);
  }
  // Les charges récurrentes partagées (assurance, crédit…), sous leur nom, avec ou sans cheval.
  const du = montantsDuMois(data, period);
  for (const r of recurringList(data)) {
    const a = du.get(r.id) ?? r.amount;
    if (r.isShared && recurringDue(r, period) && a > 0) addSh(r.label, a);
  }
  const listed = [...shMap.values()].reduce((t, a) => t + a, 0);
  const rest = Math.round((s.sharedCosts - listed) * 100) / 100;
  if (rest > 0.5) addSh("Autres frais de l’écurie", rest);

  // Le seuil se compte en pensions, pas en chevaux : les chevaux du gérant
  // (« À moi ») prennent une place et leur part, sans payer de pension. Ce
  // que laisse une pension en moyenne, une fois ses soins payés, doit couvrir
  // les frais de l'écurie et ce que coûtent les chevaux du gérant.
  const miens = new Set(data.horses.filter(estAuGerant).map((h) => h.id));
  const pensionsDuMois = s.perHorse.filter((p) => !miens.has(p.horseId));
  const lesMiens = s.perHorse.filter((p) => miens.has(p.horseId));
  const pensions = pensionsDuMois.length;
  const contribution = pensions ? pensionsDuMois.reduce((t, p) => t + p.revenue - p.directCosts, 0) / pensions : 0;
  const aCouvrir = Math.round((s.sharedCosts + lesMiens.reduce((t, p) => t + p.directCosts - p.revenue, 0)) * 100) / 100;
  const seuil = contribution > 0 ? aCouvrir / contribution : Infinity;

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);

  return {
    ins: sortDesc(insMap),
    shared: sortDesc(shMap),
    outs: sortDesc(outMap),
    revenue: s.revenue,
    direct: s.horsesDirectCosts,
    outside: s.outsideCosts,
    sharedTotal: s.sharedCosts,
    net: s.netResult,
    horseCount: s.horseCount,
    pensions,
    miens: lesMiens.length,
    aCouvrir,
    contribution,
    seuil,
  };
}
