"use client";

import { create } from "zustand";
import { getSession } from "@/lib/account/session";
import type { Resultat } from "@/lib/audit/grille-criteres";

/**
 * L'audit en ligne (27 novembre 2026) : le service du VPS
 * (deploiement/vps/audit) mesure sur internet les critères que l'appareil ne
 * peut pas lire (Google, annonces, réseaux, site), avec DataForSEO et Claude.
 * L'app lance l'audit, suit ses étapes et garde le dernier rendu ; la grille
 * (lib/audit/grille.ts) s'en sert là où l'appareil n'a rien lu.
 * Sans NEXT_PUBLIC_AUDIT_API (production pour l'instant), rien ne s'affiche.
 */
export const AUDIT_API = (process.env.NEXT_PUBLIC_AUDIT_API ?? "").replace(/\/$/, "");

export interface ResultatEnLigne {
  id: string;
  points: "0" | "1" | "2" | "a_verifier";
  constat: string;
  vu: { ou: string; valeur: string; mauvais: boolean }[];
  geste_titre: string;
  geste_qui: string;
  geste_effort: string;
  sources: string[];
}
export interface AuditEnLigne {
  id: string;
  statut: "en_cours" | "pret" | "erreur";
  cree: string;
  termine: string | null;
  etapes: string[];
  resultat: { resume: string; resultats: ResultatEnLigne[]; modele?: string } | null;
  erreur: string | null;
}
export interface EtatAudit {
  dernier: AuditEnLigne | null;
  historique: { id: string; termine: string; points: Record<string, ResultatEnLigne["points"]> }[];
}

/** Le dernier audit fini, dans la forme de la grille : « a_verifier » reste à mesurer, avec ce qu'il faut regarder. */
export function enResultats(a: AuditEnLigne | null | undefined): Record<string, Resultat> {
  const out: Record<string, Resultat> = {};
  if (!a || a.statut !== "pret" || !a.resultat) return out;
  for (const x of a.resultat.resultats) {
    const points = x.points === "a_verifier" ? null : (Number(x.points) as 0 | 1 | 2);
    out[x.id] = {
      points,
      constat: x.constat,
      vu: x.vu,
      geste: points != null && points < 2 && x.geste_titre.trim() ? { titre: x.geste_titre, qui: x.geste_qui || "Toi", effort: x.geste_effort || "" } : undefined,
      question: points == null ? "Pas pu le vérifier en ligne : à regarder toi-même." : undefined,
      sources: x.sources,
    };
  }
  return out;
}

type Etat = "off" | "sans-compte" | "charge" | "pret" | "erreur";

interface Store {
  etat: Etat;
  donnees: EtatAudit | null;
  message: string | null;
  charger: () => Promise<void>;
  lancer: () => Promise<void>;
}

let suivi: ReturnType<typeof setTimeout> | null = null;

async function appel(methode: "GET" | "POST"): Promise<{ code: number; d: EtatAudit & { message?: string } }> {
  const s = getSession();
  const r = await fetch(`${AUDIT_API}/api/audit`, { method: methode, headers: s?.kind === "compte" ? { "X-BS-Token": s.token } : {}, credentials: "omit" });
  return { code: r.status, d: await r.json() };
}

export const useAuditEnLigne = create<Store>((set, get) => ({
  etat: "off",
  donnees: null,
  message: null,
  charger: async () => {
    if (!AUDIT_API) return set({ etat: "off" });
    if (getSession()?.kind !== "compte") return set({ etat: "sans-compte" });
    if (!get().donnees) set({ etat: "charge" });
    try {
      const { code, d } = await appel("GET");
      if (code !== 200) return set({ etat: "erreur", message: d.message ?? "L’audit en ligne ne répond pas." });
      set({ etat: "pret", donnees: { dernier: d.dernier, historique: d.historique }, message: null });
      // Un audit en cours : on relit toutes les 5 secondes, pour suivre ses étapes.
      if (suivi) clearTimeout(suivi);
      if (d.dernier?.statut === "en_cours") suivi = setTimeout(() => void get().charger(), 5000);
    } catch {
      set({ etat: "erreur", message: "L’audit en ligne ne répond pas. Réessaie dans un instant." });
    }
  },
  lancer: async () => {
    if (!AUDIT_API || getSession()?.kind !== "compte") return;
    try {
      const { code, d } = await appel("POST");
      if (code !== 202 && code !== 409) set({ message: d.message ?? "L’audit n’a pas pu partir." });
      else set({ message: null });
      set({ donnees: { dernier: d.dernier, historique: d.historique } });
      void get().charger();
    } catch {
      set({ message: "L’audit en ligne ne répond pas. Réessaie dans un instant." });
    }
  },
}));
