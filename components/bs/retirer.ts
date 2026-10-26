"use client";

import { esc } from "@/components/bs/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { estCollectif } from "@/lib/domain/compte-auto";
import { recettesFacturees } from "@/lib/domain/factures-base";
import { FACTURATION } from "@/lib/fonctions";
import type { DayItem } from "@/lib/domain/seances";

/**
 * Retirer ce qui n'a pas eu lieu. Tout ce qui est passé compte tout seul ;
 * le gérant retire seulement la ligne qui n'a pas eu lieu, avec « Annuler »
 * dans le message du bas.
 *
 * - une séance simple : annulée (« N’a pas eu lieu »), sa recette s'en va ;
 * - un soin : retiré du carnet, sa dépense et sa recette s'en vont ;
 * - un cours à plusieurs : avec `payer`, ce client passe absent et ne paie
 *   plus, les autres restent comptés ; sans `payer`, la séance s'ouvre sur
 *   « qui était là ? » ;
 * - une recette seule (`revenueId`) : on remonte à sa séance ou à son soin,
 *   sinon la recette (ou la refacturation) est retirée.
 */

export interface LigneARetirer {
  seanceId?: string;
  careIds?: string[];
  /** Une recette de la fiche client : on retrouve sa séance ou son soin. */
  revenueId?: string;
  /** Le client de la ligne : dans un cours à plusieurs, c'est lui qui est retiré. */
  payer?: string;
  /** Pour le message : « Cours de Tonnerre, mardi ». */
  label?: string;
}

/** Ce que le geste a fait : retiré (avec annulation), ouvert la présence, ou rien trouvé. */
export type Retrait = "retire" | "presence" | "rien";

/** La ligne d'une journée (accueil, tournée, Ce qui a compté). */
export const ligneDe = (it: DayItem): LigneARetirer => ({ seanceId: it.seance?.id, careIds: it.care?.map((e) => e.id), label: it.title });

const snapshot = () => {
  const st = useDataStore.getState();
  const snap = { seances: st.seances, careEvents: st.careEvents, directExpenses: st.directExpenses, revenues: st.revenues };
  return () => useDataStore.setState(snap);
};

export function retirer(l: LigneARetirer, opts: { silent?: boolean } = {}): { fait: Retrait; undo: () => void } {
  const st = useDataStore.getState();
  avant = recettesFacturees(st.invoices);
  const rien = { fait: "rien" as Retrait, undo: () => {} };
  let { seanceId, careIds, payer } = l;

  // Une recette seule : sa séance, son soin, ou elle-même.
  if (l.revenueId && !seanceId && !careIds?.length) {
    const rev = st.revenues.find((r) => r.id === l.revenueId);
    if (!rev) return rien;
    payer = payer ?? rev.payer;
    if (rev.seanceId) seanceId = rev.seanceId;
    else {
      const care = (st.careEvents ?? []).find((e) => e.revenueId === rev.id);
      if (care) careIds = [care.id];
    }
    if (!seanceId && !careIds?.length) {
      const undo = snapshot();
      if (rev.rebillOf) st.unrebillExpense(rev.rebillOf);
      else st.deleteRevenue(rev.id);
      return dire(l.label ?? rev.note ?? "La ligne", undo, opts);
    }
  }

  if (seanceId) {
    const s = (st.seances ?? []).find((x) => x.id === seanceId);
    if (!s || s.status === "cancelled") return rien;
    const label = l.label ?? s.title;
    if (estCollectif({ seance: s })) {
      const people = st.people ?? [];
      const p = payer ? s.participants.find((x) => people.find((y) => y.id === x.personId)?.name === payer) : undefined;
      if (!p) {
        useUiStore.getState().openSeance(s.id, "presence");
        return { fait: "presence", undo: () => {} };
      }
      const undo = snapshot();
      const presence = Object.fromEntries(s.participants.map((x) => [x.personId, x === p ? false : x.present !== false]));
      const autres = s.participants.some((x) => x !== p && x.present === false);
      st.validateSeance(s.id, presence, autres ? s.chargeAbsent : false);
      if (!opts.silent) useUiStore.getState().say(`${esc(label)} : plus rien pour ${esc(payer!)}.${surFacture()}`, undo);
      return { fait: "retire", undo };
    }
    const undo = snapshot();
    st.cancelSeance(s.id, "N’a pas eu lieu");
    return dire(label, undo, opts);
  }

  if (careIds?.length) {
    const ids = new Set(careIds);
    const evs = (st.careEvents ?? []).filter((e) => ids.has(e.id));
    if (!evs.length) return rien;
    const undo = snapshot();
    const expenses = new Set(evs.map((e) => e.expenseId).filter(Boolean) as string[]);
    for (const e of evs) st.deleteCareEvent(e.id);
    // Une dépense refacturée : la refacturation part avec elle.
    if (expenses.size) useDataStore.setState((s) => ({ revenues: s.revenues.filter((r) => !r.rebillOf || !expenses.has(r.rebillOf)) }));
    return dire(l.label ?? "Le soin", undo, opts);
  }

  return rien;
}

/** Les recettes facturées juste avant le geste. */
let avant = new Map<string, string>();

/**
 * Une ligne retirée qui était sur une facture : la facture, elle, ne change
 * pas. Le message le dit et dit comment l'annuler.
 */
function surFacture(): string {
  // Facturation masquée : on retire, sans parler de facture.
  if (!FACTURATION) return "";
  const reste = new Set(useDataStore.getState().revenues.map((r) => r.id));
  const nums = [...new Set([...avant].filter(([id]) => !reste.has(id)).map(([, n]) => n))];
  if (!nums.length) return "";
  return ` Cette ligne est sur la facture n° ${nums.map(esc).join(", ")}, qui ne change pas : annule-la par un avoir depuis la facture.`;
}

function dire(label: string, undo: () => void, opts: { silent?: boolean }): { fait: Retrait; undo: () => void } {
  if (!opts.silent) useUiStore.getState().say(`${esc(label)} : retiré.${surFacture()}`, undo);
  return { fait: "retire", undo };
}
