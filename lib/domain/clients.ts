import type { Period, PersonRole, StableData } from "@/lib/domain/types";
import { formule, nomEcurie, signature } from "@/lib/domain/politesse";
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

/** Le prénom : le premier mot du nom (« Hugo L. » → « Hugo »). */
export const prenomDe = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Prénoms féminins courants : pour accorder « Elle a payé ». La fiche ne
 * connaît pas le genre ; à défaut on dit « Il ».
 */
const FEMININS = new Set(
  (
    "emma lea léa lou nina ines inès claire sophie julie jade louise alice chloe chloé camille manon sarah sara clara " +
    "anna zoé zoe lina mila rose juliette charlotte lucie marie laura pauline mathilde margaux margot elsa eva ambre " +
    "agathe romane océane oceane anaïs anais mélanie melanie céline celine nathalie isabelle valérie valerie sandrine " +
    "stéphanie stephanie caroline aurélie aurelie émilie emilie élise elise héloïse heloise capucine apolline victoire " +
    "lola léna lena maëlle maelle maëlys maelys justine marion audrey cécile cecile hélène helene anne catherine christine " +
    "sylvie véronique veronique martine brigitte florence virginie delphine laetitia agnès agnes jeanne alix iris luna " +
    "olivia mia jeanne-marie sabrina vanessa elodie élodie amandine morgane coralie estelle gaëlle gaelle solène solene"
  ).split(/\s+/),
);
export function estElle(name: string): boolean {
  return FEMININS.has(prenomDe(name).toLowerCase());
}
/** « Il » ou « Elle » (et les autres formes) selon le prénom. */
export function accord<T>(name: string, il: T, elle: T): T {
  return estElle(name) ? elle : il;
}

const moisNom = (p: Period) => new Date(p.year, p.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" });

/** « aux Trois Pommiers », « au Clos », « à la Ferme », « à Mon écurie ». */
export function chezEcurie(stableName: string): string {
  const n = stableName.trim();
  if (/^les\s/i.test(n)) return `aux ${n.slice(4)}`;
  if (/^le\s/i.test(n)) return `au ${n.slice(3)}`;
  if (/^la\s/i.test(n)) return `à la ${n.slice(3)}`;
  if (/^l[’']/i.test(n)) return `à l’${n.slice(2)}`;
  return `à ${n}`;
}

const eur0 = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)).replace(/ /g, " ")} €`;

/**
 * Le message tout prêt « ce que tu me dois » : les pensions une à une, le
 * reste regroupé (« Cours de Tonnerre (5) : 125 € »), ce qui est déjà payé,
 * le reste à payer. Ce qui a été payé sur place n'y figure pas. Tu ou
 * vous selon le choix fait dans Tes factures (vous par défaut), signé du
 * gérant et de l'écurie.
 */
export function messageDu(bill: Bill, period: Period, stableName: string, gerant: string, tu?: boolean): string {
  const f = formule(tu);
  const qui = prenomDe(bill.payer);
  const lines = bill.lines.filter((l) => !l.onSite);
  const fixes = lines.filter((l) => /pension/i.test(l.label));
  const grp = new Map<string, { n: number; v: number }>();
  for (const l of lines) {
    if (fixes.includes(l)) continue;
    const g = grp.get(l.label) ?? { n: 0, v: 0 };
    g.n++;
    g.v += l.amount;
    grp.set(l.label, g);
  }
  const onSite = bill.lines.filter((l) => l.onSite).reduce((t, l) => t + l.amount, 0);
  const deja = r2(bill.paid - onSite);
  const out = [
    `Bonjour ${qui},`,
    `Voici ce que ${f.doit} pour ${moisNom(period)} ${chezEcurie(stableName)} :`,
    ...fixes.map((l) => `${l.label} : ${eur0(l.amount)}`),
    ...[...grp.entries()].map(([t, g]) => `${t}${g.n > 1 ? ` (${g.n})` : ""} : ${eur0(g.v)}`),
  ];
  if (deja > 0) out.push(`Déjà payé : ${eur0(deja)}`);
  out.push(`Reste à payer : ${eur0(bill.due)}.`);
  out.push(...signature(gerant, nomEcurie(stableName)));
  return out.join("\n");
}

/** « de septembre », « d’août », « de décembre 2025 » quand ce n'est pas l'année de `period`. */
/**
 * Les impayés des mois d'avant, en mots : « dont 120 € de septembre » quand le
 * mois en cours doit aussi quelque chose, « 120 € de septembre » quand tout
 * vient d'avant (pas de « te doit 120 €, dont 120 € »). eur : le format des montants.
 */
export function anciensEnMots(c: Pick<ClientDue, "anciens" | "dueMois">, period: Period, eur: (n: number) => string): string {
  const mots = c.anciens.map((a) => `${eur(a.due)} ${duMois(a.month, period)}`);
  if (!mots.length) return "";
  return c.dueMois > 0 ? mots.map((m) => `dont ${m}`).join(" · ") : mots.join(" · ");
}

export function duMois(month: string, period: Period): string {
  const p = { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
  const nom = `${moisNom(p)}${p.year !== period.year ? ` ${p.year}` : ""}`;
  return /^[aeiouyàâäéèêëîïôöûüù]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}
