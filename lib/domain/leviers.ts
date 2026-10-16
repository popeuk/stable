import type { ActionState, Period, StableData } from "@/lib/domain/types";
import { horseTicket, monthBreakdown } from "@/lib/domain/ticket";
import { dateInPeriod } from "@/lib/utils/period";

/**
 * Les leviers de rentabilité : remplir, facturer juste, dépenser mieux.
 * Chaque proposition est calculée sur les chiffres de l'écurie, avec un
 * gain chiffré et, quand c'est possible, une application en un geste.
 * Domaine pur.
 */
export type Lever = "remplir" | "facturer" | "depenser";

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

const SOINS_REFACTURABLES = /orthop|ost[eé]o|compl[eé]ment|dentiste|parage/i;

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
      title: free > 1 ? `Trouver un cheval pour tes ${free} boxes vides` : "Trouver un cheval pour ton box vide",
      sub: free > 1 ? "un box occupé te rapporte autant que tes autres chevaux. Tu peux les annoncer sur mon-ecurie.fr, l’annuaire des pensions." : "un box occupé te rapporte autant que tes autres chevaux. Tu peux l’annoncer sur mon-ecurie.fr, l’annuaire des pensions.",
      gain: Math.round(m.contribution * free),
      unit: "par mois",
      apply: { type: "publish" },
    });
  }

  // Facturer juste : les soins payés par l'écurie qui se refacturent d'usage.
  for (const e of data.directExpenses) {
    if (!dateInPeriod(e.date, period) || !SOINS_REFACTURABLES.test(e.label)) continue;
    const h = data.horses.find((x) => x.id === e.horseId);
    if (!h || h.isArchived) continue;
    out.push({
      id: `rebill-${e.id}`,
      lever: "facturer",
      title: `Faire payer « ${e.label.toLowerCase()} » de ${h.name}`,
      sub: `tu l’as payé, mais d’habitude c’est ${h.ownerName ? `à ${h.ownerName}` : "au propriétaire"} de le régler. Ajoute-le à sa facture.`,
      gain: e.amount,
      unit: "une fois",
      apply: { type: "rebill", expenseId: e.id },
      // Déjà refacturée : l'action est faite, et elle a rapporté son montant.
      forced: e.rebillRevenueId ? "faite" : undefined,
    });
  }

  // Facturer juste : un cheval qui te coûte vraiment ce mois (son ticket est
  // négatif, soins, cours et part comprises) : la pension qui le remet à zéro.
  // Un cheval dont le ticket est positif ne fait jamais perdre d'argent.
  for (const h of horses) {
    if (!h.pension) continue;
    const t = horseTicket(data, h.id, period);
    if (t.net >= 0) continue;
    const floor = Math.ceil((h.pension - t.net) / 10) * 10;
    if (h.pension < floor) {
      out.push({
        id: `pension-${h.id}`,
        lever: "facturer",
        title: `${h.name} : passer la pension de ${h.pension} à ${floor} €`,
        sub: `ce mois, une fois ses soins et sa part des frais communs payés, il te coûte ${Math.round(-t.net)} €. À ${floor} €, il ne te coûterait plus rien.`,
        gain: floor - h.pension,
        unit: "par mois",
        apply: { type: "pension", horseId: h.id, amount: floor },
      });
    }
  }

  // Dépenser mieux : le premier poste commun, négocié de 5 %.
  const top = m.shared[0];
  if (top && top.amount > 200) {
    out.push({
      id: `depense-${top.label}`,
      lever: "depenser",
      title: `${top.label} : obtenir 5 % moins cher`,
      sub: `c’est ta plus grosse dépense commune (${Math.round(top.amount)} € ce mois-ci). Demande deux devis pour l’année et compare.`,
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
