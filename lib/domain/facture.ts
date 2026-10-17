import type { BillingInfo, Invoice, InvoiceLine, InvoiceVat, Period, Revenue, StableData, VatKind, VatRate } from "@/lib/domain/types";
import { billOf, cleClient, monthKey } from "@/lib/domain/billing";
import { prenomDe } from "@/lib/domain/clients";

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

const r2 = (n: number) => Math.round(n * 100) / 100;

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

/** Le nom du vendeur : la raison sociale, sinon le nom de l'écurie. */
export const nomVendeur = (b: BillingInfo | undefined, stableName: string) => b?.legalName?.trim() || stableName.trim();

/** Ce qui manque au vendeur pour émettre une facture. */
export function vendeurManque(b: BillingInfo | undefined, stableName: string): ("nom" | "adresse" | "siret")[] {
  const out: ("nom" | "adresse" | "siret")[] = [];
  if (!nomVendeur(b, stableName)) out.push("nom");
  if (!b?.address?.trim()) out.push("adresse");
  if (!siretValide(b?.siret)) out.push("siret");
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
export function totaux(lines: Pick<InvoiceLine, "rate" | "totalTTC">[]): { totalHT: number; vat: InvoiceVat[]; totalTTC: number } {
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.rate, (byRate.get(l.rate) ?? 0) + l.totalTTC);
  const vat: InvoiceVat[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, ttc]) => {
      const t = r2(ttc);
      const base = horsTaxes(t, rate);
      return { rate, base, amount: r2(t - base) };
    });
  const totalTTC = r2(lines.reduce((t, l) => t + l.totalTTC, 0));
  const totalHT = r2(vat.reduce((t, v) => t + v.base, 0));
  return { totalHT, vat, totalTTC };
}

/** Le prochain numéro de l'année : après le plus grand déjà donné, jamais un numéro réutilisé. */
export function prochainNumero(invoices: Pick<Invoice, "year" | "seq">[] | undefined, seqs: Record<string, number> | undefined, year: number): { seq: number; number: string } {
  const last = Math.max(seqs?.[String(year)] ?? 0, ...(invoices ?? []).filter((i) => i.year === year).map((i) => i.seq), 0);
  const seq = last + 1;
  return { seq, number: `${year}-${String(seq).padStart(4, "0")}` };
}

/** Les factures d'un client pour un mois, de la plus ancienne à la plus récente. */
export function facturesDe(invoices: Invoice[] | undefined, payer: string, month: string): Invoice[] {
  const k = cleClient(payer);
  return (invoices ?? []).filter((i) => i.month === month && cleClient(i.payer) === k).sort((a, b) => a.year - b.year || a.seq - b.seq);
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
  /** Le contenu, dès que tous les taux sont connus. */
  facture?: Omit<Invoice, "id" | "number" | "year" | "seq" | "issuedAt" | "seller">;
}

/**
 * Le brouillon de la facture d'un client pour un mois : ce qui a compté et
 * n'est pas encore sur une facture, regroupé ligne à ligne (« Cours
 * collectif × 4 »). Ce qui est déjà payé se répartit sur les factures du
 * mois dans l'ordre : la première d'abord.
 */
export function brouillon(data: StableData, payer: string, period: Period): Brouillon {
  const bill = billOf(data, payer, period);
  const mk = monthKey(period);
  const deja = new Set((data.invoices ?? []).flatMap((i) => i.revenueIds));
  const avant = facturesDe(data.invoices, payer, mk);
  const catName = (id?: string) => data.revenueCategories.find((c) => c.id === id)?.name ?? "";
  const b = data.billing;
  type G = { label: string; kind: VatKind; unitTTC: number; qty: number; ids: string[] };
  const groups = new Map<string, G>();
  for (const l of bill?.lines ?? []) {
    if (deja.has(l.id) || !l.amount) continue;
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
  const out: Brouillon = { vide: list.length === 0, kinds, tvaAChoisir, manquants };
  if (out.vide || tvaAChoisir || manquants.length) return out;
  const franchise = b?.vat === "franchise";
  const lines: InvoiceLine[] = list.map((g) => {
    const rate = tauxDe(b, g.kind) ?? 0;
    const totalTTC = r2(g.unitTTC * g.qty);
    return { label: g.label, kind: g.kind, qty: g.qty, rate, unitTTC: g.unitTTC, unitHT: horsTaxes(g.unitTTC, rate), totalTTC, totalHT: horsTaxes(totalTTC, rate) };
  });
  const t = totaux(lines);
  const dejaFacture = avant.reduce((s, i) => s + i.totalTTC, 0);
  const paid = r2(Math.min(t.totalTTC, Math.max(0, (bill?.paid ?? 0) - dejaFacture)));
  const person = (data.people ?? []).find((p) => cleClient(p.name) === cleClient(payer));
  out.facture = {
    payer: bill?.payer ?? payer,
    month: mk,
    buyer: { name: bill?.payer ?? payer, ...(person?.address?.trim() ? { address: person.address.trim() } : {}) },
    franchise,
    lines,
    totalHT: t.totalHT,
    vat: t.vat,
    totalTTC: t.totalTTC,
    paid,
    due: r2(Math.max(0, t.totalTTC - paid)),
    revenueIds: list.flatMap((g) => g.ids),
  };
  return out;
}

/** La facture complète, prête à enregistrer : numéro, date, vendeur. */
export function emettre(data: Pick<StableData, "invoices" | "invoiceSeq" | "billing">, contenu: NonNullable<Brouillon["facture"]>, today: string, stableName: string, id: string): Invoice {
  const year = Number(today.slice(0, 4));
  const { seq, number } = prochainNumero(data.invoices, data.invoiceSeq, year);
  const b = data.billing;
  return {
    ...contenu,
    id,
    number,
    year,
    seq,
    issuedAt: today,
    seller: { name: nomVendeur(b, stableName), ...(b?.address?.trim() ? { address: b.address.trim() } : {}), ...(siretPropre(b?.siret) ? { siret: siretPropre(b?.siret) } : {}) },
  };
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** « octobre 2026 » pour « 2026-10 ». */
export const moisDit = (mk: string) => `${MOIS[Number(mk.slice(5, 7)) - 1] ?? ""} ${mk.slice(0, 4)}`;

/** Un montant au centime, à la française : « 1 234,50 € ». */
export function eur2(n: number): string {
  const s = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(r2(n));
  return `${s.replace(/[  ]/g, " ")} €`;
}

/** Le message prêt à envoyer avec la facture : montant, mois, numéro. */
export function messageFacture(inv: Pick<Invoice, "payer" | "number" | "month" | "totalTTC" | "due">, gerant: string): string {
  const out = [
    `Bonjour ${prenomDe(inv.payer)},`,
    `voici ta facture n° ${inv.number} pour ${moisDit(inv.month)} : ${eur2(inv.totalTTC).replace(/ /g, " ")}.`,
    inv.due > 0 && inv.due < inv.totalTTC ? `Reste à payer : ${eur2(inv.due).replace(/ /g, " ")}.` : inv.due <= 0 ? "Elle est déjà réglée, merci." : "Payable à réception.",
    "Je te joins la facture en PDF.",
    gerant.trim() ? `Merci, ${gerant.trim()}` : "Merci",
  ];
  return out.join("\n");
}
