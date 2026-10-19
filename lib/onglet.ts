/**
 * Un seul onglet actif à la fois (audit technique I7). Deux onglets de Be
 * Stable ouverts ensemble s'écrasaient : chacun gardait ses données en
 * mémoire et réécrivait tout le tiroir, celles de l'autre onglet perdues.
 *
 * Maintenant, l'onglet qu'on ouvre (ou qu'on reprend) le dit aux autres par
 * un BroadcastChannel ; les autres se mettent en pause : ils n'écrivent plus
 * rien (lib/account/vault) et affichent « Be Stable est ouvert dans un autre
 * onglet », avec « Reprendre ici », qui recharge l'onglet sur les données
 * à jour et met les autres en pause à leur tour.
 *
 * Sans BroadcastChannel (vieux navigateur), rien ne change.
 */

export interface Canal {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  close?(): void;
}

const NOM_CANAL = "be-stable-onglet";
let canal: Canal | null = null;
let id = "";
let pause = false;
const ecoutes = new Set<() => void>();

function poser(p: boolean) {
  if (p === pause) return;
  pause = p;
  for (const f of ecoutes) f();
}

/** Cet onglet est-il en pause (un autre a pris la main) ? */
export function ongletEnPause(): boolean {
  return pause;
}

export function ecouterOnglet(f: () => void) {
  ecoutes.add(f);
  return () => {
    ecoutes.delete(f);
  };
}

/** Cet onglet prend la main : les autres se mettent en pause. */
export function prendreLaMain() {
  if (!canal) return;
  poser(false);
  canal.postMessage({ actif: id });
}

/**
 * Branche le canal (une fois par onglet). Rend la fonction qui le
 * débranche. `fabrique` sert aux tests ; dans le navigateur, BroadcastChannel.
 */
export function brancherOnglet(fabrique: (() => Canal | null) | null = null): () => void {
  if (canal) return () => {};
  const f = fabrique ?? (() => (typeof BroadcastChannel === "function" ? (new BroadcastChannel(NOM_CANAL) as unknown as Canal) : null));
  try {
    canal = f();
  } catch {
    canal = null;
  }
  if (!canal) return () => {};
  id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  canal.onmessage = (e) => {
    const m = e.data as { actif?: unknown } | null;
    if (m && typeof m.actif === "string" && m.actif !== id) poser(true);
  };
  // L'onglet qu'on vient d'ouvrir a lu les données à jour : il prend la main.
  prendreLaMain();
  const c = canal;
  return () => {
    c.onmessage = null;
    c.close?.();
    if (canal === c) canal = null;
    pause = false;
  };
}
