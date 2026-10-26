"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, withBase } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { useFeuille } from "@/components/bs/feuille";
import { VERSION_APP, appareilEnMots, CONTACT_EMAIL } from "@/components/bs/contact";
import { Empty, Hello, Ic, Sec } from "@/components/carnet/ui";
import { api, ApiError, type Choix, type Fiche } from "@/lib/account/api";
import { getSession } from "@/lib/account/session";
import { INCLUS, NOM_FORMULE, NOM_METIER, PRIX, PRIX_DOMAINE, accroche, adresseOfferte, euros, lienPaiement, messageDemande, metierDe, prixDit, type Formule, type Metier, type Rythme } from "@/lib/mon-site";
import "@/app/carnet/ecurie.css";
import "@/app/carnet/mon-site.css";

/**
 * Mon site : le site de l'écurie, déjà fait à partir de sa fiche bestable.fr,
 * et l'offre pour le mettre en ligne (agence des écuries, 26 octobre 2026).
 * L'aperçu remplace l'essai gratuit : le gérant voit son site avant de payer.
 */
export default function Page() {
  return (
    <ClientGate>
      <MonSite />
    </ClientGate>
  );
}

/** L'écurie d'exemple : une fiche inventée, dite comme telle. */
const EXEMPLE: Fiche = {
  title: "Écurie du Grand Pré",
  description: "Des chevaux au pré toute l’année, rentrés au box par mauvais temps. Une carrière, un rond de longe et des chemins au départ de l’écurie.",
  adresse: "",
  code_postal: "14130",
  commune: "Pont-l’Évêque",
  telephone: "06 00 00 00 00",
  email: "",
  site: "",
  offres: ["pension"],
  hebergement: [],
  installations: [],
  services: [],
  prix_min: "",
  places_libres: "2",
  formules: [
    { nom: "Pré toute l’année", description: "", prix: "220", places: "2" },
    { nom: "Box et paddock", description: "", prix: "390", places: "0" },
  ],
  photos: [{ id: 1, url: withBase("/img/carnet/accueil-premier.webp") }],
};

function Seul({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <div className="ec-pg">{children}</div>
    </Screen>
  );
}

