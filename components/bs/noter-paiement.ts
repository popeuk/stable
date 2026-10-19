import { useDataStore } from "@/stores/data-store";
import { encaissement } from "@/lib/domain/paiement";
import { accord } from "@/lib/domain/clients";
import type { ClientDue } from "@/lib/domain/clients";
import type { PaymentMethod } from "@/lib/domain/types";
import { r2 } from "@/lib/utils/arrondi";

const eurTxt = (n: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: Number.isInteger(r2(n)) ? 0 : 2, maximumFractionDigits: 2 }).format(r2(n)).replace(/ /g, " ")} €`;

/**
 * Noter un paiement reçu d'un client, de la même façon depuis sa fiche et
 * depuis le + : ses mois dus du plus ancien au plus récent, puis le reste en
 * avance (lib/domain/paiement, encaissement). Rend les paiements notés, pour
 * pouvoir annuler.
 */
export function noterPaiement(c: Pick<ClientDue, "name" | "anciens" | "dueMois" | "due">, montant: number, mk: string, how: { method?: PaymentMethod; chequeNumber?: string }): string[] {
  const st = useDataStore.getState();
  const { parts, avance } = encaissement(c, montant, mk);
  const ids = parts.map((p) => st.addPayment(c.name, p.month, p.amount, undefined, how));
  if (avance > 0) ids.push(st.addPayment(c.name, mk, avance, undefined, { ...how, kind: "avance" }));
  return ids;
}

/** « 80 € d'avance, déduits de ce qu'il te devra ensuite. » quand le paiement dépasse ce qu'il doit ; sinon rien. */
export function avanceDite(c: Pick<ClientDue, "name" | "due">, montant: number): string {
  const avance = r2(montant - c.due);
  return avance > 0 ? ` ${eurTxt(avance)} d’avance, déduits de ce qu’${accord(c.name, "il", "elle")} te devra ensuite.` : "";
}
