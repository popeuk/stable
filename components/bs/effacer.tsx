"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "@/components/carnet/ui";
import { FeuilleConfirmer } from "@/components/bs/feuille-confirmer";
import { api } from "@/lib/account/api";
import { envoyer } from "@/lib/account/nuage";
import { getSession, leave } from "@/lib/account/session";
import { effacerLocale } from "@/lib/account/vault";
import { ecurieEffacee, JOURS_RECUPERATION, mettreDeCote, recupererEcurie } from "@/lib/account/effacement";
import { cetAppareil } from "@/lib/appareil";
import { facturesDeLEssai, issueEffacement, messageEfface, ouEfface, texteSansCopie } from "@/lib/account/effacer-textes";
import { CONTACT_EMAIL, VERSION_APP, appareilEnMots } from "@/components/bs/contact";
import { SAUVEGARDE_NON_PROTEGEE } from "@/lib/sauvegarde";
import { MESSAGE_SUPPRESSION_FAITE, demandeSuppression, demanderLaSuppression, mailtoSuppression } from "@/lib/account/suppression";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import "@/app/carnet/ecurie.css";

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
          <small>{ouEfface()}</small>
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
      {ouverte === "essai" && <FeuilleEssai exporter={exporter} onClose={() => setOuverte(null)} />}
      {ouverte === "demo" && <FeuilleDemo onClose={() => setOuverte(null)} />}
    </div>
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
        Annuler
      </button>
    </FeuilleConfirmer>
  );
}

function FeuilleEffacer({ exporter, onClose }: { exporter: () => void; onClose: () => void }) {
  const router = useRouter();
  const say = useUiStore((x) => x.say);
  const [sauve, setSauve] = useState(false);
  const [enCours, setEnCours] = useState(false);
  // La copie de secours n'a pas pu être gardée (place pleine) : on ne promet plus la récupération.
  const [sansCopie, setSansCopie] = useState(false);
  const avecFactures = useDataStore((s) => (s.invoices ?? []).length > 0);
  const effacer = (issue: "recuperable" | "sans-copie") => {
    useDataStore.getState().startEmpty();
    useSettingsStore.getState().resetParcours();
    say(messageEfface(issue, JOURS_RECUPERATION, sauve));
    router.push("/bienvenue");
  };
  const issue = issueEffacement({ misDeCote: false, sauve, confirme: false });
  return (
    <FeuilleConfirmer titre="Effacer mon écurie partout" onClose={onClose}>
      <p className="note" style={{ marginTop: 0 }}>
        <b>Ton écurie sera effacée sur {cetAppareil()}, sur tes autres téléphones et ordinateurs, et dans ta copie en ligne.</b> Les chevaux, les clients, les séances, les frais{avecFactures ? ", et tes factures" : ""} : tout repart de zéro.{avecFactures ? " Une facture se garde 10 ans : fais d’abord une sauvegarde." : ""}
      </p>
      {sansCopie ? (
        <p className="note" role="alert">
          <b>{texteSansCopie()}</b>
        </p>
      ) : (
        <p className="note">Fais d’abord une sauvegarde : un fichier à garder, que tu pourras rouvrir dans Réglages, Avancé (« Ouvrir une sauvegarde »). Tu pourras aussi récupérer l’écurie d’avant sur {cetAppareil()} pendant {JOURS_RECUPERATION} jours.</p>
      )}
      <button
        type="button"
        className={sansCopie && !sauve ? "btn full" : "btn line full"}
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
        disabled={enCours || (sansCopie && issue === "attendre")}
        onClick={async () => {
          setEnCours(true);
          if (sansCopie) return effacer("sans-copie");
          const garde = await mettreDeCote();
          const suite = issueEffacement({ misDeCote: garde, sauve, confirme: false });
          if (suite === "attendre") {
            // Rien de gardé ici et pas de sauvegarde : on n'efface pas, on le dit.
            setSansCopie(true);
            setEnCours(false);
            return;
          }
          effacer(suite);
        }}
      >
        <Ic n="trash" className="" />
        Effacer mon écurie partout
      </button>
      {sansCopie && !sauve && (
        <button type="button" className="btn line full" disabled={enCours} onClick={() => effacer(issueEffacement({ misDeCote: false, sauve, confirme: true }) as "sans-copie")}>
          Effacer quand même, sans copie de secours
        </button>
      )}
      <button type="button" className="btn line full" onClick={onClose}>
        Annuler
      </button>
    </FeuilleConfirmer>
  );
}

