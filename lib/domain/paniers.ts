import type { ISODate, PersonRole, StableData } from "@/lib/domain/types";
import { CARE_META } from "@/lib/domain/care";
import { revenuesForSeance, toValidate } from "@/lib/domain/seances";

/**
 * Les paniers : ce qui a eu lieu et attend sa validation, rangé par client.
 * Le client d'une ligne suit la règle de la facturation (billsFor) : le
 * payeur noté, à défaut le propriétaire du cheval. Seul ce qui rapporte à un
 * client entre dans un panier ; un soin qui ne fait que coûter reste dans la
 * journée et dans /valider. Domaine pur, zéro framework.
 */

/** Ce que les paniers lisent : l'état du store (StableData) convient tel quel. */
export type DataState = Pick<StableData, "horses" | "revenueCategories" | "people" | "seances" | "careEvents"> & Partial<StableData>;

export interface LignePanier {
  /** Unique dans tous les paniers : `${itemKey}|${client}`. */
  key: string;
  /** La clé de l'élément de la journée (id de séance ou groupe de soins). */
  itemKey: string;
  type: "seance" | "soin";
  label: string;
  /** « mardi 10:00 », « 12 oct. · Ferrure 4 pieds »… */
  sub: string;
  date: ISODate;
  horseId?: string;
  amount: number;
  /** Une séance à plusieurs cavaliers : elle se confirme avec la présence. */
  collective: boolean;
  seanceId?: string;
  careIds?: string[];
}

export interface Panier {
  client: string;
  role: "proprietaire" | "cavalier";
  /** Les noms des chevaux concernés, dans l'ordre des lignes. */
  horses: string[];
  lignes: LignePanier[];
  total: number;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const day = (d: ISODate) => new Date(`${d}T12:00:00Z`);

/** « mardi » dans la semaine écoulée, « 12 oct. » au-delà. */
export function quand(date: ISODate, today: ISODate, start?: string): string {
  const diff = Math.round((day(today).getTime() - day(date).getTime()) / 864e5);
  const d = day(date);
  const j = diff >= 0 && diff < 7 ? JOURS[d.getUTCDay()] : `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
  return start ? `${j} ${start}` : j;
}

/** « Cours de Sirius », « Cours d’Éclair ». */
export function deCheval(what: string, horse?: string): string {
  if (!horse || what.toLowerCase().includes(horse.toLowerCase())) return what;
  return /^[aeiouyhàâéèêëîïôöùûü]/i.test(horse) ? `${what} d’${horse}` : `${what} de ${horse}`;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Les paniers à valider, groupés par client, du plus gros au plus petit. */
export function paniers(data: DataState, today: ISODate, nowHHMM: string): Panier[] {
  const items = toValidate({ ...data, tasks: [] } as unknown as StableData, today, nowHHMM);
  const horse = (id?: string) => data.horses.find((h) => h.id === id);
  const owners = new Set(data.horses.map((h) => h.ownerName).filter(Boolean) as string[]);
  const roleOf = (client: string): PersonRole => data.people?.find((p) => p.name === client)?.role ?? (owners.has(client) ? "proprietaire" : "cavalier");
  const clientOf = (payer: string | undefined, horseId?: string) => payer ?? horse(horseId)?.ownerName ?? "Sans propriétaire";

  const map = new Map<string, Panier>();
  const order = new Map<string, string>();
  const push = (client: string, l: Omit<LignePanier, "key">, start?: string) => {
    if (l.amount <= 0) return;
    const p = map.get(client) ?? { client, role: roleOf(client), horses: [], lignes: [], total: 0 };
    const key = `${l.itemKey}|${client}`;
    order.set(key, `${l.date} ${start ?? "99:99"}`);
    p.lignes.push({ ...l, key });
    map.set(client, p);
  };

  for (const it of items) {
    if (it.seance) {
      const s = it.seance;
      const collective = s.participants.length > 1;
      let n = 0;
      const revs = revenuesForSeance({ ...s, status: "done" }, data, () => `p${n++}`, "");
      const byClient = new Map<string, { amount: number; horseId?: string }>();
      for (const r of revs) {
        const c = clientOf(r.payer, r.horseId);
        const cur = byClient.get(c) ?? { amount: 0, horseId: r.horseId };
        cur.amount += r.amount;
        byClient.set(c, cur);
      }
      for (const [client, v] of byClient) {
        const h = horse(v.horseId);
        const label = !collective && roleOf(client) === "proprietaire" ? deCheval(s.title, h?.name) : s.title;
        push(client, {
          itemKey: it.key,
          type: "seance",
          label,
          sub: [quand(s.date, today, s.start), collective ? "à plusieurs" : "", s.lieu].filter(Boolean).join(" · "),
          date: s.date,
          horseId: v.horseId,
          amount: round(v.amount),
          collective,
          seanceId: s.id,
        }, s.start);
      }
    } else if (it.care) {
      // Les soins refacturés seulement, rangés par propriétaire du cheval.
      const byClient = new Map<string, typeof it.care>();
      for (const e of it.care) {
        if (!e.pending || !(e.revenue && e.revenue > 0)) continue;
        const c = clientOf(undefined, e.horseId);
        byClient.set(c, [...(byClient.get(c) ?? []), e]);
      }
      for (const [client, evs] of byClient) {
        const e0 = evs[0];
        const names = [...new Set(evs.map((e) => horse(e.horseId)?.name).filter(Boolean) as string[])];
        push(client, {
          itemKey: it.key,
          type: "soin",
          label: deCheval(CARE_META[e0.kind].label, names.join(", ")),
          sub: [quand(e0.date, today, e0.start), e0.label].filter(Boolean).join(" · "),
          date: e0.date,
          horseId: e0.horseId,
          amount: round(evs.reduce((t, e) => t + (e.revenue ?? 0), 0)),
          collective: false,
          careIds: evs.map((e) => e.id),
        }, e0.start);
      }
    }
  }

  const out = [...map.values()];
  for (const p of out) {
    p.lignes.sort((a, b) => (order.get(a.key) ?? "").localeCompare(order.get(b.key) ?? ""));
    p.total = round(p.lignes.reduce((t, l) => t + l.amount, 0));
    const care = (id: string) => data.careEvents?.find((e) => e.id === id)?.horseId;
    const ids = p.lignes.flatMap((l) => (l.careIds ? l.careIds.map(care) : [l.horseId]));
    p.horses = [...new Set(ids.map((id) => horse(id)?.name).filter(Boolean) as string[])];
  }
  return out.sort((a, b) => b.total - a.total || a.client.localeCompare(b.client));
}

/** Le prénom pour s'adresser au client : « Léa » pour « Léa B. ». */
export const prenom = (client: string) => client.trim().split(/\s+/)[0] || client;

/** Ce qu'un validé fait : les lignes simples comptent, les collectives attendent la présence. */
export const lignesSimples = (p: Panier) => p.lignes.filter((l) => !l.collective);

/** Le message tout prêt pour le client : le détail, le total, la signature. */
export function messagePanier(client: string, lignes: Pick<LignePanier, "label" | "sub" | "amount">[], signature: string): string {
  const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n).replace(/ /g, " ")} €`;
  const total = lignes.reduce((t, l) => t + l.amount, 0);
  return [
    `Bonjour ${prenom(client)},`,
    "voici ce qui a eu lieu ces derniers jours :",
    ...lignes.map((l) => `${l.label}, ${l.sub} : ${fmt(l.amount)}`),
    `Total : ${fmt(total)}.`,
    signature,
  ]
    .filter(Boolean)
    .join("\n");
}
