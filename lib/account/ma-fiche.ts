"use client";

import { create } from "zustand";
import { api, ApiError, type Choix, type Fiche } from "@/lib/account/api";
import { getSession } from "@/lib/account/session";

/**
 * La fiche bestable.fr du gérant, chargée une fois et partagée par l'accueil
 * (jauge, chemin) et la feuille d'une question. « Ma fiche » garde son propre
 * formulaire complet ; ici, on enregistre une réponse à la fois.
 */
interface Etat {
  etat: "inconnu" | "pret" | "aucune" | "erreur";
  fiche: Fiche | null;
  choix: Choix | null;
  charger: () => Promise<void>;
  /** Enregistre une réponse : la fiche entière repart, comme depuis « Ma fiche ». Rend la fiche à jour, ou lève l'erreur. */
  enregistrer: (p: Partial<Fiche>) => Promise<Fiche>;
}

let enCours: Promise<void> | null = null;

export const useMaFiche = create<Etat>((set, get) => ({
  etat: "inconnu",
  fiche: null,
  choix: null,
  charger: () => {
    if (getSession()?.kind !== "compte") {
      set({ etat: "aucune", fiche: null });
      return Promise.resolve();
    }
    if (enCours) return enCours;
    enCours = (async () => {
      try {
        const [f, c] = await Promise.all([api.maFiche(), get().choix ? Promise.resolve(get().choix) : api.choix().catch(() => null)]);
        set({ etat: "pret", fiche: f, choix: c });
      } catch (e) {
        set({ etat: e instanceof ApiError && e.code === "pas_de_fiche" ? "aucune" : "erreur" });
      } finally {
        enCours = null;
      }
    })();
    return enCours;
  },
  enregistrer: async (p) => {
    const f = get().fiche;
    if (!f) throw new Error("Pas de fiche");
    const n = { ...f, ...p };
    const { title, description, telephone, email, site, offres, hebergement, installations, services, places_libres, formules, prix_min } = n;
    const r = await api.majFiche({ title, description, telephone, email, site, offres, hebergement, installations, services, places_libres, formules, prix_min });
    set({ fiche: r });
    return r;
  },
}));
