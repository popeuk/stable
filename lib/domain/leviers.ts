import type { ActionState, Period, StableData } from "@/lib/domain/types";
import { horseTicket, monthBreakdown } from "@/lib/domain/ticket";
import { dateInPeriod } from "@/lib/utils/period";
import { annuleSurCheval } from "@/lib/domain/billing";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Les leviers de rentabilité : remplir, facturer juste, dépenser mieux.
 * Chaque proposition est calculée sur les chiffres de l'écurie, avec un
 * gain chiffré et, quand c'est possible, une application en un geste.
 * Domaine pur.
 */
export type Lever = "remplir" | "facturer" | "prix" | "depenser";

export type Apply =
  | { type: "rebill"; expenseId: string }
  | { type: "pension"; horseId: string; amount: number }
  | { type: "publish" }
  | { type: "none" };

export interface Suggestion {
  id: string;
  lever: Lever;
  title: string;
  sub: string;
  /** Gain estimé (€). */
  gain: number;
  unit: "par mois" | "une fois" | "estimé";
  apply: Apply;
  status: ActionState["status"];
  measured?: number;
}

/** « 450 », « 450,50 », « 1 200 » : un montant dit à la française. */
const montantFr = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n).replace(/\u202f/g, "\u00a0");

/** Les postes qui ne se négocient pas avec deux devis : salaires, cotisations sociales, emprunts, impôts. */
export const NON_NEGOCIABLE = /personnel|salari|salaire|paie\b|msa|urssaf|cotisation|emprunt|pr[êe]t\b|cr[ée]dit|remboursement|imp[ôo]t|taxe/i;

const SOINS_REFACTURABLES = /orthop|ost[eé]o|compl[eé]ment|dentiste|parage/i;

/** « les compléments », « l’ostéo », « le parage », « la ferrure orthopédique » : un libellé avec son article. */
export function avecArticle(label: string): string {
  const l = label.trim().toLowerCase();
  const premier = l.split(/\s+/)[0] ?? l;
  if (/[sx]$/.test(premier)) return `les ${l}`;
  if (/^[aeiouyéèêh]/.test(l)) return `l’${l}`;
  if (/(age|iste|isme|ment|é)$/.test(premier)) return `le ${l}`;
  if (/e$/.test(premier)) return `la ${l}`;
  return `le ${l}`;
}

export function suggestions(data: StableData, period: Period, capacity: number): Suggestion[] {
  const out: (Omit<Suggestion, "status" | "measured"> & { forced?: ActionState["status"] })[] = [];
  const horses = data.horses.filter((h) => !h.isArchived);
  const m = monthBreakdown(data, period);

  // Remplir : chaque box libre loué laisse en moyenne ce que laisse un cheval.
  // Sans nombre de boxes donné (0), aucune estimation : rien n'est promis sur une donnée inventée.
  const free = capacity > 0 ? Math.max(0, capacity - horses.length) : 0;
  if (free > 0 && m.contribution > 0) {
    out.push({
      id: "remplir-box",
      lever: "remplir",
      title: free > 1 ? `Trouver un cheval pour tes ${free} places libres` : "Trouver un cheval pour ta place libre",
      sub: free > 1 ? "Une place prise te rapporte autant que tes autres chevaux. Tu peux les annoncer sur mon-ecurie.fr, l’annuaire des pensions." : "Une place prise te rapporte autant que tes autres chevaux. Tu peux l’annoncer sur mon-ecurie.fr, l’annuaire des pensions.",
      gain: Math.round(m.contribution * free),
      unit: "par mois",
      apply: { type: "publish" },
    });
  }

  // Facturer juste : les soins payés par l'écurie qui se refacturent d'usage.
  for (const e of data.directExpenses) {
    if (!dateInPeriod(e.date, period) || !SOINS_REFACTURABLES.test(e.label)) continue;
    const h = data.horses.find((x) => x.id === e.horseId);
    // Sans propriétaire, personne à qui le faire payer : pas de piste.
    if (!h || h.isArchived || !h.ownerName?.trim()) continue;
    out.push({
      id: `rebill-${e.id}`,
      lever: "facturer",
      title: `Faire payer ${avecArticle(e.label)} de ${h.name} à ${h.ownerName}`,
      sub: `Tu l’as payé, mais d’habitude c’est à ${h.ownerName} de le régler. Ajoute-le à sa facture.`,
      gain: e.amount,
      unit: "une fois",
      apply: { type: "rebill", expenseId: e.id },
      // Déjà refacturée : l'action est faite, et elle a rapporté son montant.
      forced: e.rebillRevenueId ? "faite" : undefined,
    });
  }

  // Revoir tes prix (à part de ce qu'on te doit) : un cheval qui te coûte
  // vraiment ce mois (son ticket est négatif, soins, cours et part comprises) :
  // la pension qui le remet à zéro. Un avoir est un geste ponctuel, pas un
  // cheval qui ne paie pas : la recette qu'il annule compte ici comme facturée.
  for (const h of horses) {
    if (!h.pension) continue;
    const t = horseTicket(data, h.id, period);
    const net = r2(t.net + annuleSurCheval(data, h.id, period));
    if (net >= 0) continue;
    const floor = Math.ceil((h.pension - net) / 10) * 10;
    if (h.pension < floor) {
      out.push({
        id: `pension-${h.id}`,
        lever: "prix",
        title: `${h.name} : passer la pension de ${montantFr(h.pension)} à ${montantFr(floor)} €`,
        sub: `Ce mois, une fois ses soins et sa part des frais de l’écurie payés, ${h.name} te coûte ${montantFr(Math.round(-net))} €. À ${montantFr(floor)} €, sa pension couvrirait ses frais.`,
        gain: floor - h.pension,
        unit: "par mois",
        apply: { type: "pension", horseId: h.id, amount: floor },
      });
    }
  }

  // Dépenser mieux : le premier poste commun qui se négocie, de 5 %. Ni les
  // salaires, ni les cotisations (MSA, URSSAF), ni un emprunt : ils ne se
  // négocient pas avec deux devis.
  const top = m.shared.filter((x) => !NON_NEGOCIABLE.test(x.label)).sort((a, b) => b.amount - a.amount)[0];
  if (top && top.amount > 200) {
    out.push({
      id: `depense-${top.label}`,
      lever: "depenser",
      title: `${top.label} : obtenir 5 % moins cher`,
      sub: `C’est ce qui pèse le plus dans les frais de l’écurie que tu peux négocier (${montantFr(Math.round(top.amount))} € ce mois-ci). Demande deux devis pour l’année et compare.`,
      gain: Math.round(top.amount * 0.05),
      unit: "estimé",
      apply: { type: "none" },
    });
  }

  const states = new Map((data.actions ?? []).map((a) => [a.id, a]));
  return out
    .map(({ forced, ...s }) => ({
      ...s,
      status: forced ?? states.get(s.id)?.status ?? "proposee",
      measured: forced === "faite" ? s.gain : states.get(s.id)?.measured,
    }))
    .filter((s) => s.status !== "ecartee");
}

/** Le potentiel d'un levier : la somme de ses actions pas encore faites. */
export function leverPotential(list: Suggestion[], lever: Lever): number {
  return list.filter((s) => s.lever === lever && s.status !== "faite").reduce((t, s) => t + s.gain, 0);
}
