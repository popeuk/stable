"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/carnet/ui";
import { useFeuille } from "@/components/bs/feuille";
import { ApiError, type Fiche } from "@/lib/account/api";
import { useMaFiche } from "@/lib/account/ma-fiche";
import { jaugeFiche, PRESENTATION_MIN } from "@/lib/fiche-jauge";
import { useUiStore } from "@/stores/ui-store";
import "@/app/carnet/ecurie.css";
import "@/app/carnet/briques.css";

/**
 * La feuille d'une question (27 octobre 2026) : le pas du chemin s'ouvre
 * par-dessus l'accueil, une question à la fois ; le gérant y revient sans
 * changer d'onglet. Enregistré, la réponse part sur bestable.fr, la jauge
 * monte et un flot tombe. Le reste de la fiche se modifie dans Vitrine.
 */
export type Question = "places" | "prix" | "propose" | "presentation" | "contact";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

export function FeuilleQuestion({ q, onClose }: { q: Question; onClose: () => void }) {
  const ref = useFeuille(onClose, { verrou: true });
  const fiche = useMaFiche((s) => s.fiche);
  const choix = useMaFiche((s) => s.choix);
  const enregistrer = useMaFiche((s) => s.enregistrer);
  const say = useUiStore((s) => s.say);
  const [etape, setEtape] = useState<Question>(q);
  const [f, setF] = useState<Fiche | null>(fiche);
  const [busy, setBusy] = useState(false);
  if (!f) return null;
  const set = (p: Partial<Fiche>) => setF({ ...f, ...p });
  const toggle = (k: "offres" | "hebergement" | "installations" | "services", v: string) => set({ [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] } as Partial<Fiche>);
  // Les places et le prix vont ensemble : deux questions, la seconde enregistre les deux.
  const deux = q === "places";
  const suite = deux && etape === "places";

  async function valider() {
    if (!f || busy) return;
    if (suite) return setEtape("prix");
    setBusy(true);
    try {
      const avant = fiche ? jaugeFiche(fiche).n : 0;
      const r = await enregistrer(f);
      const j = jaugeFiche(r);
      say(
        r.en_attente
          ? "C’est gardé. Ça apparaîtra sur ta fiche dès qu’elle sera à ton nom."
          : j.n > avant
            ? `<strong>Un flot de plus.</strong> Ta fiche : ${j.n} sur ${j.total}.`
            : "C’est sur ta fiche bestable.fr.",
      );
      onClose();
    } catch (e) {
      say(e instanceof ApiError ? esc(e.message) : "Ce n’est pas enregistré. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  const titres: Record<Question, [string, string]> = {
    places: ["Combien de places libres ?", "Le chiffre le plus regardé par les propriétaires. La date de mise à jour s’affiche."],
    prix: ["La pension, à partir de combien ?", "Le prix le plus bas, par mois. Le détail de tes formules se règle dans Vitrine."],
    propose: ["Ce que tu proposes", "Coche ce qui est vrai chez toi : ces informations servent aux filtres de recherche des cavaliers."],
    presentation: ["Ta présentation", "Quelques lignes sur ton écurie : le cadre, la vie des chevaux, ce qui la rend différente."],
    contact: ["Comment te joindre ?", "Les demandes des cavaliers arrivent à ton e-mail. Le téléphone est facultatif."],
  };
  const [titre, sous] = titres[etape];
  const places = Number(f.places_libres || 0);

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet bq-fq" role="dialog" aria-modal="true" aria-labelledby="fq-t" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <span className="bq-fq-n">{deux ? `${etape === "places" ? 1 : 2} sur 2` : "Ta fiche"}</span>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            <h2 id="fq-t" className="bq-fq-t">
              {titre}
            </h2>
            <p className="bq-fq-s">{sous}</p>

            {etape === "places" && (
              <>
                <div className="bq-pls">
                  <button type="button" aria-label="Une place de moins" onClick={() => set({ places_libres: String(Math.max(0, places - 1)) })}>
                    −
                  </button>
                  <b aria-live="polite">{f.places_libres === "" ? "?" : places}</b>
                  <button type="button" className="p" aria-label="Une place de plus" onClick={() => set({ places_libres: String(places + 1) })}>
                    +
                  </button>
                </div>
                <div className="chips bq-fq-ch">
                  <button type="button" className="chip" aria-pressed={f.places_libres === "0"} onClick={() => set({ places_libres: "0" })}>
                    Complet
                  </button>
                  <button type="button" className="chip" aria-pressed={f.places_libres === ""} onClick={() => set({ places_libres: "" })}>
                    Je préfère ne pas l’indiquer
                  </button>
                </div>
              </>
            )}

            {etape === "prix" && (
              <label className="field">
                <span>Pension à partir de</span>
                <span className="bq-fq-in">
                  <input inputMode="numeric" value={f.prix_min} placeholder="280" onChange={(e) => set({ prix_min: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
                  <i>€ / mois</i>
                </span>
              </label>
            )}

            {etape === "propose" &&
              choix &&
              (
                [
                  ["offres", "Activités"],
                  ["hebergement", "Hébergement"],
                  ["installations", "Installations"],
                  ["services", "Services compris ou proposés"],
                ] as const
              ).map(([k, l]) => (
                <div key={k} className="ec-cg" role="group" aria-label={l}>
                  <span>{l}</span>
                  <div className="chips">
                    {Object.entries(choix[k]).map(([v, lab]) => (
                      <button key={v} type="button" className="chip" aria-pressed={f[k].includes(v)} onClick={() => toggle(k, v)}>
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

            {etape === "presentation" && (
              <label className="field">
                <span>Présentation</span>
                <textarea rows={6} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ce qui fait ton écurie : le cadre, les prés, la vie des chevaux…" />
                <em className="bq-fq-c">{f.description.trim().length < PRESENTATION_MIN ? `Encore ${PRESENTATION_MIN - f.description.trim().length} signes pour une présentation complète.` : "C’est parfait."}</em>
              </label>
            )}

            {etape === "contact" && (
              <>
                <label className="field">
                  <span>E-mail des demandes</span>
                  <input type="email" inputMode="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
                  <em className="bq-fq-c">Les demandes des cavaliers arrivent à cette adresse. Elle n’est pas affichée sur ta fiche.</em>
                </label>
                <label className="field">
                  <span>Téléphone affiché (facultatif)</span>
                  <input type="tel" inputMode="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} />
                  <em className="bq-fq-c">Visible sur ta fiche. Laisse vide pour recevoir seulement des demandes écrites.</em>
                </label>
              </>
            )}

            <button type="button" className="btn full bq-fq-go" onClick={valider} disabled={busy}>
              {suite ? "Continuer" : "Enregistrer sur ma fiche"}
              <Ic n={suite ? "arrow" : "ck"} className="" />
            </button>
            <Link href="/ma-fiche" className="lnk bq-fq-l" onClick={onClose}>
              Voir toute ma fiche
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
