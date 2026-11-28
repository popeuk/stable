"use client";

import { appareil, charger, revConnue, TIROIRS } from "@/lib/account/nuage";

/**
 * Le canal de l'écurie (Supabase Realtime, diffusion « broadcast », événement
 * `rev`). Après chaque envoi accepté, la fonction `tiroirs` y diffuse
 * `{ nom, rev, appareil }`, jamais le contenu : les autres appareils de
 * l'équipe savent ainsi en une seconde qu'il faut relire la copie en ligne.
 *
 * Le canal est public (`private: false`) : quiconque a la clé publique et le
 * nom du canal peut y écrire. Un message n'est donc jamais cru sur parole :
 * il ne fait que déclencher une relecture du serveur (qui, lui, vérifie le
 * compte), il est validé et ignoré s'il ne dit rien de neuf, et les
 * relectures qu'il déclenche sont freinées (`freiner`).
 *
 * `@supabase/supabase-js` ne se charge (par `import()`) qu'une fois un canal
 * ouvert : il n'est jamais dans le paquet de l'Accueil.
 */
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ?? "https://wgvithqivsygsoeyqruz.supabase.co";
const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_e6R9yC-WtMe39sWuIWPKRw_vudSuE0o";

export interface MessageCanal {
  nom: string;
  rev: number;
  appareil: string;
}

/** Le minimum dont l'écoute a besoin, rempli par `@supabase/supabase-js` (ou par un faux dans les tests). */
export interface ClientCanal {
  channel(n: string): {
    on(type: "broadcast", filtre: { event: string }, rappel: (m: { payload?: unknown }) => void): unknown;
    subscribe(etat?: (e: string) => void): unknown;
    unsubscribe(): unknown;
  };
}

let clientPromis: Promise<ClientCanal | null> | null = null;
function chargerClient(): Promise<ClientCanal | null> {
  clientPromis ??= charger(() => import("@supabase/supabase-js"))
    .then(
      ({ createClient }) =>
        createClient(URL_SUPABASE, CLE_PUBLIQUE, {
          // Seulement le canal : aucune session Supabase gardée sur l'appareil.
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "bs-canal" },
        }) as unknown as ClientCanal,
    )
    .catch(() => {
      // Pas chargé : le navigateur ne retente pas ce morceau avant un rechargement de l'app.
      // `charger` l'a signalé (le bandeau propose de recharger) ; la relecture toutes les 2 minutes reste.
      return null;
    });
  return clientPromis;
}

/** Un message du canal, s'il a la bonne forme : un des deux tiroirs, une version entière positive, un appareil. */
export function lireMessage(brut: unknown): MessageCanal | null {
  if (!brut || typeof brut !== "object") return null;
  const m = brut as Record<string, unknown>;
  if (typeof m.nom !== "string" || !(TIROIRS as readonly string[]).includes(m.nom)) return null;
  if (typeof m.rev !== "number" || !Number.isInteger(m.rev) || m.rev <= 0) return null;
  if (typeof m.appareil !== "string") return null;
  return { nom: m.nom, rev: m.rev, appareil: m.appareil };
}

/**
 * Écoute le canal `nom` et prévient `surEcriture` quand un autre appareil a
 * écrit une version que cet appareil n'a pas encore. Ignore sans lever ce qui
 * est mal formé, ce que cet appareil vient d'envoyer, et toute version déjà
 * connue (inférieure ou égale). Rend la fonction qui ferme l'abonnement.
 *
 * `surReprise` est appelé quand l'abonnement revient après une coupure (tout
 * `SUBSCRIBED` sauf le premier) : les messages diffusés pendant la coupure
 * sont perdus, il faut relire.
 */
export function ecouterCanal(nom: string, surEcriture: (m: MessageCanal) => void, client?: ClientCanal, surReprise?: () => void): () => void {
  let ferme = false;
  let canal: ReturnType<ClientCanal["channel"]> | null = null;
  const ouvrir = (c: ClientCanal) => {
    if (ferme) return;
    try {
      canal = c.channel(nom);
      canal.on("broadcast", { event: "rev" }, (e) => {
        if (ferme) return;
        try {
          const m = lireMessage(e?.payload);
          if (!m || m.appareil === appareil() || m.rev <= revConnue(m.nom)) return;
          surEcriture(m);
        } catch {
          // Un message qui fait trébucher la lecture est ignoré : jamais d'erreur vers l'écran.
        }
      });
      let abonne = false;
      canal.subscribe((etat) => {
        if (ferme || etat !== "SUBSCRIBED") return;
        if (abonne) {
          try {
            surReprise?.();
          } catch {}
        }
        abonne = true;
      });
    } catch {
      canal = null;
    }
  };
  if (client) ouvrir(client);
  else
    void chargerClient().then((c) => {
      if (c) ouvrir(c);
    });
  return () => {
    if (ferme) return;
    ferme = true;
    try {
      canal?.unsubscribe();
    } catch {}
    canal = null;
  };
}

/**
 * Regroupe et freine les relectures déclenchées par le canal : au plus une
 * en cours, une seule en attente (les demandes suivantes s'y fondent), et
 * jamais deux départs à moins de `ecartMs`. Dix messages d'affilée donnent
 * une relecture, puis au plus une autre.
 */
export function freiner(relire: () => Promise<unknown>, ecartMs = 2000): { demander(): void; arreter(): void } {
  let enCours = false;
  let enAttente = false;
  let dernier = -Infinity;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let arrete = false;
  const lancer = () => {
    if (arrete || enCours || minuteur) return;
    const reste = dernier + ecartMs - Date.now();
    if (reste > 0) {
      minuteur = setTimeout(() => {
        minuteur = null;
        lancer();
      }, reste);
      return;
    }
    enAttente = false;
    enCours = true;
    dernier = Date.now();
    void Promise.resolve()
      .then(relire)
      .catch(() => {})
      .finally(() => {
        enCours = false;
        if (enAttente) lancer();
      });
  };
  return {
    demander() {
      if (arrete) return;
      enAttente = true;
      lancer();
    },
    arreter() {
      arrete = true;
      enAttente = false;
      if (minuteur) clearTimeout(minuteur);
      minuteur = null;
    },
  };
}

/**
 * Le seul abonnement de l'app. `brancherCanal(nom)` ferme l'ancien avant d'en
 * ouvrir un autre quand le canal change (autre écurie, autre espace
 * d'équipe), et n'écoute plus rien avec `null` (déconnexion, copie éteinte,
 * téléphone trop ancien).
 */
let courant: { nom: string; stop: () => void } | null = null;
export function brancherCanal(nom: string | null, surEcriture: (m: MessageCanal) => void, client?: ClientCanal, surReprise?: () => void): void {
  if (courant?.nom === nom) return;
  courant?.stop();
  courant = null;
  if (nom) courant = { nom, stop: ecouterCanal(nom, surEcriture, client, surReprise) };
}
export function canalBranche(): string | null {
  return courant?.nom ?? null;
}
