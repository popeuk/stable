import type { Period } from "@/lib/domain/types";
import { appel, formule, nomEcurie, salut, signature } from "@/lib/domain/politesse";
import type { Bill } from "@/lib/domain/billing";
import { r2 } from "@/lib/utils/arrondi";
import { BUCKET_LABEL, clientRevenues, impayesAnciens, clientDues, dusDuClient, type ClientBucket, type ClientRevenue, type ClientDue } from "@/lib/domain/clients-dus";

/* Les dus de chaque client sont dans clients-dus.ts (l'accueil s'en sert sans les messages) ; ici, redonnés avec les mots. */
export { BUCKET_LABEL, clientRevenues, impayesAnciens, clientDues, dusDuClient };
export type { ClientBucket, ClientRevenue, ClientDue };

/** Le prénom : le premier mot du nom (« Hugo L. » → « Hugo »). */
export const prenomDe = (name: string) => appel(name);

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

/** Un montant pour un message : au centime, sans « ,00 » quand il tombe rond (« 125 € », « 307,40 € »). */
const eur0 = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: Number.isInteger(r2(n)) ? 0 : 2, maximumFractionDigits: 2 }).format(r2(n)).replace(/[\u202f\u00a0]/g, "\u00a0")}\u00a0€`;

/**
 * Le message tout prêt « ce que tu me dois » : les pensions une à une, le
 * reste regroupé (« Cours de Tonnerre (5) : 125 € »), ce qui est déjà payé,
 * le reste à payer. Ce qui a été payé sur place n'y figure pas. Tu ou
 * vous selon le choix fait dans Tes factures (vous par défaut), signé du
 * gérant et de l'écurie.
 */
export function messageDu(bill: Bill, period: Period, stableName: string, gerant: string, tu?: boolean): string {
  const f = formule(tu);
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
    salut(bill.payer),
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
