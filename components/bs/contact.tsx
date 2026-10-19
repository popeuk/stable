"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { routesSite } from "@/lib/account/demandes";

/**
 * « Contact » (décision 11) : un message à l'équipe Be Stable, envoyé par
 * mon-ecurie.fr (pc-bestable 1.5.0) à contact@bestable.fr. Il part avec ce
 * qui aide à répondre : l'écran, la version de l'app, le navigateur et
 * l'appareil. Jamais un chiffre de l'écurie.
 *
 * Tant que le site n'a pas la route (404), le bouton n'apparaît pas.
 */
export const CONTACT_EMAIL = "contact@bestable.fr";
export const VERSION_APP = (process.env.NEXT_PUBLIC_VERSION ?? "").slice(0, 12) || "dev";

/** La feuille ne se charge qu'au moment où on l'ouvre (components/bs/contact-feuille.tsx). */
const ContactFeuille = dynamic(() => import("@/components/bs/contact-feuille").then((m) => m.ContactFeuille), { ssr: false });

/** L'appareil, en quelques mots : pas d'empreinte, juste de quoi reproduire un souci. */
export function appareilEnMots(): string {
  if (typeof window === "undefined") return "";
  const nav = navigator as Navigator & { standalone?: boolean };
  const installee = window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
  const tactile = navigator.maxTouchPoints > 0;
  return [`écran ${window.screen.width} × ${window.screen.height}`, `fenêtre ${window.innerWidth} × ${window.innerHeight}`, tactile ? "tactile" : "souris", installee ? "app installée" : "dans le navigateur", navigator.language].join(", ");
}

/** Le lien e-mail de repli : l'adresse écrite en entier, et un lien qui ouvre la messagerie. */
export const MAILTO_CONTACT = `mailto:${CONTACT_EMAIL}`;
export const TEXTE_REPLI = `Écris-nous : ${CONTACT_EMAIL}`;

/**
 * Le bouton qui ouvre Contact, s'il y a lieu : `render` dessine le bouton
 * (ligne de Réglages, lien de l'aide). Quand le site n'a pas la route
 * (pc-bestable avant 1.5.0), `repli` s'affiche à la place : l'adresse
 * e-mail, en texte et en lien.
 */
export function ContactOuvrir({ render, ecran, repli }: { render: (ouvrir: () => void) => ReactNode; ecran?: string; repli?: ReactNode }) {
  // null : on ne sait pas encore (rien n'apparaît) ; false : pas de route, le repli.
  const [dispo, setDispo] = useState<boolean | null>(null);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    let fini = false;
    // Hors ligne (null) : le bouton reste, l'envoi dira quoi faire.
    void routesSite().then((r) => !fini && setDispo(r !== false));
    return () => {
      fini = true;
    };
  }, []);
  if (dispo === null) return null;
  if (!dispo) return <>{repli ?? null}</>;
  return (
    <>
      {render(() => setOuvert(true))}
      {ouvert && <ContactFeuille onClose={() => setOuvert(false)} ecran={ecran} />}
    </>
  );
}
