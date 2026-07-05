import type { ISODate } from "@/lib/domain/types";

/**
 * Le carnet de vie du cheval : soins, santé, sport, documents. Chaque
 * événement daté nourrit le moteur d'anticipation — vaccins, vermifuges,
 * ferrures, dentiste, ostéo sont replanifiés automatiquement à partir du
 * dernier acte, sans intervention de l'utilisateur (esprit Flighty).
 * Domaine pur, testé, zéro framework.
 */
export type CareKind =
  | "vaccin"
  | "vermifuge"
  | "ferrure"
  | "dentiste"
  | "osteo"
  | "veto"
  | "soin"
  | "entrainement"
  | "concours"
  | "document";

export interface CareEvent {
  id: string;
  stableId: string;
  horseId: string;
  kind: CareKind;
  /** Détail libre : « Rappel grippe », « Ferrure 4 pieds »… */
  label?: string;
  date: ISODate;
  /** Le prestataire (vétérinaire, maréchal…) : le lien vers les personnes. */
  provider?: string;
  /** Coût de l'acte. Quand il est saisi, une dépense directe liée existe. */
  cost?: number;
  /** L'identifiant de la dépense liée : le graphe, pas des silos. */
  expenseId?: string;
  note?: string;
}

/** Métadonnées par type d'acte : libellé et cadence de replanification. */
export const CARE_META: Record<
  CareKind,
  { label: string; cadenceDays: number | null }
> = {
  vaccin: { label: "Vaccin", cadenceDays: 365 },
  vermifuge: { label: "Vermifuge", cadenceDays: 90 },
  ferrure: { label: "Ferrure", cadenceDays: 49 },
  dentiste: { label: "Dentiste", cadenceDays: 365 },
  osteo: { label: "Ostéopathe", cadenceDays: 365 },
  veto: { label: "Vétérinaire", cadenceDays: null },
  soin: { label: "Soin", cadenceDays: null },
  entrainement: { label: "Entraînement", cadenceDays: null },
  concours: { label: "Concours", cadenceDays: null },
  document: { label: "Document", cadenceDays: null },
};

export const CARE_KINDS = Object.keys(CARE_META) as CareKind[];

export interface Deadline {
  horseId: string;
  kind: CareKind;
  /** Le dernier acte connu de ce type. */
  lastDate: ISODate;
  /** L'échéance calculée : dernier acte + cadence. */
  dueDate: ISODate;
  /** Jours restants (négatif = en retard). */
  daysLeft: number;
  status: "overdue" | "soon" | "ok";
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromIso: ISODate, toIso: ISODate): number {
  const a = Date.UTC(
    Number(fromIso.slice(0, 4)),
    Number(fromIso.slice(5, 7)) - 1,
    Number(fromIso.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(toIso.slice(0, 4)),
    Number(toIso.slice(5, 7)) - 1,
    Number(toIso.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}

/** Le seuil « bientôt » : sous 14 jours, on prévient. */
const SOON_DAYS = 14;

/**
 * Les échéances anticipées de toute l'écurie. Pour chaque cheval actif et
 * chaque type d'acte à cadence, on part du DERNIER acte enregistré et on
 * projette la prochaine échéance. Pas d'historique = pas d'échéance : le
 * suivi démarre au premier acte noté. Triées par urgence.
 */
export function upcomingDeadlines(
  data: { horses: { id: string; isArchived: boolean }[]; careEvents?: CareEvent[] },
  today: ISODate,
): Deadline[] {
  const events = data.careEvents ?? [];
  const out: Deadline[] = [];
  for (const horse of data.horses) {
    if (horse.isArchived) continue;
    for (const kind of CARE_KINDS) {
      const cadence = CARE_META[kind].cadenceDays;
      if (!cadence) continue;
      let last: ISODate | null = null;
      for (const e of events) {
        if (e.horseId !== horse.id || e.kind !== kind) continue;
        if (last === null || e.date > last) last = e.date;
      }
      if (!last) continue;
      const dueDate = addDays(last, cadence);
      const daysLeft = diffDays(today, dueDate);
      out.push({
        horseId: horse.id,
        kind,
        lastDate: last,
        dueDate,
        daysLeft,
        status: daysLeft < 0 ? "overdue" : daysLeft <= SOON_DAYS ? "soon" : "ok",
      });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Le carnet d'un cheval, du plus récent au plus ancien. */
export function horseCareLog(
  data: { careEvents?: CareEvent[] },
  horseId: string,
): CareEvent[] {
  return (data.careEvents ?? [])
    .filter((e) => e.horseId === horseId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
