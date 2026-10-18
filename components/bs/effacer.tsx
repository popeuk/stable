"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Ic } from "@/components/carnet/ui";
import { useFeuille } from "@/components/bs/feuille";
import { api } from "@/lib/account/api";
import { envoyer } from "@/lib/account/nuage";
import { getSession, leave } from "@/lib/account/session";
import { effacerLocale } from "@/lib/account/vault";
import { ecurieEffacee, JOURS_RECUPERATION, mettreDeCote, recupererEcurie } from "@/lib/account/effacement";
import { cetAppareil } from "@/lib/appareil";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Se déconnecter, effacer (décision 9 du 18 octobre). Avec un compte, deux
 * gestes bien distincts : « Me déconnecter de ce téléphone » (rien n'est
 * perdu) et « Effacer mon écurie partout » (le téléphone, les autres
 * appareils, la copie en ligne), avec une sauvegarde proposée d'abord et
 * récupérable 7 jours. Sans compte : « Effacer l'essai ». Dans la démo :
 * l'écurie d'exemple revient. Chaque fois, la confirmation est une feuille
 * de l'app (pas une fenêtre du navigateur).
 */

/** Ce qui attend part d'abord en ligne, puis on quitte ce téléphone. Rien n'est effacé. */
export async function deconnecter() {
  await envoyer().catch(() => {});
  try {
    await api.deconnexion();
  } catch {}
  leave("/compte/connexion");
}

type Feuille = "deconnexion" | "effacer" | "essai" | "demo" | null;

/** La fin de « Tes données » : les gestes qui déconnectent ou effacent, selon la session. */
export function ZoneEffacer({ exporter }: { exporter: () => void }) {
  const [kind, setKind] = useState<"compte" | "locale" | "demo" | null>(null);
  const [ouverte, setOuverte] = useState<Feuille>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKind(getSession()?.kind ?? null);
  }, []);
  if (!kind) return null;
  return (
    <div className="ec-danger">
      {kind === "compte" && (
        <>
          <button type="button" className="btn line" onClick={() => setOuverte("deconnexion")}>
            Me déconnecter de {cetAppareil()}
          </button>
          <small>Rien n’est perdu : ta copie en ligne reste.</small>
          <button type="button" className="btn danger" style={{ marginTop: 14 }} onClick={() => setOuverte("effacer")}>
            <Ic n="trash" className="" />
            Effacer mon écurie partout
          </button>
          <small>Ce téléphone, ton ordinateur et ta copie en ligne. On te le redemande avant.</small>
        </>
      )}
      {kind === "locale" && (
        <>
          <button type="button" className="btn danger" onClick={() => setOuverte("essai")}>
            <Ic n="trash" className="" />
            Effacer l’essai
          </button>
          <small>Ton essai disparaît de {cetAppareil()}. On te le redemande avant.</small>
        </>
      )}
      {kind === "demo" && (
        <>
          <button type="button" className="btn danger" onClick={() => setOuverte("demo")}>
            <Ic n="trash" className="" />
            Tout effacer et recommencer
          </button>
          <small>Dans la démo, l’écurie d’exemple revient telle qu’au départ.</small>
        </>
      )}
      {ouverte === "deconnexion" && <FeuilleDeconnexion onClose={() => setOuverte(null)} />}
      {ouverte === "effacer" && <FeuilleEffacer exporter={exporter} onClose={() => setOuverte(null)} />}
      {ouverte === "essai" && <FeuilleEssai onClose={() => setOuverte(null)} />}
      {ouverte === "demo" && <FeuilleDemo onClose={() => setOuverte(null)} />}
    </div>
  );
}

