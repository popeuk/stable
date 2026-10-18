"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import { useFeuille } from "@/components/bs/feuille";
import { api, ApiError } from "@/lib/account/api";
import { routesSite } from "@/lib/account/demandes";
import { getSession } from "@/lib/account/session";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * « Contact » (décision 11) : un message à l'équipe Be Stable, envoyé par
 * mon-ecurie.fr (pc-bestable 1.5.0) à contact@bestable.fr. Il part avec ce
 * qui aide à répondre : l'écran, la version de l'app, le navigateur et
 * l'appareil. Jamais un chiffre de l'écurie.
 *
 * Tant que le site n'a pas la route (404), le bouton n'apparaît pas.
 */
export const CONTACT_EMAIL = "contact@bestable.fr";
const VERSION = (process.env.NEXT_PUBLIC_VERSION ?? "").slice(0, 12) || "dev";

/** L'appareil, en quelques mots : pas d'empreinte, juste de quoi reproduire un souci. */
export function appareilEnMots(): string {
  if (typeof window === "undefined") return "";
  const nav = navigator as Navigator & { standalone?: boolean };
  const installee = window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
  const tactile = navigator.maxTouchPoints > 0;
  return [`écran ${window.screen.width} × ${window.screen.height}`, `fenêtre ${window.innerWidth} × ${window.innerHeight}`, tactile ? "tactile" : "souris", installee ? "app installée" : "dans le navigateur", navigator.language].join(", ");
}

/** Le bouton qui ouvre Contact, s'il y a lieu : `render` dessine le bouton (ligne de Réglages, lien de l'aide). */
export function ContactOuvrir({ render, ecran }: { render: (ouvrir: () => void) => ReactNode; ecran?: string }) {
  const [dispo, setDispo] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    let fini = false;
    // Hors ligne (null) : le bouton reste, l'envoi dira quoi faire.
    void routesSite().then((r) => !fini && setDispo(r !== false));
    return () => {
      fini = true;
    };
  }, []);
  if (!dispo) return null;
  return (
    <>
      {render(() => setOuvert(true))}
      {ouvert && <ContactFeuille onClose={() => setOuvert(false)} ecran={ecran} />}
    </>
  );
}

export function ContactFeuille({ onClose, ecran }: { onClose: () => void; ecran?: string }) {
  const ref = useFeuille(onClose, { verrou: true });
  const path = usePathname() ?? "";
  const stableName = useSettingsStore((s) => s.stableName);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye">("saisie");
  const [err, setErr] = useState<ReactNode>("");
  const [compte] = useState(() => getSession()?.kind === "compte");

  async function envoyer() {
    if (etat === "envoi" || message.trim().length < 2) return;
    setEtat("envoi");
    setErr("");
    try {
      await api.contact({
        message: message.trim(),
        ...(compte ? {} : { email: email.trim() }),
        ecran: ecran ?? path,
        version: VERSION,
        navigateur: navigator.userAgent,
        appareil: appareilEnMots(),
        ecurie: stableName && stableName !== "Mon écurie" ? stableName : undefined,
      });
      setEtat("envoye");
    } catch (e) {
      setEtat("saisie");
      const repli = (
        <>
          {" "}
          Tu peux aussi écrire à <a href={`mailto:${CONTACT_EMAIL}?body=${encodeURIComponent(message.trim())}`}>{CONTACT_EMAIL}</a>.
        </>
      );
      setErr(
        <>
          {e instanceof ApiError && e.status && e.status !== 404 ? e.message : "Le message n’est pas parti."}
          {repli}
        </>,
      );
    }
  }

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="ct-t" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b id="ct-t">Contact</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            {etat === "envoye" ? (
              <div className="ct-ok" role="status">
                <b>{compte || email.trim() ? "C’est envoyé. On te répond par e-mail." : "C’est envoyé. Merci, on lit tout."}</b>
                <button type="button" className="btn full" onClick={onClose}>
                  Fermer
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void envoyer();
                }}
              >
                <p className="note" style={{ marginTop: 0 }}>
                  Une question, un souci, une idée : écris-nous, on lit tout.
                </p>
                <label className="field">
                  <span>Ton message</span>
                  <textarea className="input ta ct-ta" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={6} />
                </label>
                {!compte && (
                  <label className="field">
                    <span>Ton e-mail, pour te répondre (facultatif)</span>
                    <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" />
                  </label>
                )}
                <p className="note">Part avec ton message : l’écran où tu es, la version de l’app, ton navigateur et ton modèle de téléphone ou d’ordinateur. Aucun chiffre de ton écurie.</p>
                {err && (
                  <p className="ct-err" role="alert">
                    {err}
                  </p>
                )}
                <button type="submit" className="btn full" style={{ marginTop: 12 }} disabled={etat === "envoi" || message.trim().length < 2}>
                  {etat === "envoi" ? "Envoi…" : "Envoyer"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
