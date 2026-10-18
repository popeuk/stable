"use client";

import { create } from "zustand";
import { API, api, ApiError, type DemandeCavalier, type DemandesReponse } from "@/lib/account/api";
import { getSession, scopedKey } from "@/lib/account/session";

/**
 * Les demandes des cavaliers (décision 13) et la porte « Contact » : deux
 * routes de pc-bestable 1.5.0. Tant que le site ne les a pas (404), l'app
 * cache l'enveloppe et le bouton Contact.
 *
 * Une demande est « vue » quand le gérant a ouvert la liste : le site la
 * passe à « Lue par le gérant ». Si le site ne répond pas à ce moment-là,
 * l'appareil s'en souvient (pour la pastille) et le redit plus tard.
 */

/** Le nombre de demandes pas encore vues (la pastille rouge). */
export function nonVues(demandes: Pick<DemandeCavalier, "id" | "vue">[], vuesIci: number[] = []): number {
  const ici = new Set(vuesIci);
  return demandes.filter((d) => !d.vue && !ici.has(d.id)).length;
}

/** La date d'une demande, comme on la dit : « aujourd'hui », « hier », « le 12 octobre ». */
export function quandDemande(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jour = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const ecart = Math.round((jour(maintenant) - jour(d)) / 86_400_000);
  if (ecart === 0) return "aujourd’hui";
  if (ecart === 1) return "hier";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", ...(d.getFullYear() !== maintenant.getFullYear() ? { year: "numeric" } : {}) };
  return `le ${new Intl.DateTimeFormat("fr-FR", opts).format(d)}`;
}

/* ---------- La sonde : le site a-t-il la 1.5.0 ? ---------- */

let sonde: Promise<boolean | null> | null = null;

/**
 * true : les routes existent ; false : le site répond 404 (pas encore la
 * 1.5.0) ; null : pas de réseau, on ne sait pas (on réessaiera).
 */
export function routesSite(): Promise<boolean | null> {
  sonde ??= (async () => {
    const s = getSession();
    try {
      const r = await fetch(`${API}/demandes`, { headers: { Accept: "application/json", ...(s?.kind === "compte" ? { "X-BS-Token": s.token } : {}) }, credentials: "omit" });
      if (r.status === 404) return false;
      return true;
    } catch {
      sonde = null;
      return null;
    }
  })();
  return sonde;
}

/* ---------- Les demandes du compte ---------- */

const cleVues = () => scopedKey("bs-demandes-vues");
function lireVuesIci(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(cleVues()) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}
function ecrireVuesIci(ids: number[]) {
  try {
    localStorage.setItem(cleVues(), JSON.stringify(ids.slice(-200)));
  } catch {}
}

interface Etat {
  /** absent : pas de compte, ou le site n'a pas la route ; pret : chargé. */
  etat: "inconnu" | "absent" | "pret";
  pour: string;
  lu: number;
  fiche: DemandesReponse["fiche"];
  demandes: DemandeCavalier[];
  vuesIci: number[];
  charger: (force?: boolean) => Promise<void>;
  toutVoir: () => Promise<void>;
}

export const useDemandes = create<Etat>((set, get) => ({
  etat: "inconnu",
  pour: "",
  lu: 0,
  fiche: null,
  demandes: [],
  vuesIci: [],
  async charger(force = false) {
    const s = getSession();
    if (s?.kind !== "compte") return set({ etat: "absent", pour: "", demandes: [], fiche: null });
    const g = get();
    // Une lecture toutes les 5 minutes au plus (au retour sur l'app, au changement d'écran).
    if (!force && g.pour === s.token && Date.now() - g.lu < 5 * 60_000) return;
    set({ pour: s.token, lu: Date.now() });
    try {
      const r = await api.demandes();
      const vuesIci = lireVuesIci();
      set({ etat: "pret", fiche: r.fiche, demandes: r.demandes ?? [], vuesIci });
      // Les demandes vues ici quand le site ne répondait pas : on le lui redit.
      for (const d of r.demandes ?? []) if (!d.vue && vuesIci.includes(d.id)) void api.demandeVue(d.id).catch(() => {});
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) set({ etat: "absent" });
      else if (e instanceof ApiError && e.status === 401) set({ etat: "absent" });
      // Hors ligne ou site lent : on garde ce qu'on avait, on relira plus tard.
      else set({ lu: 0 });
    }
  },
  async toutVoir() {
    const nouvelles = get().demandes.filter((d) => !d.vue);
    if (!nouvelles.length) return;
    const ids = nouvelles.map((d) => d.id);
    const vuesIci = [...new Set([...get().vuesIci, ...ids])];
    ecrireVuesIci(vuesIci);
    set({ vuesIci });
    const faits = await Promise.all(ids.map((id) => api.demandeVue(id).then(() => id, () => null)));
    const ok = new Set(faits.filter((x): x is number => x !== null));
    set((st) => ({ demandes: st.demandes.map((d) => (ok.has(d.id) ? { ...d, vue: true } : d)) }));
  },
}));
