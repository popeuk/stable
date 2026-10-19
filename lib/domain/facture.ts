import type { BillingInfo, Invoice, InvoiceLine, InvoiceVat, Payment, Period, Person, Revenue, StableData, VatKind, VatRate } from "@/lib/domain/types";
import { billOf, billsFor, cleClient, monthKey, type Bill } from "@/lib/domain/billing";
import { enMoyen } from "@/lib/domain/paiement";
import { esc } from "@/lib/utils/esc";
import { appel, formule, pasUnPrenom, prenom, salut, signature } from "@/lib/domain/politesse";
import { r2 } from "@/lib/utils/arrondi";

/**
 * La facture d'un client pour un mois. Les prix saisis dans l'app sont ceux
 * que paie le client (TTC) : la facture en déduit le hors taxes, taux par
 * taux. L'app ne devine jamais le taux : tant qu'il n'est pas choisi, la
 * facture le demande. Une facture émise reçoit un numéro unique et
 * chronologique par année (2026-0001), jamais réutilisé, et son contenu est
 * figé. Domaine pur.
 */

export const KINDS: VatKind[] = ["pension", "cours", "soins", "autre"];
export const KIND_LABEL: Record<VatKind, string> = {
  pension: "Pension",
  cours: "Cours et séances",
  soins: "Soins refacturés",
  autre: "Autres prestations",
};
export const TAUX: VatRate[] = [5.5, 10, 20];

/** La mention imprimée en franchise de TVA. */
export const MENTION_FRANCHISE = "TVA non applicable, art. 293 B du CGI";

/** Le type de prestation d'une recette (même règle que les clients : pension, cours, soins, le reste). */
export function kindOf(r: Pick<Revenue, "rebillOf" | "seanceId" | "note" | "categoryId">, catName = ""): VatKind {
  if (r.rebillOf) return "soins";
  if (r.seanceId) return "cours";
  const quoi = `${catName} ${r.note ?? ""}`;
  if (/pension/i.test(quoi)) return "pension";
  if (/cours|s[ée]ance|monte|travail|coaching|balade|stage|le[cç]on/i.test(quoi)) return "cours";
  if (/refactur|soin|v[ée]t|mar[ée]chal|ferr|ost[ée]o|vermif|dent/i.test(quoi)) return "soins";
  return "autre";
}

/** Le hors taxes d'un prix TTC, au centime. */
export const horsTaxes = (ttc: number, rate: number) => r2(ttc / (1 + rate / 100));

/** Le SIRET : 14 chiffres, espaces ignorés. */
export const siretPropre = (s?: string) => (s ?? "").replace(/\s+/g, "");
export const siretValide = (s?: string) => /^\d{14}$/.test(siretPropre(s));
/** « 123 456 789 00012 ». */
export const siretDit = (s?: string) => {
  const d = siretPropre(s);
  return /^\d{14}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : (s ?? "").trim();
};

/** Le SIRET de l'écurie : le même pour les factures et le registre (saisi une seule fois). */
export const siretEcurie = (d: Pick<StableData, "billing" | "holding">) => siretPropre(d.billing?.siret) || siretPropre(d.holding?.siret);

/** Les infos de facturation, SIRET partagé avec le lieu de détention compris. */
export const facturation = (d: Pick<StableData, "billing" | "holding">): BillingInfo => ({ ...(d.billing ?? {}), siret: siretEcurie(d) || undefined });

/**
 * Le nom du vendeur imprimé en tête : pour un entrepreneur individuel, son
 * nom et son prénom ; pour une société (ou avant le choix du statut), sa
 * raison sociale. Jamais deviné (le nom de l'écurie ne le remplace pas).
 */
export const nomVendeur = (b: BillingInfo | undefined) => (b?.statut === "ei" ? (b.nomPrenom?.trim() ?? "") : (b?.legalName?.trim() ?? ""));

/** « RCS Angers 123 456 789 » : la ville du greffe et le SIREN (les 9 premiers chiffres du SIRET). R123-237 du Code de commerce. */
export function rcsDit(ville?: string, siret?: string): string {
  const v = (ville ?? "").replace(/^\s*R\.?\s*C\.?\s*S\.?\s*/i, "").replace(/[\d\s]+$/, "").trim();
  const d = siretPropre(siret);
  if (!v) return "";
  return /^\d{9}/.test(d) ? `RCS ${v} ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}` : `RCS ${v}`;
}

/** « FR 12 345678901 » écrit n'importe comment : sans espaces, en capitales. */
export const tvaIntraPropre = (s?: string) => (s ?? "").replace(/[\s.-]+/g, "").toUpperCase();
/** Un numéro de TVA intracommunautaire français : FR, deux caractères de clé, les 9 chiffres du SIREN. */
export const tvaIntraValide = (s?: string) => /^FR[0-9A-Z]{2}\d{9}$/.test(tvaIntraPropre(s));
/** Le numéro de TVA a-t-il le SIREN du SIRET ? (une faute de frappe se voit tout de suite) */
export const tvaIntraDuSiret = (tva?: string, siret?: string) => {
  const t = tvaIntraPropre(tva);
  const d = siretPropre(siret);
  return !tvaIntraValide(t) || !/^\d{14}$/.test(d) || t.slice(4) === d.slice(0, 9);
};
/** « FR 12 345678901 ». */
export const tvaIntraDit = (s?: string) => {
  const t = tvaIntraPropre(s);
  return tvaIntraValide(t) ? `${t.slice(0, 2)} ${t.slice(2, 4)} ${t.slice(4)}` : (s ?? "").trim();
};

/* ---------- Le statut du vendeur et son IBAN ---------- */

/** L'IBAN sans espaces, en capitales. */
export const ibanPropre = (s?: string) => (s ?? "").replace(/[\s.-]+/g, "").toUpperCase();

/**
 * La longueur de l'IBAN de chaque pays (registre ISO 13616 tenu par Swift) :
 * toute la zone SEPA, et les pays proches. Un IBAN de N26 (DE) ou de
 * Revolut (LT) est accepté comme un IBAN français.
 */
