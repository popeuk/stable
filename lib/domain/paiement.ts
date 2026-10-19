import type { Payment, PaymentMethod } from "@/lib/domain/types";
import { cleClient } from "@/lib/domain/billing";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Le moyen de paiement : chèque, espèces, virement, autre. Le comptable veut
 * savoir comment l'argent est rentré. Par défaut, le dernier moyen utilisé
 * par ce client. Domaine pur.
 */
export const MOYENS: [PaymentMethod, string][] = [
  ["cheque", "Chèque"],
  ["especes", "Espèces"],
  ["virement", "Virement"],
  ["autre", "Autre"],
];

const NOMS: Record<PaymentMethod, string> = { cheque: "chèque", especes: "espèces", virement: "virement", autre: "autre moyen" };

/** « chèque », « espèces »… ; vide si non noté. */
export const nomMoyen = (m?: PaymentMethod) => (m ? NOMS[m] : "");

/** « chèque n° 1234567 », « espèces », « virement » ; vide si non noté. */
export function moyenDit(p: Pick<Payment, "method" | "chequeNumber">): string {
  if (!p.method) return "";
  if (p.method === "cheque" && p.chequeNumber?.trim()) return `chèque n° ${p.chequeNumber.trim()}`;
  return NOMS[p.method];
}

/** « en espèces », « par chèque », « par virement », « autrement ». */
export function enMoyen(m?: PaymentMethod): string {
  if (!m) return "";
  return m === "especes" ? "en espèces" : m === "cheque" ? "par chèque" : m === "virement" ? "par virement" : "autrement";
}

/** Le dernier moyen noté pour ce client (casse et espaces confondus), ou undefined. */
export function dernierMoyen(payments: Payment[] | undefined, payer: string): PaymentMethod | undefined {
  const k = cleClient(payer);
  let best: Payment | undefined;
  for (const p of payments ?? []) {
    if (!p.method || cleClient(p.payer) !== k) continue;
    if (!best || (p.at ?? "") >= (best.at ?? "")) best = p;
  }
  return best?.method;
}

/** Un numéro de chèque saisi : chiffres et lettres seulement, 20 au plus. */
export const saisieCheque = (raw: string) => raw.replace(/[^\dA-Za-z]/g, "").slice(0, 20);

/** Les montants proposés en puces pour un paiement partiel : 20, 50, 100 € et la moitié, sous ce qui est dû. Le champ, lui, reste vide. */
export function suggestionsPartielles(due: number): number[] {
  return [...new Set([20, 50, 100, Math.round(due / 2)])].filter((x) => x > 0 && x < due).sort((a, b) => a - b);
}

/**
 * Un paiement reçu, réparti sur les mois encore dus, du plus ancien au plus
 * récent : un client qui paie 500 € alors qu'il doit 120 € de septembre et
 * 400 € d'octobre solde septembre, puis 380 € d'octobre. Ce qui dépasse va
 * sur le dernier mois. Rend un paiement par mois touché.
 */
export function repartirPaiement(dus: { month: string; due: number }[], montant: number): { month: string; amount: number }[] {
  const mois = [...dus].filter((d) => d.due > 0).sort((a, b) => a.month.localeCompare(b.month));
  const out: { month: string; amount: number }[] = [];
  let reste = r2(montant);
  for (const m of mois) {
    if (reste <= 0) break;
    const a = Math.min(reste, m.due);
    out.push({ month: m.month, amount: r2(a) });
    reste = r2((reste - a));
  }
  if (reste > 0 && out.length) out[out.length - 1].amount = r2((out[out.length - 1].amount + reste));
  return out;
}