function MonSite() {
  const s = getSession();
  const desk = useDesk();
  const demo = s?.kind === "demo";
  const [f, setF] = useState<Fiche | null>(demo ? EXEMPLE : null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [etat, setEtat] = useState<"charge" | "aucune" | "erreur" | "ok">(() => (demo ? "ok" : s?.kind === "compte" ? "charge" : "aucune"));
  const [formule, setFormule] = useState<Formule>("site");
  const [rythme, setRythme] = useState<Rythme>("mois");
  const [domaine, setDomaine] = useState(false);
  const [demande, setDemande] = useState(false);

  useEffect(() => {
    if (s?.kind !== "compte") return;
    api.maFiche().then(
      (x) => {
        setF(x);
        setEtat("ok");
      },
      (e) => setEtat(e instanceof ApiError && e.code === "pas_de_fiche" ? "aucune" : "erreur"),
    );
    api.choix().then(setChoix, () => {});
    // Un seul chargement à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (etat === "charge")
    return (
      <Seul>
        <Hello title="Ton site" sub="On prépare ton site à partir de ta fiche…" />
      </Seul>
    );
  if (etat === "erreur")
    return (
      <Seul>
        <Hello title="Impossible d’ouvrir ton site." />
        <Empty ill="hors-ligne">bestable.fr ne répond pas pour le moment. Vérifie ta connexion internet. Le reste de l’app marche normalement.</Empty>
      </Seul>
    );
  if (etat === "aucune" || !f)
    return (
      <Seul>
        <Hello title="Ton site se fait à partir de ta fiche." sub="Retrouve d’abord ton écurie sur bestable.fr et mets-la à ton nom. Ton site sera prêt juste après, avec ce que tu y as mis. C’est gratuit." />
        <div className="pad rise" style={{ marginTop: 16, animationDelay: ".1s" }}>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Trouver mon écurie
            <Ic n="arrow" className="" />
          </Link>
        </div>
      </Seul>
    );

  const metier = metierDe(f, choix);
  const adresse = adresseOfferte(f.title);
  const lien = demo ? null : lienPaiement(formule, rythme, f.id, f.email || undefined);
  const enAttente = !!f.en_attente;

  const hello = demo ? (
    <Hello title="Le site d’une écurie, déjà fait." sub="Voici celui de l’écurie d’exemple, fabriqué à partir de sa fiche bestable.fr. Avec ton compte, c’est le tien qui s’affiche ici." />
  ) : (
    <Hello title="Ton site est prêt." sub={`On l’a fait à partir de ta fiche bestable.fr. Regarde-le. S’il te convient, ${f.title || "ton écurie"} a son site en ligne en un geste.`} />
  );

  const apercu = (
    <div className="ms-ap rise" style={{ animationDelay: ".1s" }}>
      <SiteApercu f={f} metier={metier} adresse={adresse} choix={choix} />
      <p className="ec-help ms-ap-note">
        {demo ? "Une écurie inventée, pour l’exemple." : "Ce qui manque à ta fiche manque à ton site : chaque photo, chaque formule ajoutée l’enrichit."}{" "}
        {!demo && (
          <Link href="/ma-fiche" className="lnk" style={{ fontSize: 12 }}>
            Compléter ma fiche
          </Link>
        )}
      </p>
    </div>
  );

  const offre = (
    <Sec ill="sacoche" title="Le mettre en ligne" delay={0.16}>
      <div className="ms-ry" role="group" aria-label="Payer">
        <button type="button" className="chip" aria-pressed={rythme === "mois"} onClick={() => setRythme("mois")}>
          Au mois
        </button>
        <button type="button" className="chip" aria-pressed={rythme === "an"} onClick={() => setRythme("an")}>
          À l’année · 2 mois offerts
        </button>
      </div>
      <div className="ms-fo" role="radiogroup" aria-label="Formule">
        {(["site", "google"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={formule === k} className={`ms-card${formule === k ? " on" : ""}`} onClick={() => setFormule(k)}>
            <span className="ms-hd">
              <b>{NOM_FORMULE[k]}</b>
              <span className="ms-rad" aria-hidden="true">
                {formule === k && <Ic n="ck" className="" />}
              </span>
            </span>
            <span className="ms-px">
              <strong>{euros(PRIX[k][rythme])}</strong>
              <span>{rythme === "mois" ? "par mois" : "par an"}</span>
            </span>
            <ul>
              {INCLUS[k].map((x) => (
                <li key={x}>
                  <Ic n="ck" className="" />
                  {x}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <ul className="ms-dit">
        {rythme === "mois" ? (
          <li>
            <b>Sans engagement</b>, tu arrêtes quand tu veux.
          </li>
        ) : (
          <li>
            <b>Un paiement par an</b>, tu arrêtes quand tu veux à la fin de l’année.
          </li>
        )}
        <li>
          <b>Aucuns frais</b> de mise en ligne.
        </li>
        <li>
          Ton adresse offerte : <b className="ms-url">{adresse}</b>
        </li>
      </ul>
      {formule === "site" ? (
        <label className="ms-dom">
          <input type="checkbox" checked={domaine} onChange={(e) => setDomaine(e.target.checked)} />
          <span>
            <b>Ton propre nom de domaine</b>
            <small>
              {`${euros(PRIX_DOMAINE[rythme])} de plus par ${rythme === "mois" ? "mois" : "an"}, à ton nom : tu le gardes si tu pars. Tu le choisis après. Tu en as déjà un ? Tu le gardes, on t’explique comment le relier.`}
            </small>
          </span>
        </label>
      ) : (
        <p className="ec-help">Ton propre nom de domaine est compris. Tu le choisis après le paiement.</p>
      )}
      <p className="ec-help">Prix hors taxes.</p>
    </Sec>
  );

  const total = PRIX[formule][rythme] + (formule === "site" && domaine ? PRIX_DOMAINE[rythme] : 0);
  const cta = (
    <div className="ec-save ms-cta">
      {demo ? (
        <Link href="/compte/inscription?retrouver=1" className="btn full">
          Voir le site de mon écurie
          <Ic n="arrow" className="" />
        </Link>
      ) : enAttente ? (
        <button type="button" className="btn full" disabled>
          Possible dès que ta fiche est validée
        </button>
      ) : lien ? (
        <a href={lien} className="btn full" target="_blank" rel="noreferrer">
          {`Mettre ce site en ligne : ${euros(total)} par ${rythme === "mois" ? "mois" : "an"}`}
        </a>
      ) : (
        <button type="button" className="btn full" onClick={() => setDemande(true)}>
          {`Mettre ce site en ligne : ${euros(total)} par ${rythme === "mois" ? "mois" : "an"}`}
        </button>
      )}
      <small>{demo ? "Crée ton compte et retrouve ton écurie : ton site se fait tout seul." : "Ensuite, trois questions écrites. On relit ton site et il est en ligne."}</small>
    </div>
  );

  return (
    <Screen wide={desk}>
      <div className="ec-pg ms">
        {hello}
        {desk ? (
          <div className="cols2 ec-cols ms-cols">
            <div>
              {offre}
              {cta}
            </div>
            <div className="ec-stick">{apercu}</div>
          </div>
        ) : (
          <>
            {apercu}
            {offre}
            {cta}
          </>
        )}
        <div className="end" />
      </div>
      {demande && <FeuilleDemande f={f} formule={formule} rythme={rythme} domaine={formule === "site" && domaine} onClose={() => setDemande(false)} />}
    </Screen>
  );
}

/* ---------- L'aperçu : le site tel qu'il sera, dans un téléphone ---------- */

function SiteApercu({ f, metier, adresse, choix }: { f: Fiche; metier: Metier; adresse: string; choix: Choix | null }) {
  const photo = f.photos[0]?.url;
  const formules = f.formules.filter((x) => x.nom.trim());
  const prixMin = Number(f.prix_min);
  const places = f.places_libres;
  const services = [...f.services.map((k) => choix?.services?.[k] ?? ""), ...f.installations.map((k) => choix?.installations?.[k] ?? "")].filter(Boolean).slice(0, 6);
  const placesDit = places === "" || places === undefined ? "" : Number(places) > 0 ? `${places} place${Number(places) > 1 ? "s" : ""} libre${Number(places) > 1 ? "s" : ""} en ce moment` : "Complet pour le moment : liste d’attente ouverte";
  return (
    <div className="ms-tel" aria-label={`Aperçu du site ${adresse}`}>
      <div className="ms-url-bar">
        <Ic n="globe" className="" />
        <span>{adresse}</span>
      </div>
      <div className="ms-site">
        <div className="ms-s-bar">
          <b>{f.title || "Ton écurie"}</b>
          <span className="ms-burger" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className={`ms-s-photo${photo ? "" : " vide"}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
          {!photo && (
            <span>
              <Ic n="camera" className="" />
              Ta première photo ici
            </span>
          )}
        </div>
        <div className="ms-s-body">
          <p className="ms-s-kind">
            {NOM_METIER[metier]}
            {f.commune ? ` à ${f.commune}` : ""}
          </p>
          <h3 className="ms-s-title">{accroche(f, metier)}</h3>
          {formules.length > 0 ? (
            <div className="ms-s-rows">
              {formules.slice(0, 4).map((x, i) => (
                <div key={i} className="ms-s-row">
                  <span>{x.nom}</span>
                  <span>{Number(x.prix) > 0 ? `${euros(Number(x.prix))} / mois` : "sur demande"}</span>
                </div>
              ))}
            </div>
          ) : prixMin > 0 ? (
            <div className="ms-s-rows">
              <div className="ms-s-row">
                <span>Pension</span>
                <span>{`à partir de ${euros(prixMin)} / mois`}</span>
              </div>
            </div>
          ) : null}
          {placesDit && <p className="ms-s-pl">{placesDit}</p>}
          {services.length > 0 && (
            <div className="ms-s-tags">
              {services.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          )}
          <div className="ms-s-call">
            <Ic n={f.telephone ? "phone" : "mail"} className="" />
            {f.telephone ? "Appeler l’écurie" : "Écrire à l’écurie"}
          </div>
          <p className="ms-s-fiche">Voir notre fiche et nos avis sur bestable.fr</p>
        </div>
        <div className="ms-s-foot">Site réalisé avec Be Stable</div>
      </div>
    </div>
  );
}

/* ---------- La demande, tant que le paiement en ligne n'est pas branché ---------- */

function FeuilleDemande({ f, formule, rythme, domaine, onClose }: { f: Fiche; formule: Formule; rythme: Rythme; domaine: boolean; onClose: () => void }) {
  const ref = useFeuille(onClose, { verrou: true });
  const [etat, setEtat] = useState<"pret" | "envoi" | "envoye" | "echec">("pret");
  const message = messageDemande(formule, rythme, f, domaine);

  async function envoyer() {
    if (etat === "envoi") return;
    setEtat("envoi");
    try {
      await api.contact({ message, ecran: "/mon-site", version: VERSION_APP, navigateur: navigator.userAgent, appareil: appareilEnMots(), ecurie: f.title });
      setEtat("envoye");
    } catch {
      setEtat("echec");
    }
  }

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-labelledby="ms-t" ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b id="ms-t">Mettre mon site en ligne</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          <div className="pad">
            {etat === "envoye" ? (
              <div className="ct-ok" role="status">
                <b>C’est noté. On t’envoie par e-mail le lien pour payer, puis les trois questions.</b>
                <button type="button" className="btn full" onClick={onClose}>
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="ms-recap">
                  <b>{NOM_FORMULE[formule]}</b>
                  <span>{prixDit(formule, rythme)}</span>
                  {domaine && <span>{`+ ton nom de domaine, ${euros(PRIX_DOMAINE[rythme])} par ${rythme === "mois" ? "mois" : "an"}`}</span>}
                  <span className="ms-url">{adresseOfferte(f.title)}</span>
                </div>
                <p className="note">Le paiement en ligne arrive. En attendant, on t’envoie le lien pour payer par e-mail, à l’adresse de ton compte. Tu ne paies rien maintenant.</p>
                {etat === "echec" && (
                  <p className="ct-err" role="alert">
                    La demande n’est pas partie. Tu peux aussi écrire à{" "}
                    <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Mettre mon site en ligne")}&body=${encodeURIComponent(message)}`}>{CONTACT_EMAIL}</a>.
                  </p>
                )}
                <button type="button" className="btn full" style={{ marginTop: 12 }} onClick={envoyer} disabled={etat === "envoi"}>
                  {etat === "envoi" ? "Envoi…" : "Je le veux"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