export const IBAN_LONGUEUR: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24,
  DE: 22, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29,
  RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22,
  VG: 24, XK: 20,
};
const PAYS_IBAN: Record<string, string> = {
  FR: "français", DE: "allemand", BE: "belge", ES: "espagnol", IT: "italien", NL: "néerlandais", LU: "luxembourgeois",
  LT: "lituanien", IE: "irlandais", PT: "portugais", CH: "suisse", MC: "monégasque", GB: "britannique", AT: "autrichien",
};

/** La clé de contrôle (ISO 7064, modulo 97) : les 4 premiers caractères passent à la fin, les lettres deviennent des nombres (A = 10). */
export function ibanCleOk(s?: string): boolean {
  const t = ibanPropre(s);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(t)) return false;
  const chiffres = (t.slice(4) + t.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let reste = 0;
  for (const c of chiffres) reste = (reste * 10 + Number(c)) % 97;
  return reste === 1;
}

/**
 * Ce qui ne va pas dans un IBAN, dit simplement, ou "" s'il est bon (ou
 * vide). Contrôle complet : le pays, la longueur de ce pays, et la clé.
 */
export function ibanErreur(s?: string): string {
  const t = ibanPropre(s);
  if (!t) return "";
  if (!/^[A-Z]{2}/.test(t)) return "Un IBAN commence par deux lettres, celles du pays : FR pour la France.";
  const pays = t.slice(0, 2);
  const n = IBAN_LONGUEUR[pays];
  if (!n) return `« ${pays} » n’est pas le début d’un IBAN : vérifie les deux premières lettres (FR pour la France).`;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]*$/.test(t)) return "Après les deux lettres du pays viennent deux chiffres, puis des chiffres et des lettres seulement.";
  if (t.length !== n) return `Un IBAN ${PAYS_IBAN[pays] ?? `qui commence par ${pays}`} a ${n} caractères : tu en as ${t.length}.`;
  if (!ibanCleOk(t)) return "Ce numéro ne passe pas le contrôle de la banque : il y a sans doute une faute de frappe. Relis-le sur ton RIB.";
  return "";
}

/** Un IBAN complet et juste : pays connu, bonne longueur, clé de contrôle bonne. */
export const ibanValide = (s?: string) => !!ibanPropre(s) && !ibanErreur(s);
/** « FR76 3000 6000 0112 3456 7890 189 » : par groupes de 4. */
export const ibanDit = (s?: string) => {
  const t = ibanPropre(s);
  return /^[A-Z0-9]+$/.test(t) ? (t.match(/.{1,4}/g) ?? []).join(" ") : (s ?? "").trim();
};
/**
 * La ligne du pied de facture. Elle lit l'IBAN figé dans la facture : une
 * facture déjà faite s'imprime comme elle est partie (une nouvelle facture
 * ne reçoit qu'un IBAN qui passe le contrôle, voir vendeurDe).
 */
export const mentionIban = (iban?: string) => (ibanPropre(iban) ? `Paiement par virement : IBAN ${ibanDit(iban)}` : "");

