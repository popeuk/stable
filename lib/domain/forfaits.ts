import type { Abonnement, ISODate, Participant, Person, Prestation, Revenue, Seance } from "@/lib/domain/types";
import { moisEntre } from "@/lib/domain/autopilot";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Les forfaits : un cavalier paie un cours au mois ou à l'année plutôt qu'à
 * la séance. Le forfait est un CONTRAT (l'abonnement), comme la pension d'un
 * cheval : ses échéances sont postées toutes seules, mois par mois, payées
 * par le cavalier ; ses présences à ce cours ne comptent plus rien en plus.
 * Une formule changée vaut à partir du mois en cours : le passé ne bouge pas.
 * Domaine pur.
 */

/** La saison par défaut : dix mois, de septembre à juin. */
export const SAISON_MOIS = 10;
/** En combien de fois se paie une année : une, trois, ou chaque mois de la saison. */
export const FOIS_ANNEE = [1, 3, SAISON_MOIS] as const;

/** AAAA-MM décalé de n mois. */
export function moisPlus(mk: string, n: number): string {
  const y = Number(mk.slice(0, 4));
  const m = Number(mk.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

/** Le dernier mois couvert, ou null pour un forfait au mois sans fin. */
export function finAbonnement(a: Abonnement): string | null {
  if (a.kind === "annee") {
    const fin = moisPlus(a.debut, Math.max(1, a.mois ?? SAISON_MOIS) - 1);
    return a.fin && a.fin < fin ? a.fin : fin;
  }
  return a.fin ?? null;
}

/** Le forfait couvre-t-il ce mois (AAAA-MM) ? */
export function couvreMois(a: Abonnement, mk: string): boolean {
  const fin = finAbonnement(a);
  return a.debut <= mk && (fin === null || mk <= fin);
}

/** Le forfait de ce cavalier pour ce cours, à cette date, s'il y en a un. */
export function forfaitDe(abonnements: Abonnement[] | undefined, personId: string, prestationId: string, date: ISODate): Abonnement | undefined {
  const mk = date.slice(0, 7);
  return (abonnements ?? []).find((a) => a.personId === personId && a.prestationId === prestationId && couvreMois(a, mk));
}

/**
 * Les échéances d'un forfait : chaque mois pour un forfait au mois ; pour
 * une année, le prix de la saison en `fois` paiements répartis sur ses mois
 * (le reste des centimes sur la dernière). Rend [mois, montant, rang].
 */
export function echeances(a: Abonnement, jusqua: string): [string, number, number][] {
  if (a.kind === "mois") {
    const out: [string, number, number][] = [];
    const fin = finAbonnement(a);
    for (let k = a.debut, i = 0; k <= jusqua && (fin === null || k <= fin) && i < 600; k = moisPlus(k, 1), i++) out.push([k, a.amount, i + 1]);
    return out;
  }
  const n = Math.max(1, a.mois ?? SAISON_MOIS);
  const f = Math.max(1, Math.min(n, a.fois ?? n));
  const part = Math.floor((a.amount / f) * 100) / 100;
  const fin = finAbonnement(a);
  const out: [string, number, number][] = [];
  for (let i = 0; i < f; i++) {
    const k = moisPlus(a.debut, Math.floor((i * n) / f));
    if (k > jusqua || (fin !== null && k > fin)) break;
    const montant = i === f - 1 ? r2((a.amount - part * (f - 1))) : part;
    out.push([k, montant, i + 1]);
  }
  return out;
}

/** Le nom d'un cours, comme dans Mes prix : le cours d'équitation à formats se dit « Cours collectif ». */
export const nomCours = (p: Pick<Prestation, "label" | "hasFormat">) => (p.hasFormat ? "Cours collectif" : p.label);

/** L'identifiant déterministe d'une échéance : l'idempotence, comme les pensions. */
export const forfaitRevenueId = (abId: string, mk: string) => `rev-forfait-${abId}-${mk}`;

/** Le nom d'un forfait sur la note : « Cours collectif, forfait annuel (2/3) ». */
export function libelleForfait(a: Abonnement, label: string, rang: number): string {
  if (a.kind === "mois") return `${label}, forfait au mois`;
  const f = Math.max(1, Math.min(a.mois ?? SAISON_MOIS, a.fois ?? a.mois ?? SAISON_MOIS));
  return f > 1 ? `${label}, forfait annuel (${rang}/${f})` : `${label}, forfait annuel`;
}

/**
 * Les échéances de forfait manquantes, du mois `depuis` jusqu'au mois en
 * cours : postées une fois, payées par le cavalier, rangées hors des chevaux.
 * Une ligne retirée à la main (dismissed) ne revient pas.
 */
export function ensureForfaits(
  data: {
    abonnements?: Abonnement[];
    people?: Person[];
    prestations?: Prestation[];
    revenues: Revenue[];
    revenueCategories: { id: string; name: string }[];
  },
  today: ISODate,
  stableId: string,
  dismissed: string[] = [],
  depuis?: string,
): Revenue[] {
  const mois = new Set(moisEntre(depuis, today.slice(0, 7)));
  const jusqua = today.slice(0, 7);
  const deja = new Set(data.revenues.map((r) => r.id));
  const skip = new Set(dismissed);
  const cat = data.revenueCategories.find((c) => c.name === "Cours")?.id;
  const out: Revenue[] = [];
  for (const a of data.abonnements ?? []) {
    const person = data.people?.find((p) => p.id === a.personId);
    if (!person) continue;
    const prest = data.prestations?.find((p) => p.id === a.prestationId);
    const label = prest ? nomCours(prest) : "Cours";
    for (const [mk, montant, rang] of echeances(a, jusqua)) {
      if (!mois.has(mk)) continue;
      const rid = forfaitRevenueId(a.id, mk);
      if (deja.has(rid) || skip.has(rid) || montant <= 0) continue;
      out.push({
        id: rid,
        stableId,
        horseId: "",
        categoryId: cat,
        amount: montant,
        date: `${mk}-01`,
        note: libelleForfait(a, label, rang),
        source: "recurring",
        payer: person.name,
        abonnementId: a.id,
      });
    }
  }
  return out;
}

/** Marque les cavaliers au forfait d'une séance : leur présence ne se paie pas en plus. */
export function marquerForfaits(s: Seance, abonnements: Abonnement[] | undefined): Seance {
  let change = false;
  const participants: Participant[] = s.participants.map((p) => {
    const f = !!forfaitDe(abonnements, p.personId, s.prestationId, s.date);
    if (f === !!p.forfait) return p;
    change = true;
    const { forfait: _f, ...rest } = p;
    void _f;
    return f ? { ...rest, forfait: true } : rest;
  });
  return change ? { ...s, participants } : s;
}
