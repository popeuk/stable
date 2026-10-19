"use client";

import { getSession } from "@/lib/account/session";
import { ecrituresFaites } from "@/lib/account/vault";
import { etatPlace } from "@/lib/account/place";
import { compteurAppareil, facturesEnregistrees, noterCompteur, sousVerrou } from "@/lib/account/factures-seq";
import { compteurMax, fusionFactures } from "@/lib/domain/facture";
import type { Invoice, StableData } from "@/lib/domain/types";

/**
 * Donner un numéro à une facture (ou un avoir), sans jamais donner un numéro
 * qui ne serait pas enregistré.
 *
 * Sous verrou (un onglet à la fois) : relire le carnet enregistré (un autre
 * onglet a pu faire une facture), prendre le plus grand des compteurs, faire
 * les factures, les enregistrer, puis RELIRE ce qui est enregistré. Si le
 * téléphone est plein (ou si l'écriture n'a pas eu lieu), les factures sont
 * retirées et rien n'est numéroté : `FactureNonEnregistree`. Le compteur de
 * l'appareil n'est noté qu'une fois la facture enregistrée, pour que le
 * numéro ne soit pas « brûlé » par une facture qui n'existe pas.
 */
export class FactureNonEnregistree extends Error {
  constructor(public plein: boolean) {
    super(plein ? "place pleine" : "facture non enregistrée");
    this.name = "FactureNonEnregistree";
  }
}

/** Ce que dit l'écran quand une facture n'a pas pu être enregistrée. */
export function messageNonEnregistree(e: FactureNonEnregistree, avoir = false): string {
  const doc = avoir ? "l’avoir" : "la facture";
  return e.plein
    ? `Ton téléphone est plein : ${doc} n’a pas reçu de numéro, rien n’est enregistré. Fais une sauvegarde (Réglages, Avancé), libère de la place (photos, vidéos), puis réessaie.`
    : `${avoir ? "L’avoir n’a" : "La facture n’a"} pas pu être enregistré${avoir ? "" : "e"} sur cet appareil : rien n’est numéroté. Réessaie.`;
}

type Carnet = Pick<StableData, "invoices" | "invoiceSeq">;

/** Les factures sont-elles enregistrées telles quelles ? (sans session, rien ne s'enregistre : rien à vérifier) */
async function bienEnregistrees(out: Invoice[]): Promise<boolean> {
  if (!getSession()) return true;
  const st = await facturesEnregistrees();
  if (!st) return false;
  return out.every((i) => (st.invoices ?? []).some((j) => j.id === i.id && j.number === i.number));
}

/**
 * Enregistre des factures et vérifie qu'elles le sont. Les numéros donnés
 * (pas ceux des factures provisoires) montent le compteur. En cas d'échec,
 * elles sont retirées et l'erreur est levée.
 */
export async function enregistrerFactures<S extends Carnet>(get: () => S, set: (p: Partial<S>) => void, out: Invoice[], remplace = false): Promise<void> {
  const ids = new Set(out.map((i) => i.id));
  const avant = get();
  const seqAvant = avant.invoiceSeq;
  const donnes = compteurMax(...out.filter((i) => i.seq > 0).map((i) => ({ [String(i.year)]: i.seq })));
  const base = remplace ? (avant.invoices ?? []).filter((i) => !ids.has(i.id)) : (avant.invoices ?? []);
  set({ invoices: [...base, ...out], invoiceSeq: compteurMax(avant.invoiceSeq, donnes) } as Partial<S>);
  await ecrituresFaites("be-stable-data");
  if (!(await bienEnregistrees(out))) {
    const s = get();
    // Retirer ce qui n'a pas été enregistré ; une facture provisoire remplacée revient telle qu'elle était.
    const remises = remplace ? (avant.invoices ?? []).filter((i) => ids.has(i.id)) : [];
    set({ invoices: [...(s.invoices ?? []).filter((i) => !ids.has(i.id)), ...remises], invoiceSeq: seqAvant } as Partial<S>);
    throw new FactureNonEnregistree(etatPlace().plein);
  }
  noterCompteur(donnes);
}

/** Relit le carnet enregistré (un autre onglet) et le réunit à celui de l'écran. */
export async function relireCarnet<S extends Carnet>(get: () => S, set: (p: Partial<S>) => void): Promise<void> {
  const enregistrees = await facturesEnregistrees();
  if (enregistrees) set(fusionFactures(get(), enregistrees) as Partial<S>);
}

export async function numeroter<S extends Carnet>(get: () => S, set: (p: Partial<S>) => void, faire: (s: S, haut: Record<string, number>) => Invoice[]): Promise<Invoice[]> {
  return sousVerrou(async () => {
    await relireCarnet(get, set);
    const out = faire(get(), compteurAppareil());
    if (!out.length) return out;
    await enregistrerFactures(get, set, out);
    return out;
  });
}