/** Le capital tel qu'imprimé : « 7 500 € » pour « 7500 », sinon tel que tapé. */
export function capitalDit(c?: string): string {
  const t = (c ?? "").trim();
  if (!t) return "";
  const n = Number(t.replace(/[\s\u00a0\u202f€]/g, "").replace(",", "."));
  if (/^[\d\s\u00a0\u202f.,]+€?$/.test(t) && Number.isFinite(n)) return eur0(n);
  return t;
}
const eur0 = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n).replace(/[\u00a0\u202f]/g, " ")} €`;

/** Le nom déjà suivi de « EI » (ou « Entrepreneur individuel ») : pas de doublon. */
const finitParEI = (n: string) => /(^|\s)(EI|entrepreneur individuel)\.?$/i.test(n.trim());

/**
 * L'en-tête du vendeur sur la feuille : un entrepreneur individuel a « EI »
 * après son nom ; une société a sa forme et son capital sous le nom. Une
 * facture faite avant le choix du statut s'imprime comme avant (la forme
 * notée, après le nom).
 */
export function enteteVendeur(seller: Pick<Invoice["seller"], "name" | "forme" | "ei" | "capital" | "commercial" | "rcs">): { nom: string; sous?: string; rcs?: string } {
  const name = seller.name.trim();
  const com = seller.commercial?.trim();
  if (seller.ei) return { nom: finitParEI(name) ? name : `${name} EI`, ...(com ? { sous: com } : {}) };
  if (seller.capital) return { nom: name, sous: `${seller.forme ? `${seller.forme} au capital` : "Capital"} de ${capitalDit(seller.capital)}`, ...(seller.rcs ? { rcs: seller.rcs } : {}) };
  return { nom: `${name}${seller.forme ? ` ${seller.forme}` : ""}` };
}

/** Ce qui peut manquer au vendeur pour faire une facture. */
export type VendeurManque = "nom" | "nomPrenom" | "statut" | "forme" | "capital" | "rcs" | "adresse" | "siret" | "tva";
export const VENDEUR_MANQUE_DIT: Record<VendeurManque, string> = {
  nom: "ta raison sociale",
  nomPrenom: "ton nom et ton prénom",
  statut: "ton statut",
  forme: "ta forme juridique",
  capital: "ton capital",
  rcs: "la ville de ton RCS",
  adresse: "ton adresse",
  siret: "ton SIRET",
  tva: "ton numéro de TVA intracommunautaire",
};
/** « ton adresse et ton SIRET », « ton nom, ton adresse et ton SIRET ». */
export const listeDite = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);

/**
 * Ce qui manque au vendeur pour émettre une facture, selon les mentions
 * obligatoires de Service Public Entreprendre
 * (https://entreprendre.service-public.gouv.fr/vosdroits/F31808, vérifié le
 * 11 août 2026, relu le 19 octobre 2026) :
 * - entrepreneur individuel : « nom et prénom de l'entrepreneur individuel
 *   précédé ou suivi de la mention Entrepreneur individuel ou EI » ; le nom
 *   commercial peut s'ajouter, il ne remplace pas le nom ;
 * - société : dénomination, forme juridique et montant du capital social ;
 *   et le RCS avec la ville du greffe (article R123-237 du Code de commerce,
 *   « RCS Angers 123 456 789 ») ;
 * - pour tous : adresse, SIREN (dans le SIRET), et le numéro de TVA quand on
 *   facture la TVA.
 */
export function vendeurManque(b: BillingInfo | undefined): VendeurManque[] {
  const out: VendeurManque[] = [];
  // Entrepreneur individuel ou société : la loi ne demande pas les mêmes mentions. Le nom vient avec le statut.
  if (!b?.statut) out.push("statut");
  if (b?.statut === "ei" && !b.nomPrenom?.trim()) out.push("nomPrenom");
  if (b?.statut === "societe") {
    if (!b.legalName?.trim()) out.push("nom");
    if (!b.forme?.trim()) out.push("forme");
    if (!b.capital?.trim()) out.push("capital");
    if (!rcsDit(b.rcs)) out.push("rcs");
  }
  if (!b?.address?.trim()) out.push("adresse");
  if (!siretValide(b?.siret)) out.push("siret");
  if (b?.vat === "taux" && !tvaIntraValide(b.tvaIntra)) out.push("tva");
  return out;
}

/* ---------- Client particulier ou professionnel ---------- */

/** Les délais de paiement qu'on peut choisir pour un professionnel (la loi plafonne à 60 jours). */
export const DELAIS_PRO = [0, 30, 45, 60] as const;
export const delaiDit = (n: number) => (n ? `${n} jours` : "À réception");
export const PENALITES: ["bce10" | "legal3", string][] = [
  ["bce10", "Taux BCE + 10 points"],
  ["legal3", "3 fois le taux légal"],
];
const PENALITES_DIT: Record<"bce10" | "legal3", string> = {
  bce10: "taux de refinancement de la BCE majoré de 10 points",
  legal3: "trois fois le taux d’intérêt légal",
};
/** Les conditions de paiement d'un professionnel ne sont pas encore choisies. */
export const conditionsProManquent = (b: BillingInfo | undefined) => typeof b?.delaiPro !== "number" || !b?.penalites;

/** « Sophie Martin » oui ; « Claire D. », « Hugo », « M. Dupont » non : il faut le prénom et le nom en entier. */
export function estNomComplet(name?: string): boolean {
  const mots = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return false;
  if (pasUnPrenom(mots[0])) return false;
  return mots.every((m) => !m.endsWith(".") && m.replace(/[^\p{L}]/gu, "").length >= 2);
}

/** Le nom complet d'un client particulier pour sa facture : celui noté pour la facture, ou le nom de l'app s'il est complet. */
export const nomCompletDe = (person: Partial<Pick<Person, "name" | "nomComplet">> | undefined) => person?.nomComplet?.trim() || (estNomComplet(person?.name) ? (person?.name ?? "").trim() : "");

export type ClientManque = "statut" | "nomComplet" | "adresse" | "conditions";
/**
 * Ce qui manque au client : particulier ou professionnel (jamais deviné) ;
 * pour un particulier son nom complet (F31808 : « nom complet, adresse du
 * client (sauf opposition pour un particulier) ») ; pour un professionnel
 * son adresse et les conditions de paiement. Son numéro de TVA est
 * facultatif (imprimé s'il est noté).
 */
export function clientManque(person: (Pick<Person, "statut" | "address"> & Partial<Pick<Person, "name" | "nomComplet" | "adresseRefusee">>) | undefined, b: BillingInfo | undefined): ClientManque[] {
  const out: ClientManque[] = [];
  if (!person?.statut) return ["statut"];
  if (person.statut === "particulier" && !nomCompletDe(person)) out.push("nomComplet");
  // Service Public Entreprendre, F31808 « Mentions obligatoires sur une facture » (vérifié le 11 août 2026, relu le
  // 19 octobre 2026) : pour un client particulier, « nom complet, adresse du client (sauf opposition pour un particulier) ».
  if (person.statut === "particulier" && !person.address?.trim() && !person.adresseRefusee) out.push("adresse");
  if (person.statut === "pro") {
    if (!person.address?.trim()) out.push("adresse");
    if (conditionsProManquent(b)) out.push("conditions");
  }
  return out;
}

/** Les mentions de paiement d'une facture : échéance et pénalités pour un professionnel, réglée ou à payer. */
export function mentionsPaiement(inv: Pick<Invoice, "kind" | "buyer" | "due" | "echeance" | "penalites" | "reglee" | "issuedAt">): string[] {
  if (inv.kind === "avoir") return [];
  const out: string[] = [];
  if (inv.due <= 0 && inv.reglee) out.push(`Payée le ${dateDite(inv.reglee.date)}${inv.reglee.moyen ? ` ${inv.reglee.moyen}` : ""}.`);
  else if (inv.due > 0 && !(inv.buyer.pro && inv.echeance && inv.echeance > inv.issuedAt)) out.push("Payable à réception.");
  if (inv.buyer.pro) {
    if (inv.echeance) out.push(`Date d’échéance : ${dateDite(inv.echeance)}.`);
    if (inv.penalites) out.push(`En cas de retard, pénalités au ${PENALITES_DIT[inv.penalites]}, et indemnité forfaitaire pour frais de recouvrement de 40 €.`);
    out.push("Pas d’escompte pour paiement anticipé.");
  }
  return out;
}

/** Les types dont le taux n'est pas encore choisi. Franchise : aucun. Rien choisi : tous ceux demandés. */
export function tauxManquants(b: BillingInfo | undefined, kinds: VatKind[] = KINDS): VatKind[] {
  if (b?.vat === "franchise") return [];
  return kinds.filter((k) => !b?.rates?.[k]);
}

/** Le taux d'un type de prestation (0 en franchise), ou undefined s'il n'est pas choisi. */
export function tauxDe(b: BillingInfo | undefined, k: VatKind): number | undefined {
  if (b?.vat === "franchise") return 0;
  if (b?.vat !== "taux") return undefined;
  return b.rates?.[k];
}

/** « 5,5 % », « 20 % ». */
export const tauxDit = (n: number) => `${String(n).replace(".", ",")} %`;

/** Totaux HT, TVA par taux, TTC. Le TTC reste exactement ce que paie le client. */
export function totaux(lines: (Pick<InvoiceLine, "rate" | "totalTTC"> & { totalHT?: number })[]): { totalHT: number; vat: InvoiceVat[]; totalTTC: number } {
  const byRate = new Map<number, { ttc: number; ht: number; sansHT: boolean }>();
  for (const l of lines) {
    const g = byRate.get(l.rate) ?? { ttc: 0, ht: 0, sansHT: false };
    g.ttc += l.totalTTC;
    if (l.totalHT === undefined) g.sansHT = true;
    else g.ht += l.totalHT;
    byRate.set(l.rate, g);
  }
  // La base de chaque taux est la somme des lignes telles qu'imprimées (4 x 23,70 € font 94,80 €) ; la TVA, le reste du TTC.
  const vat: InvoiceVat[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, g]) => {
      const t = r2(g.ttc);
      const base = g.sansHT ? horsTaxes(t, rate) : r2(g.ht);
      return { rate, base, amount: r2(t - base) };
    });
  const totalTTC = r2(lines.reduce((t, l) => t + l.totalTTC, 0));
  const totalHT = r2(vat.reduce((t, v) => t + v.base, 0));
  return { totalHT, vat, totalTTC };
}

/**
 * Le prochain numéro de l'année : après le plus grand jamais donné, jamais un
 * numéro réutilisé. Trois mémoires comptent : les factures du carnet, le
 * compteur du carnet (`invoiceSeq`), et le compteur de l'appareil (`haut`),
 * qu'une sauvegarde reprise ne fait pas reculer.
 */
export function prochainNumero(
  invoices: Pick<Invoice, "year" | "seq">[] | undefined,
  seqs: Record<string, number> | undefined,
  year: number,
  haut?: Record<string, number>,
): { seq: number; number: string } {
  const y = String(year);
  const last = Math.max(seqs?.[y] ?? 0, haut?.[y] ?? 0, ...(invoices ?? []).filter((i) => i.year === year).map((i) => i.seq), 0);
  const seq = last + 1;
  return { seq, number: `${year}-${String(seq).padStart(4, "0")}` };
}

/** Le plus grand numéro de chaque année, entre plusieurs compteurs. */
export function compteurMax(...cs: (Record<string, number> | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cs) for (const [y, n] of Object.entries(c ?? {})) if (typeof n === "number" && n > (out[y] ?? 0)) out[y] = n;
  return out;
}

/**
 * Deux carnets de factures réunis (une sauvegarde reprise, un autre onglet) :
 * aucune facture ne se perd, le compteur garde le plus grand numéro. Une
 * facture se reconnaît à son id.
 */
export function fusionFactures(
  a: Pick<StableData, "invoices" | "invoiceSeq">,
  b: Pick<StableData, "invoices" | "invoiceSeq">,
  haut?: Record<string, number>,
): { invoices: Invoice[]; invoiceSeq: Record<string, number> } {
  const byId = new Map<string, Invoice>();
  for (const i of [...(a.invoices ?? []), ...(b.invoices ?? [])]) if (i?.id && !byId.has(i.id)) byId.set(i.id, i);
  const invoices = [...byId.values()].sort((x, y) => x.year - y.year || x.seq - y.seq);
  const fromInv: Record<string, number> = {};
  for (const i of invoices) fromInv[String(i.year)] = Math.max(fromInv[String(i.year)] ?? 0, i.seq);
  return { invoices, invoiceSeq: compteurMax(a.invoiceSeq, b.invoiceSeq, haut, fromInv) };
}

const estAvoir = (i: Pick<Invoice, "kind">) => i.kind === "avoir";

/** Les factures (sans les avoirs) d'un client pour un mois, de la plus ancienne à la plus récente. */
export function facturesDe(invoices: Invoice[] | undefined, payer: string, month: string): Invoice[] {
  const k = cleClient(payer);
  return (invoices ?? []).filter((i) => !estAvoir(i) && i.month === month && cleClient(i.payer) === k).sort((a, b) => a.year - b.year || a.seq - b.seq);
}

/** Les avoirs faits sur une facture. */
export const avoirsDe = (invoices: Invoice[] | undefined, number: string) => (invoices ?? []).filter((i) => estAvoir(i) && i.avoirDe?.number === number);

/**
 * Les recettes encore facturées : sur une facture, et pas rendues par un
 * avoir. Une recette annulée par un avoir peut repasser sur une facture.
 */
export function recettesFacturees(invoices: Invoice[] | undefined): Map<string, string> {
  const n = new Map<string, number>();
  const ou = new Map<string, string>();
  for (const i of invoices ?? []) {
    for (const id of i.revenueIds) {
      n.set(id, (n.get(id) ?? 0) + (estAvoir(i) ? -1 : 1));
      if (!estAvoir(i)) ou.set(id, i.number);
    }
  }
  const out = new Map<string, string>();
  for (const [id, c] of n) if (c > 0 && ou.has(id)) out.set(id, ou.get(id)!);
  return out;
}

/** Les recettes rendues par un avoir et sur aucune facture en cours. */
export function recettesAnnulees(invoices: Invoice[] | undefined): Set<string> {
  const n = new Map<string, number>();
  for (const i of invoices ?? []) for (const id of i.revenueIds) n.set(id, (n.get(id) ?? 0) + (estAvoir(i) ? -1 : 1));
  return new Set([...n].filter(([, c]) => c <= 0).map(([id]) => id));
}

/**
 * Ce qui reste à facturer sur une note : les lignes sur aucune facture. Une
 * ligne annulée par un avoir peut repasser sur une facture (on corrige),
 * sauf quand le client a été remboursé ce mois-là : l'avoir est alors
 * définitif, la ligne ne revient pas dans Facturer.
 */
export function aFacturer(b: Pick<Bill, "lines" | "rendu">, deja: Map<string, string>, annulees: Set<string>): Bill["lines"] {
  return b.lines.filter((l) => l.amount && !deja.has(l.id) && !((b.rendu ?? 0) > 0 && annulees.has(l.id)));
}

/** Comment un client a soldé son mois : le jour de son dernier paiement, et le moyen s'il est noté. */
export function regleeDe(payments: Payment[] | undefined, payer: string, month: string): { date: string; moyen?: string } | undefined {
  const k = cleClient(payer);
  const ps = (payments ?? []).filter((p) => p.kind !== "remboursement" && p.month === month && cleClient(p.payer) === k).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  if (!ps.length) return undefined;
  const last = ps[ps.length - 1];
  const d = last.at ? new Date(last.at) : null;
  const date = d && !isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : `${month}-01`;
  const moyens = [...new Set(ps.map((p) => p.method))];
  const moyen = moyens.every(Boolean) ? listeDite(moyens.map((m) => enMoyen(m))) : undefined;
  return { date, ...(moyen ? { moyen } : {}) };
}

/** Ce qu'il faut pour faire la facture, ou ce qui manque. */
export interface Brouillon {
  /** Rien de nouveau à facturer ce mois. */
  vide: boolean;
  /** Les types présents sur la facture. */
  kinds: VatKind[];
  /** La TVA n'a jamais été réglée (ni franchise, ni taux). */
  tvaAChoisir: boolean;
  /** Les types présents dont le taux manque. */
  manquants: VatKind[];
  /** Ce qui manque au client (particulier ou pro, son adresse, les conditions d'un pro). */
  client: ClientManque[];
  /** Ce qui reste à facturer (TTC), même tant que la facture attend une réponse. */
  montant: number;
  /** Le contenu, dès que tous les taux sont connus et le client complet. */
  facture?: Omit<Invoice, "id" | "number" | "year" | "seq" | "issuedAt" | "seller" | "echeance" | "penalites">;
}

/** La fiche du client, casse et espaces confondus. */
export const personneDe = (data: Pick<StableData, "people">, payer: string) => (data.people ?? []).find((p) => cleClient(p.name) === cleClient(payer));

/**
 * Le brouillon de la facture d'un client pour un mois : ce qui a compté et
 * n'est pas encore sur une facture, regroupé ligne à ligne (« Cours
 * collectif × 4 »). Ce qui est déjà payé se répartit sur les factures du
 * mois dans l'ordre : la première d'abord.
 */
export function brouillon(data: StableData, payer: string, period: Period): Brouillon {
  const bill = billOf(data, payer, period);
  const mk = monthKey(period);
  const deja = recettesFacturees(data.invoices);
  const avant = facturesDe(data.invoices, payer, mk);
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name ?? "";
  const b = facturation(data);
  const person = personneDe(data, payer);
  type G = { label: string; kind: VatKind; unitTTC: number; qty: number; ids: string[] };
  const groups = new Map<string, G>();
  for (const l of bill ? aFacturer(bill, deja, recettesAnnulees(data.invoices)) : []) {
    const r = data.revenues.find((x) => x.id === l.id);
    const kind = r ? kindOf(r, catName(r.categoryId)) : "autre";
    const label = (kind === "pension" || kind === "soins") && l.horse && !l.label.includes(l.horse) ? `${l.label} (${l.horse})` : l.label;
    const unitTTC = r2(l.amount);
    const key = `${kind}|${label}|${unitTTC}`;
    const g = groups.get(key) ?? { label, kind, unitTTC, qty: 0, ids: [] };
    g.qty++;
    g.ids.push(l.id);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, c) => KINDS.indexOf(a.kind) - KINDS.indexOf(c.kind) || a.label.localeCompare(c.label, "fr"));
  const kinds = KINDS.filter((k) => list.some((g) => g.kind === k));
  const tvaAChoisir = !b?.vat;
  const manquants = tvaAChoisir ? kinds : tauxManquants(b, kinds);
  const client = clientManque(person, b);
  const out: Brouillon = { vide: list.length === 0, kinds, tvaAChoisir, manquants, client, montant: r2(list.reduce((t, g) => t + g.unitTTC * g.qty, 0)) };
  if (out.vide || tvaAChoisir || manquants.length || client.length) return out;
  const franchise = b?.vat === "franchise";
  const lines: InvoiceLine[] = list.map((g) => {
    const rate = tauxDe(b, g.kind) ?? 0;
    const totalTTC = r2(g.unitTTC * g.qty);
    const unitHT = horsTaxes(g.unitTTC, rate);
    // Le total hors taxes d'une ligne, c'est sa quantité fois le prix unitaire imprimé : le gérant refait la multiplication.
    return { label: g.label, kind: g.kind, qty: g.qty, rate, unitTTC: g.unitTTC, unitHT, totalTTC, totalHT: r2(unitHT * g.qty), revenueIds: g.ids };
  });
  const t = totaux(lines);
  // Ce que les factures d'avant prennent déjà sur ce qui est payé : leur total, moins leurs avoirs (une facture annulée ne prend rien).
  const dejaFacture = avant.reduce((s, i) => s + resteEnEuros(i, data.invoices), 0);
  // Ce qui est payé, moins ce que tu lui as rendu sur ce mois.
  const recu = (bill?.paid ?? 0) - (bill?.rendu ?? 0);
  const paid = r2(Math.min(t.totalTTC, Math.max(0, recu - dejaFacture)));
  const due = r2(Math.max(0, t.totalTTC - paid));
  const reglee = due <= 0 ? regleeDe(data.payments, payer, mk) : undefined;
  const pro = person?.statut === "pro";
  out.facture = {
    payer: bill?.payer ?? payer,
    month: mk,
    buyer: {
      name: (pro ? "" : nomCompletDe(person)) || (bill?.payer ?? payer),
      ...(person?.address?.trim() ? { address: person.address.trim() } : {}),
      ...(pro ? { pro: true } : {}),
      ...(pro && tvaIntraPropre(person?.tvaIntra) ? { tvaIntra: tvaIntraPropre(person?.tvaIntra) } : {}),
    },
    franchise,
    lines,
    totalHT: t.totalHT,
    vat: t.vat,
    totalTTC: t.totalTTC,
    paid,
    due,
    ...(reglee ? { reglee } : {}),
    revenueIds: list.flatMap((g) => g.ids),
  };
  return out;
}

/** Les clients qui ont quelque chose à facturer ce mois (une ligne qui n'est sur aucune facture). */
export function clientsAFacturer(data: StableData, period: Period): string[] {
  const deja = recettesFacturees(data.invoices);
  const annulees = recettesAnnulees(data.invoices);
  return billsFor(data, period)
    .filter((b) => !b.orphan && aFacturer(b, deja, annulees).length > 0)
    .map((b) => b.payer);
}

/**
 * Le mois des factures à faire : en début de mois (jusqu'au 10), le mois
 * d'avant s'il reste des factures à y faire ; sinon le mois en cours.
 */
export function moisAFacturer(data: StableData, today: string): { period: Period; clients: string[] } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const cur = { year: y, month: m };
  if (Number(today.slice(8, 10)) <= 10) {
    const prev = m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
    const c = clientsAFacturer(data, prev);
    if (c.length) return { period: prev, clients: c };
  }
  return { period: cur, clients: clientsAFacturer(data, cur) };
}

/** Le jour, `n` jours plus tard (AAAA-MM-JJ). */
const plusJours = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Le vendeur tel qu'il s'imprime : nom (avec « EI » pour un entrepreneur
 * individuel ; forme et capital pour une société), adresse, SIRET, TVA
 * intracommunautaire hors franchise, et l'IBAN s'il est noté et bien formé.
 */
export function vendeurDe(b: BillingInfo | undefined, franchise: boolean): Invoice["seller"] {
  const ei = b?.statut === "ei";
  const forme = ei ? undefined : b?.forme?.trim();
  const capital = b?.statut === "societe" ? b.capital?.trim() : undefined;
  const commercial = ei && b?.legalName?.trim() && b.legalName.trim().toLowerCase() !== nomVendeur(b).toLowerCase() ? b.legalName.trim() : undefined;
  const rcs = b?.statut === "societe" ? rcsDit(b.rcs, b.siret) : "";
  const tva = tvaIntraPropre(b?.tvaIntra);
  const iban = ibanValide(b?.iban) ? ibanPropre(b?.iban) : undefined;
  return {
    name: nomVendeur(b),
    ...(ei ? { ei: true } : {}),
    ...(commercial ? { commercial } : {}),
    ...(forme ? { forme } : {}),
    ...(capital ? { capital } : {}),
    ...(rcs ? { rcs } : {}),
    ...(iban ? { iban } : {}),
    ...(b?.address?.trim() ? { address: b.address.trim() } : {}),
    ...(siretPropre(b?.siret) ? { siret: siretPropre(b?.siret) } : {}),
    ...(!franchise && tva ? { tvaIntra: tva } : {}),
  };
}

/** La facture complète, prête à enregistrer : numéro, date, vendeur, et pour un professionnel l'échéance. */
export function emettre(
  data: Pick<StableData, "invoices" | "invoiceSeq" | "billing" | "holding">,
  contenu: NonNullable<Brouillon["facture"]>,
  today: string,
  id: string,
  haut?: Record<string, number>,
): Invoice {
  const year = Number(today.slice(0, 4));
  const { seq, number } = prochainNumero(data.invoices, data.invoiceSeq, year, haut);
  const b = facturation(data);
  const pro = !!contenu.buyer.pro;
  return {
    ...contenu,
    id,
    number,
    year,
    seq,
    issuedAt: today,
    seller: vendeurDe(b, contenu.franchise),
    ...(pro && typeof b.delaiPro === "number" ? { echeance: plusJours(today, b.delaiPro) } : {}),
    ...(pro && b.penalites ? { penalites: b.penalites } : {}),
  };
}

/* ---------- L'avoir : une facture ne se modifie pas, elle s'annule ---------- */

/** Ce qui reste à annuler, ligne par ligne (en quantité), une fois les avoirs déjà faits retirés. */
export function resteAAnnuler(inv: Invoice, invoices: Invoice[] | undefined): number[] {
  const reste = inv.lines.map((l) => l.qty);
  for (const a of avoirsDe(invoices, inv.number)) for (const l of a.lines) if (typeof l.de === "number" && reste[l.de] !== undefined) reste[l.de] = Math.max(0, reste[l.de] - l.qty);
  return reste;
}

/** Ce qui reste à annuler en euros (TTC) : le total de la facture moins ses avoirs déjà faits. */
export function resteEnEuros(inv: Invoice, invoices: Invoice[] | undefined): number {
  return r2(Math.max(0, inv.totalTTC + avoirsDe(invoices, inv.number).reduce((t, a) => t + a.totalTTC, 0)));
}

/** « Annulée » (un avoir la couvre en entier) ou « En partie annulée », pour la liste des factures. Rien pour un avoir. */
export function etatAnnulation(inv: Invoice, invoices: Invoice[] | undefined): "Annulée" | "En partie annulée" | null {
  if (estAvoir(inv) || !avoirsDe(invoices, inv.number).length) return null;
  return resteEnEuros(inv, invoices) <= 0 ? "Annulée" : "En partie annulée";
}

/**
 * Le contenu d'un avoir sur une facture : pour chaque ligne, la quantité
 * annulée (`qtes[i]`, bornée à ce qui reste). Les montants sont ceux de la
 * facture, en négatif ; le vendeur et le client sont ceux de la facture.
 *
 * Pourquoi le vendeur de la facture, pas celui du jour : l'avoir rectifie
 * une facture précise (il la cite, art. 242 nonies A de l'annexe II du
 * CGI) ; il doit venir de la même personne, avec la même identité (nom,
 * statut, SIRET, TVA). Si le gérant est passé d'EI à société entre-temps,
 * la société ne peut pas annuler une facture de l'EI. Seule l'adresse
 * pourrait être plus juste au jour de l'avoir ; elle reste celle de la
 * facture, pour que les deux documents se répondent.
 */
export function contenuAvoir(inv: Invoice, qtes: number[], invoices: Invoice[] | undefined): Omit<Invoice, "id" | "number" | "year" | "seq" | "issuedAt"> | null {
  const reste = resteAAnnuler(inv, invoices);
  const pos: InvoiceLine[] = [];
  const rendues: string[] = [];
  inv.lines.forEach((l, i) => {
    const q = Math.min(Math.max(0, Math.floor(qtes[i] ?? 0)), reste[i] ?? 0);
    if (!q) return;
    const totalTTC = r2(l.unitTTC * q);
    // Les dernières recettes de la ligne pas encore rendues par un autre avoir.
    const deja = avoirsDe(invoices, inv.number).flatMap((a) => a.lines.filter((x) => x.de === i).flatMap((x) => x.revenueIds ?? []));
    const ids = (l.revenueIds ?? []).filter((x) => !deja.includes(x)).slice(-q);
    rendues.push(...ids);
    pos.push({ label: l.label, kind: l.kind, qty: q, rate: l.rate, unitTTC: l.unitTTC, unitHT: l.unitHT, totalTTC, totalHT: r2(l.unitHT * q), revenueIds: ids, de: i });
  });
  if (!pos.length) return null;
  // Jamais plus que ce qui reste de la facture (un avoir d'un montant a pu être fait avant).
  if (r2(pos.reduce((t, l) => t + l.totalTTC, 0)) > resteEnEuros(inv, invoices) + 0.005) return null;
  // Une facture d'avant les lignes détaillées, annulée en entier : toutes ses recettes sont rendues.
  const tout = reste.every((r, i) => (qtes[i] ?? 0) >= r);
  if (tout && !inv.lines.some((l) => l.revenueIds)) rendues.push(...inv.revenueIds);
  const t = totaux(pos);
  const neg = (n: number) => (n ? -n : 0);
  return {
    kind: "avoir",
    avoirDe: { number: inv.number, issuedAt: inv.issuedAt },
    payer: inv.payer,
    month: inv.month,
    seller: inv.seller,
    buyer: inv.buyer,
    franchise: inv.franchise,
    lines: pos.map((l) => ({ ...l, totalTTC: neg(l.totalTTC), totalHT: neg(l.totalHT) })),
    totalHT: neg(t.totalHT),
    vat: t.vat.map((v) => ({ rate: v.rate, base: neg(v.base), amount: neg(v.amount) })),
    totalTTC: neg(t.totalTTC),
    paid: 0,
    due: 0,
    revenueIds: [...new Set(rendues)],
  };
}

/**
 * L'avoir d'un montant libre (une remise de 50 € pour une semaine
 * d'absence) : une ligne au motif donné, jamais plus que ce qui reste de la
 * facture. Avec plusieurs taux de TVA, le montant se répartit entre eux au
 * prorata de la facture, pour que la TVA rendue soit juste. Il ne rend
 * aucune ligne de la facture : elle reste facturée, diminuée du montant.
 */
export function contenuAvoirMontant(inv: Invoice, montant: number, motif: string, invoices: Invoice[] | undefined): Omit<Invoice, "id" | "number" | "year" | "seq" | "issuedAt"> | null {
  const m = r2(montant);
  if (!(m > 0) || m > resteEnEuros(inv, invoices) + 0.005 || inv.kind === "avoir") return null;
  const label = motif.trim() || "Remise";
  // Le TTC de la facture par taux, et la prestation principale de chaque taux.
  const parTaux = new Map<number, { ttc: number; kind: VatKind; poids: number }>();
  for (const l of inv.lines) {
    const g = parTaux.get(l.rate) ?? { ttc: 0, kind: l.kind, poids: 0 };
    g.ttc += l.totalTTC;
    if (l.totalTTC > g.poids) {
      g.poids = l.totalTTC;
      g.kind = l.kind;
    }
    parTaux.set(l.rate, g);
  }
  const taux = [...parTaux.entries()].filter(([, g]) => g.ttc > 0).sort((a, b) => a[0] - b[0]);
  const total = taux.reduce((t, [, g]) => t + g.ttc, 0);
  if (!taux.length || total <= 0) return null;
  let reste = m;
  const pos: InvoiceLine[] = taux.map(([rate, g], i) => {
    const part = i === taux.length - 1 ? r2(reste) : r2((m * g.ttc) / total);
    reste = r2(reste - part);
    const unitHT = horsTaxes(part, rate);
    return { label: taux.length > 1 ? `${label} (TVA ${tauxDit(rate)})` : label, kind: g.kind, qty: 1, rate, unitTTC: part, unitHT, totalTTC: part, totalHT: unitHT };
  });
  const t = totaux(pos);
  const neg = (n: number) => (n ? -n : 0);
  return {
    kind: "avoir",
    avoirDe: { number: inv.number, issuedAt: inv.issuedAt },
    payer: inv.payer,
    month: inv.month,
    seller: inv.seller,
    buyer: inv.buyer,
    franchise: inv.franchise,
    lines: pos.map((l) => ({ ...l, totalTTC: neg(l.totalTTC), totalHT: neg(l.totalHT) })),
    totalHT: neg(t.totalHT),
    vat: t.vat.map((v) => ({ rate: v.rate, base: neg(v.base), amount: neg(v.amount) })),
    totalTTC: neg(t.totalTTC),
    paid: 0,
    due: 0,
    revenueIds: [],
  };
}

/** L'avoir numéroté dans la même suite que les factures. */
export function emettreAvoir(
  data: Pick<StableData, "invoices" | "invoiceSeq">,
  contenu: NonNullable<ReturnType<typeof contenuAvoir | typeof contenuAvoirMontant>>,
  today: string,
  id: string,
  haut?: Record<string, number>,
): Invoice {
  const year = Number(today.slice(0, 4));
  const { seq, number } = prochainNumero(data.invoices, data.invoiceSeq, year, haut);
  return { ...contenu, id, number, year, seq, issuedAt: today };
}

/* ---------- Les mots ---------- */

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « octobre 2026 » pour « 2026-10 ». */
export const moisDit = (mk: string) => `${MOIS[Number(mk.slice(5, 7)) - 1] ?? ""} ${mk.slice(0, 4)}`;

/** « de » élidé devant une voyelle : « d’octobre », « d’août », « de mai ». */
export const de = (mot: string) => (/^[aeiouyàâäéèêëîïôöûüù]/i.test(mot) ? `d’${mot}` : `de ${mot}`);
/** « d’octobre 2026 », « de mai 2026 ». */
export const deMois = (mk: string) => de(moisDit(mk));

/** « 17 octobre 2026 ». */
export const dateDite = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MOIS[m - 1] ?? ""} ${y}`;
};

