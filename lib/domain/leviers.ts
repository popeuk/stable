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
  const free = Math.max(0, capacity - horses.length);
  if (free > 0 && m.contribution > 0) {
    out.push({
      id: "remplir-box",
      lever: "remplir",
      title: free > 1 ? `Louer tes ${free} boxes libres` : "Louer ton box libre",
      sub: "les publier sur mon-ecurie.fr, l’annuaire des pensions",
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
      title: `Refacturer « ${e.label.toLowerCase()} » de ${h.name}`,
      sub: `à ${h.ownerName ?? "son propriétaire"}, payé par l’écurie`,
      gain: e.amount,
      unit: "une fois",
      apply: { type: "rebill", expenseId: e.id },
      // Déjà refacturée : l'action est faite, et elle a rapporté son montant.
      forced: e.rebillRevenueId ? "faite" : undefined,
    });
  }

  // Facturer juste : les pensions sous ce que coûte le cheval sans ses soins.
  for (const h of horses) {
    if (!h.pension) continue;
    const t = horseTicket(data, h.id, period);
    const floor = Math.ceil((t.share + 40) / 10) * 10; // part de l'écurie + 40 € de soins courants
    if (h.pension < floor) {
      out.push({
        id: `pension-${h.id}`,
        lever: "facturer",
        title: `${h.name} : pension ${h.pension} → ${floor} €`,
        sub: "elle ne couvre pas sa part de l’écurie et ses soins courants",
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
      title: `${top.label} : négocier 5 %`,
      sub: `ton premier poste, ${Math.round(top.amount)} € ce mois ; demander deux devis à l’année`,
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
