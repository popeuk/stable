import type { Payment, PaymentMethod } from "@/lib/domain/types";
import { cleClient } from "@/lib/domain/billing";

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