/** Un montant au centime, à la française : « 1 234,50 € », « −23,70 € ». */
export function eur2(n: number): string {
  const v = r2(n);
  const s = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  return `${v < 0 ? "−" : ""}${s.replace(/[  ]/g, " ")} €`;
}

/** Le prénom du client pour un message (règle unique : lib/domain/politesse.ts), « » pour un pro, une société, une civilité. */
export const prenomClient = (buyer: { name?: string; pro?: boolean } | undefined, payer = ""): string => prenom(buyer?.name || payer, buyer?.pro);

/** Le nom à dire à l'écran (« L'envoyer à Claire », « faite pour EARL Les Tilleuls ») : le prénom d'une personne, le nom entier sinon. */
export const appelClient = (buyer: { name?: string; pro?: boolean } | undefined, payer: string) => prenomClient(buyer, payer) || appel(buyer?.name || payer) || payer;

/** Le message en bas de l'écran (rendu en HTML) : le numéro et le nom du client sont échappés. */
export const messageFaite = (inv: Pick<Invoice, "kind" | "number" | "payer" | "avoirDe"> & { buyer?: Pick<Invoice["buyer"], "name" | "pro"> }) =>
  inv.kind === "avoir"
    ? `Avoir n° ${esc(inv.number)} fait${inv.avoirDe ? ` sur la facture n° ${esc(inv.avoirDe.number)}` : ""}.`
    : `Facture n° ${esc(inv.number)} faite pour ${esc(appelClient(inv.buyer, inv.payer))}.`;