function FeuilleEssai({ exporter, onClose }: { exporter: () => void; onClose: () => void }) {
  const factures = facturesDeLEssai(useDataStore((s) => s.invoices));
  const [sauve, setSauve] = useState(false);
  return (
    <FeuilleConfirmer titre="Effacer l’essai" onClose={onClose}>
      <p className="note" style={{ marginTop: 0 }}>Ton essai sera effacé de {cetAppareil()}, et tu repars du début. Rien n’est gardé ailleurs.</p>
      {factures && (
        <>
          <p className="note">
            <b>{factures}</b>
          </p>
          <button
            type="button"
            className="btn full"
            onClick={() => {
              exporter();
              setSauve(true);
            }}
          >
            <Ic n="download" className="" />
            Faire une sauvegarde
          </button>
          {sauve && <p className="note">La sauvegarde est dans tes téléchargements.</p>}
        </>
      )}
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
  const [rate, setRate] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEff(ecurieEffacee());
  }, []);
  if (!eff) return null;
  const jour = new Date(eff.quand).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const limite = new Date(Date.parse(eff.quand) + JOURS_RECUPERATION * 86_400_000).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return (
    <>
      <button type="button" className="li np" onClick={() => setOuverte(true)}>
        <span>
          <b>Tu as effacé ton écurie le {jour}.</b>
          <small>Récupérer l’écurie d’avant, jusqu’au {limite}</small>
        </span>
        <Ic n="chev" className="chev" />
      </button>
      {ouverte && (
        <FeuilleConfirmer titre="Récupérer l’écurie d’avant" onClose={() => setOuverte(false)}>
          <p className="note" style={{ marginTop: 0 }}>L’écurie d’avant le {jour} revient sur {cetAppareil()}, puis dans ta copie en ligne et sur tes autres téléphones et ordinateurs. Ce que tu as noté depuis l’effacement est remplacé, sauf tes factures et tes avoirs : ils restent, et leurs numéros continuent à la suite.</p>
          <button
            type="button"
            className="btn full"
            disabled={enCours}
            onClick={async () => {
              setEnCours(true);
              const ok = await recupererEcurie();
              if (ok) window.location.reload();
              else {
                setEnCours(false);
                setRate(true);
              }
            }}
          >
            Récupérer l’écurie d’avant
          </button>
          {rate && (
            <p className="note" role="alert">
              La place manque sur {cetAppareil()} pour la remettre. Rien n’a changé : fais une sauvegarde, puis écris-nous.
            </p>
          )}
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

/** Réglages, Mon compte : « Supprimer mon compte » (lib/account/suppression). */
export function SuppressionLigne({ exporter }: { exporter: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <button type="button" className="li np" onClick={() => setOuverte(true)}>
        <span>
          <b>Supprimer mon compte</b>
          <small>ton compte et ta copie en ligne, sous 30 jours</small>
        </span>
        <span />
      </button>
      {ouverte && <FeuilleSuppression exporter={exporter} onClose={() => setOuverte(false)} />}
    </>
  );
}

function FeuilleSuppression({ exporter, onClose }: { exporter: () => void; onClose: () => void }) {
  const stableName = useSettingsStore((x) => x.stableName);
  const [sauve, setSauve] = useState(false);
  const [etat, setEtat] = useState<"avant" | "envoi" | "demandee" | "repli">("avant");
  const [err, setErr] = useState("");
  // La session lue à l'ouverture : la demande partie, elle n'existe plus, la feuille reste pour le dire.
  const [s] = useState(getSession);
  if (s?.kind !== "compte") return null;
  const ecurie = stableName && stableName !== "Mon écurie" ? stableName : undefined;
  // La demande est partie et l'appareil effacé : fermer, c'est quitter.
  const fermer = etat === "demandee" ? () => leave("/bienvenue") : onClose;
  const supprimer = async () => {
    setEtat("envoi");
    setErr("");
    const r = await demanderLaSuppression(
      s,
      () => api.contact(demandeSuppression(s, { ecran: "/moi?s=compte", version: VERSION_APP, navigateur: navigator.userAgent, appareil: appareilEnMots(), ecurie })),
      { deconnexion: () => api.deconnexion() },
    );
    if (r.issue === "erreur") {
      setEtat("avant");
      setErr(r.message ?? "");
    } else setEtat(r.issue);
  };
  return (
    <FeuilleConfirmer titre="Supprimer mon compte" onClose={fermer}>
      {etat === "demandee" ? (
        <>
          <p className="note" role="status" style={{ marginTop: 0 }}>
            <b>{MESSAGE_SUPPRESSION_FAITE}</b>
          </p>
          <button type="button" className="btn full" onClick={fermer}>
            Fermer
          </button>
        </>
      ) : etat === "repli" ? (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            La demande ne part pas d’ici pour l’instant. Écris-nous à <b>{CONTACT_EMAIL}</b> : le message est prêt, envoie-le depuis ton adresse {s.email}. Rien n’est effacé avant.
          </p>
          <a className="btn full" href={mailtoSuppression(s, ecurie)}>
            Écrire à {CONTACT_EMAIL}
          </a>
          <button type="button" className="btn line full" onClick={onClose}>
            Fermer
          </button>
        </>
      ) : (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            <b>Ton compte et ta copie en ligne seront supprimés.</b> Garde tes factures dix ans : la loi le demande. Fais d’abord une sauvegarde, elle les contient.
          </p>
          <button
            type="button"
            className={sauve ? "btn line full" : "btn full"}
            onClick={() => {
              exporter();
              setSauve(true);
            }}
          >
            <Ic n="download" className="" />
            Faire une sauvegarde
          </button>
          <p className="note">{sauve ? "La sauvegarde est dans tes téléchargements. " : ""}{SAUVEGARDE_NON_PROTEGEE}</p>
          {err && (
            <p className="note" role="alert">
              {err}
            </p>
          )}
          <button type="button" className="btn danger full" disabled={etat === "envoi"} onClick={() => void supprimer()}>
            {etat === "envoi" ? "Envoi…" : "Oui, supprimer mon compte"}
          </button>
          <button type="button" className="btn line full" onClick={onClose}>
            Annuler
          </button>
        </>
      )}
    </FeuilleConfirmer>
  );
}