/** Une feuille de confirmation de l'app, rendue dans document.body (iPhone). */
export function FeuilleConfirmer({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  const ref = useFeuille(onClose, { verrou: true });
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="alertdialog" aria-modal="true" aria-label={titre} ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b>{titre}</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div style={{ display: "grid", gap: 10, paddingBottom: 8 }}>{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FeuilleDeconnexion({ onClose }: { onClose: () => void }) {
  const [enCours, setEnCours] = useState(false);
  return (
    <FeuilleConfirmer titre={`Me déconnecter de ${cetAppareil()}`} onClose={onClose}>
      <p className="note">Rien n’est perdu : ton écurie reste dans ta copie en ligne, protégée. Ton e-mail suffit pour la retrouver ici ou ailleurs.</p>
      <button
        type="button"
        className="btn full"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          await deconnecter();
        }}
      >
        Me déconnecter
      </button>
      <button type="button" className="btn line full" onClick={onClose}>
        Rester connecté
      </button>
    </FeuilleConfirmer>
  );
}

function FeuilleEffacer({ exporter, onClose }: { exporter: () => void; onClose: () => void }) {
  const router = useRouter();
  const say = useUiStore((x) => x.say);
  const [sauve, setSauve] = useState(false);
  const [enCours, setEnCours] = useState(false);
  return (
    <FeuilleConfirmer titre="Effacer mon écurie partout" onClose={onClose}>
      <p className="note" style={{ marginTop: 0 }}>
        <b>Ton écurie sera effacée sur {cetAppareil()}, sur tes autres appareils et dans ta copie en ligne.</b> Les chevaux, les clients, les séances, les frais : tout repart de zéro.
      </p>
      <p className="note">Fais d’abord une sauvegarde : un fichier à garder, qui se reprend dans Réglages, Avancé. Tu pourras aussi récupérer l’écurie d’avant sur {cetAppareil()} pendant {JOURS_RECUPERATION} jours.</p>
      <button
        type="button"
        className="btn line full"
        onClick={() => {
          exporter();
          setSauve(true);
        }}
      >
        <Ic n="download" className="" />
        Faire une sauvegarde
      </button>
      {sauve && <p className="note">La sauvegarde est dans tes téléchargements.</p>}
      <button
        type="button"
        className="btn danger full"
        disabled={enCours}
        onClick={async () => {
          setEnCours(true);
          await mettreDeCote();
          useDataStore.getState().startEmpty();
          useSettingsStore.getState().resetParcours();
          say(`Ton écurie est effacée. Tu peux la récupérer pendant ${JOURS_RECUPERATION} jours dans Réglages, Avancé.`);
          router.push("/bienvenue");
        }}
      >
        <Ic n="trash" className="" />
        Effacer mon écurie partout
      </button>
      <button type="button" className="btn line full" onClick={onClose}>
        Annuler
      </button>
    </FeuilleConfirmer>
  );
}

function FeuilleEssai({ onClose }: { onClose: () => void }) {
  return (
    <FeuilleConfirmer titre="Effacer l’essai" onClose={onClose}>
      <p className="note" style={{ marginTop: 0 }}>Ton essai sera effacé de {cetAppareil()}, et tu repars du début. Rien n’est gardé ailleurs.</p>
      <button
        type="button"
        className="btn danger full"
        onClick={() => {
          effacerLocale();
          leave("/bienvenue");
        }}
      >
        <Ic n="trash" className="" />
        Effacer l’essai
      </button>
      <button type="button" className="btn line full" onClick={onClose}>
        Annuler
      </button>
    </FeuilleConfirmer>
  );
}

function FeuilleDemo({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <FeuilleConfirmer titre="Tout effacer et recommencer" onClose={onClose}>
      <p className="note" style={{ marginTop: 0 }}>Ce que tu as noté s’efface, et l’écurie d’exemple revient telle qu’au départ.</p>
      <button
        type="button"
        className="btn danger full"
        onClick={() => {
          useDataStore.getState().resetToDemo();
          useSettingsStore.getState().setIdentity({ stableName: "Les Trois Pommiers" });
          router.push("/bienvenue");
        }}
      >
        <Ic n="trash" className="" />
        Tout effacer
      </button>
      <button type="button" className="btn line full" onClick={onClose}>
        Annuler
      </button>
    </FeuilleConfirmer>
  );
}

/** Juste après « Effacer mon écurie partout », pendant 7 jours : la ligne pour revenir en arrière. */
export function RecupererLigne() {
  const [eff, setEff] = useState<{ quand: string } | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEff(ecurieEffacee());
  }, []);
  if (!eff) return null;
  const jour = new Date(eff.quand).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return (
    <>
      <button type="button" className="li np" onClick={() => setOuverte(true)}>
        <span>
          <b>Tu as effacé ton écurie le {jour}.</b>
          <small>Récupérer l’écurie d’avant</small>
        </span>
        <Ic n="chev" className="chev" />
      </button>
      {ouverte && (
        <FeuilleConfirmer titre="Récupérer l’écurie d’avant" onClose={() => setOuverte(false)}>
          <p className="note" style={{ marginTop: 0 }}>L’écurie d’avant le {jour} revient sur {cetAppareil()}, puis dans ta copie en ligne et sur tes autres appareils. Ce que tu as noté depuis l’effacement est remplacé.</p>
          <button
            type="button"
            className="btn full"
            disabled={enCours}
            onClick={async () => {
              setEnCours(true);
              const ok = await recupererEcurie();
              if (ok) window.location.reload();
              else setEnCours(false);
            }}
          >
            Récupérer l’écurie d’avant
          </button>
          <button type="button" className="btn line full" onClick={() => setOuverte(false)}>
            Annuler
          </button>
        </FeuilleConfirmer>
      )}
    </>
  );
}

/** Dans Mon compte : la même déconnexion, en ligne de réglage. */
export function DeconnexionLigne() {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <button type="button" className="li np" onClick={() => setOuverte(true)}>
        <span>
          <b>Me déconnecter de {cetAppareil()}</b>
          <small>rien n’est perdu, ta copie en ligne reste</small>
        </span>
        <span />
      </button>
      {ouverte && <FeuilleDeconnexion onClose={() => setOuverte(false)} />}
    </>
  );
}