/** « Facture n° 2026-0004 », « Avoir n° 2026-0007 », « Facture à numéroter » (faite sans réseau). */
export const nomDoc = (inv: Pick<Invoice, "kind" | "number" | "provisoire">) => (inv.provisoire ? "Facture à numéroter" : `${inv.kind === "avoir" ? "Avoir" : "Facture"} n° ${inv.number}`);

/**
 * Par où part le message : l'e-mail (on y joint le PDF), le partage du
 * téléphone avec le PDF en pièce jointe, ou un SMS / WhatsApp (le message
 * seul, rien n'est joint : il ne promet pas de pièce jointe).
 */
export type Canal = "email" | "partage" | "court";

/**
 * Le message prêt à envoyer avec la facture (ou l'avoir) : montant, mois,
 * numéro. Tu ou vous selon le choix de Tes factures (vous par défaut). Le
 * prénom quand le client est une personne (« Bonjour Claire, »), sinon
 * « Bonjour, ». « Je vous joins la facture en PDF » seulement quand le PDF
 * part avec (e-mail, partage) ; par SMS ou WhatsApp, une phrase qui ne
 * promet rien. Et la signature : le gérant et le nom de l'écurie.
 */
export function messageFacture(
  inv: Pick<Invoice, "payer" | "number" | "month" | "totalTTC" | "due" | "kind" | "avoirDe"> & { buyer?: Pick<Invoice["buyer"], "name" | "pro">; echeance?: string },
  gerant: string,
  opts: { tu?: boolean; ecurie?: string; canal?: Canal; rembourse?: boolean } = {},
): string {
  const nb = (n: number) => eur2(n).replace(/ /g, " ");
  const f = formule(opts.tu);
  const bonjour = salut(inv.buyer?.name || inv.payer, inv.buyer?.pro);
  const doc = inv.kind === "avoir" ? "l’avoir" : "la facture";
  const pdf = (opts.canal ?? "email") === "court" ? `Je peux ${f.te} l’envoyer en PDF si besoin.` : `Je ${f.te} joins ${doc} en PDF.`;
  const out =
    inv.kind === "avoir"
      ? [bonjour, `Voici l’avoir n° ${inv.number}${inv.avoirDe ? ` sur la facture n° ${inv.avoirDe.number}` : ""} : ${opts.rembourse ? `${opts.tu ? "Je te rembourse" : "Nous vous remboursons"} ${nb(-inv.totalTTC)}.` : `${nb(-inv.totalTTC)} déduits de ${f.ta} facture.`}`, pdf]
      : [
          bonjour,
          `Voici ${f.ta} facture n° ${inv.number} pour ${moisDit(inv.month)} : ${nb(inv.totalTTC)}.`,
          inv.due > 0 && inv.due < inv.totalTTC
            ? `Reste à payer : ${nb(inv.due)}${inv.echeance ? `, avant le ${dateDite(inv.echeance)}` : ""}.`
            : inv.due <= 0
              ? "Elle est déjà réglée."
              : inv.echeance
                ? `À régler avant le ${dateDite(inv.echeance)}.`
                : "Payable à réception.",
          pdf,
        ];
  out.push(...signature(gerant, opts.ecurie));
  return out.join("\n");
}
