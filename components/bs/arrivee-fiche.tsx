"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ic } from "@/components/carnet/ui";
import { withBase } from "@/components/bs/ui";
import { Flot } from "@/components/bs/accueil-briques";
import { CodeInput } from "@/components/bs/rejoindre";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { LienLegal } from "@/components/bs/texte-legal";
import { api, ApiError, type Choix, type Fiche, type Formule } from "@/lib/account/api";
import { enter, getSession, hasAccountData, hasLegacyData, hasLocaleData, sessionFrom, setSession, updateAccount, type AccountSession, type Listing } from "@/lib/account/session";
import { adoptLocale } from "@/lib/account/vault";
import { jaugeFiche } from "@/lib/fiche-jauge";
import { mesurer } from "@/lib/mesure";
import "@/app/carnet/briques.css";
import "@/app/carnet/arrivee-fiche.css";

/**
 * L'arrivée d'un gérant par sa fiche (lot 5, 27 octobre 2026). Il clique
 * « C'est mon écurie » sur bestable.fr et arrive ici, sans histoire :
 *   0. « C'est bien ton écurie ? » : sa fiche et ce qui lui manque ;
 *   1. formules et prix ; 2. places libres ; 3. e-mail des demandes (et le code) ;
 *   4. la revendication, avec les champs du formulaire du site ;
 * puis « ta demande est partie ». Une fiche vivante en tête de chaque étape :
 * chaque réponse s'y pose, la jauge monte. Les champs sont ceux qui remplissent
 * la fiche sur bestable.fr ; rien d'inventé. Textes relus le 27 octobre.
 */
type Etape = "elle" | "prix" | "places" | "contact" | "code" | "rev" | "fait";
type ModePlaces = "nb" | "complet" | "tais";

const TU: Record<string, string> = {
  trop_d_essais: "Trop d’essais. Attends quelques minutes et réessaie.",
  code_ralenti: "Par sécurité, cette adresse n’accepte qu’un code par quart d’heure aujourd’hui. Réessaie dans quelques minutes.",
  code_faux: "Ce code ne correspond pas. Vérifie les six chiffres.",
  code_expire: "Ce code n’est plus valable. Demande-en un nouveau.",
  email_invalide: "Cette adresse e-mail semble incomplète. Vérifie-la.",
  hors_ligne: "Pas de connexion. Vérifie ton réseau et réessaie.",
  revendication_en_cours: "Une demande est déjà en cours pour cette fiche. Si elle vient de toi, tu recevras un e-mail.",
  deja_revendiquee: "Cette fiche est déjà à un gérant. Si c’est une erreur, écris à bonjour@bestable.fr.",
  siret_invalide: "Un numéro SIRET compte 14 chiffres.",
};
const dire = (x: unknown, defaut: string) => (x instanceof ApiError ? (TU[x.code] ?? x.message) : defaut);
const ILL = (n: string) => withBase(`/img/carnet/${n}.webp`);
const VIDE: Formule = { nom: "", description: "", prix: "", places: "" };

export function ArriveeFiche({ ficheId }: { ficheId: number }) {
  const [etape, setEtape] = useState<Etape>("elle");
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [compte, setCompte] = useState<AccountSession | null>(null);
  // 1. Formules et prix
  const [formules, setFormules] = useState<Formule[]>([]);
  const [prixMin, setPrixMin] = useState("");
  const [sansPrix, setSansPrix] = useState(false);
  // 2. Places
  const [mode, setMode] = useState<ModePlaces>("nb");
  const [places, setPlaces] = useState(0);
  // 3. Contact
  const [email, setEmail] = useState("");
  const [telAffiche, setTelAffiche] = useState("");
  const [code, setCode] = useState("");
  const [codeBon, setCodeBon] = useState(false);
  // 4. Revendication
  const [nom, setNom] = useState("");
  const [fonction, setFonction] = useState("");
  const [tel, setTel] = useState("");
  const [raison, setRaison] = useState("");
  const [siret, setSiret] = useState("");
  const [precisions, setPrecisions] = useState("");
  const [atteste, setAtteste] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [adopt, setAdopt] = useState<"legacy" | "locale" | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const garde = useRef(false);

  useEffect(() => {
    const s = getSession();
    if (s?.kind === "compte") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompte(s);
      setEmail(s.email);
      setNom([s.prenom, s.nom].filter(Boolean).join(" "));
    }
    api.ecurie(ficheId).then(
      (f) => {
        setFiche(f);
        setFormules(f.formules.length ? f.formules : [{ ...VIDE }]);
        setPrixMin(f.formules.length ? "" : f.prix_min);
        if (f.places_libres === "0") setMode("complet");
        else if (f.places_libres !== "") setPlaces(Number(f.places_libres));
        setTelAffiche(f.telephone ?? "");
      },
      () => setIntrouvable(true),
    );
    api.choix().then(setChoix, () => undefined);
  }, [ficheId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etape]);

  const aller = (e: Etape) => {
    setErr("");
    setEtape(e);
  };

  if (adopt) return <AdoptChoice to="/accueil" source={adopt} />;

  if (introuvable)
    return (
      <div className="bq-arr bq-el">
        <div className="bq-q-body" style={{ paddingTop: 60 }}>
          <h1>Cette fiche n’est plus en ligne.</h1>
          <p className="bq-q-s">Elle a peut-être été retirée ou fusionnée avec une autre. Cherche ton écurie par son nom.</p>
          <Link href="/compte/inscription?retrouver=1" className="btn full">
            Chercher mon écurie
          </Link>
        </div>
      </div>
    );
  if (!fiche) return <div className="bq-arr" aria-busy="true" />;

  /* ---------- Ce que la fiche montrera ---------- */
  const formulesPleines = formules.filter((x) => x.nom.trim() || x.prix);
  const placesTxt = mode === "complet" ? "0" : mode === "tais" ? "" : String(places);
  const saisie: Partial<Fiche> = {
    formules: sansPrix ? [] : formulesPleines,
    prix_min: sansPrix ? "" : formulesPleines.some((x) => x.prix) ? "" : prixMin,
    places_libres: placesTxt,
    email: email.trim(),
    telephone: telAffiche.trim(),
  };
  const fait = { prix: ["places", "contact", "code", "rev", "fait"].includes(etape), places: ["contact", "code", "rev", "fait"].includes(etape), contact: ["code", "rev", "fait"].includes(etape) };
  const apres: Fiche = {
    ...fiche,
    ...(fait.prix ? { formules: saisie.formules!, prix_min: saisie.prix_min! } : {}),
    ...(fait.places ? { places_libres: placesTxt } : {}),
    ...(fait.contact ? { email: saisie.email!, telephone: saisie.telephone! } : {}),
  };
  const avant = jaugeFiche(fiche);
  const jauge = jaugeFiche(apres);
  const prixAffiche = (() => {
    const l = (apres.formules.length ? apres.formules.map((x) => Number(x.prix)) : [Number(apres.prix_min)]).filter((n) => n > 0);
    return l.length ? `Dès ${Math.min(...l)} €` : "";
  })();
  const placesAffiche = apres.places_libres === "" ? "" : apres.places_libres === "0" ? "Complet" : `${apres.places_libres} place${Number(apres.places_libres) > 1 ? "s" : ""} libre${Number(apres.places_libres) > 1 ? "s" : ""}`;
  const contactAffiche = apres.email.trim() || apres.telephone.trim() ? "Écrire à l’écurie" : "";
  const lieu = [fiche.commune, fiche.departement].filter(Boolean).join(" · ");
  const photo = fiche.photos[0]?.url || ILL("accueil-premier");
  const statut = fiche.statut;

  const erreur = err ? (
    <p className="bq-q-err" role="alert">
      {err}
    </p>
  ) : null;

  /* ---------- Les gestes ---------- */
  async function demanderCode() {
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Cette adresse e-mail semble incomplète. Vérifie-la.");
    if (compte) return aller("rev");
    setBusy(true);
    setErr("");
    try {
      await api.envoyerCode(email.trim());
      setCode("");
      setCodeBon(false);
      aller("code");
    } catch (x) {
      setErr(dire(x, "Le code n’est pas parti. Réessaie."));
    } finally {
      setBusy(false);
    }
  }

  async function verifier(c: string) {
    if (busy || c.length !== 6) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.verifierCode(email.trim(), c);
      if (r.nouveau) mesurer("compte_cree");
      const s = sessionFrom(r);
      setSession(s);
      setCompte(s);
      if (!nom) setNom([s.prenom, s.nom].filter(Boolean).join(" "));
      if (hasLocaleData() && !hasAccountData(s.userId)) garde.current = await adoptLocale("locale");
      // Un compte qui a déjà sa fiche validée entre directement dans l'app.
      if (r.listing?.status === "validee") return entrer(s);
      setCodeBon(true);
    } catch (x) {
      setErr(dire(x, "Le code n’est pas passé. Réessaie."));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function manqueRev(): string {
    if (nom.trim().split(/\s+/).length < 2) return "Indique ton nom et ton prénom.";
    if (!fonction.trim()) return "Indique ta fonction.";
    if (tel.replace(/\D/g, "").length < 9) return "Indique un téléphone où te joindre.";
    if (!raison.trim()) return "Indique la raison sociale de l’écurie.";
    if (siret.replace(/\D/g, "").length !== 14) return "Le numéro SIRET compte 14 chiffres.";
    if (!atteste) return "Coche l’attestation pour envoyer ta demande.";
    return "";
  }

  async function envoyer() {
    if (busy || !compte) return;
    const m = manqueRev();
    if (m) return setErr(m);
    setBusy(true);
    setErr("");
    try {
      const [prenom, ...reste] = nom.trim().split(/\s+/);
      await api.majMoi({ prenom, nom: reste.join(" "), telephone: tel.trim() }).catch(() => undefined);
      const r = await api.revendiquer(ficheId, {
        fonction: fonction.trim(),
        telephone: tel.trim(),
        raison: raison.trim(),
        siret: siret.replace(/\D/g, ""),
        message: precisions.trim(),
        fiche: saisie,
      });
      setListing(r.listing);
      updateAccount({ listing: r.listing });
      mesurer("revendication_envoyee");
      aller("fait");
    } catch (x) {
      const e = x instanceof ApiError ? x : null;
      if (e?.code === "deja_une_fiche" && e.data.listing) {
        setListing(e.data.listing as Listing);
        updateAccount({ listing: e.data.listing as Listing });
        return aller("fait");
      }
      setErr(dire(x, "La demande n’est pas partie. Réessaie dans un instant."));
    } finally {
      setBusy(false);
    }
  }

  function entrer(s: AccountSession) {
    if (hasLocaleData()) return setAdopt("locale");
    if (!hasAccountData(s.userId) && hasLegacyData()) return setAdopt("legacy");
    enter(s, "/accueil");
  }

  /* ---------- 0. C'est bien ton écurie ? ---------- */
  if (etape === "elle") {
    const deja = (
      [
        ["Hébergement", "hebergement"],
        ["Installations", "installations"],
        ["Activités", "offres"],
        ["Services", "services"],
      ] as const
    )
      .map(([t, k]) => [t, fiche[k].map((v) => choix?.[k]?.[v] ?? v).join(", ")] as const)
      .filter(([, v]) => v);
    const manque = [
      !avant.manque.some((i) => i.k === "prix") ? null : { ic: "euro", t: "Tes prix", s: "Sans prix affiché, la fiche indique « sur demande »." },
      !avant.manque.some((i) => i.k === "places") ? null : { ic: "home", t: "Tes places libres", s: "Une information très consultée." },
      !avant.manque.some((i) => i.k === "contact") ? null : { ic: "mail", t: "Un moyen de te contacter", s: "Aujourd’hui, les cavaliers ne peuvent pas te joindre depuis la fiche." },
    ].filter(Boolean) as { ic: string; t: string; s: string }[];
    const prise = statut === "revendiquee";
    return (
      <div className="bq-arr bq-el">
        <div className="bq-el-im" style={{ backgroundImage: `url(${photo})` }}>
          {fiche.url && (
            <span className="bq-el-src">
              <Ic n="globe" className="" />
              {fiche.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </span>
          )}
        </div>
        <div className="bq-el-bd">
          <p className="bq-el-q">{prise ? "Cette fiche a déjà un gérant." : statut === "en_verification" ? "Une demande est en cours pour cette fiche." : "C’est bien ton écurie ?"}</p>
          <h1>{fiche.title}</h1>
          <p className="bq-el-l">{lieu}</p>
          <div className="bq-el-sc">
            <span className="n">
              Fiche <b>{avant.n}</b> sur {avant.total}
            </span>
            <Jauge n={avant.n} total={avant.total} />
          </div>
          {prise ? (
            <p className="bq-el-t">Si c’est toi, connecte-toi avec l’adresse e-mail utilisée ce jour-là : tu retrouves ta fiche. Sinon, écris-nous : nous vérifions à la main.</p>
          ) : manque.length ? (
            <>
              <p className="bq-el-t">Cette fiche a été créée à partir de sources publiques. Il manque les informations que les cavaliers regardent en premier :</p>
              <ul className="bq-el-m">
                {manque.map((m) => (
                  <li key={m.t}>
                    <Ic n={m.ic} className="" />
                    <span>
                      <b>{m.t}</b>
                      <small>{m.s}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="bq-el-t">Cette fiche a été créée à partir de sources publiques. Vérifie tes prix, tes places et ton contact, puis demande à la mettre à ton nom.</p>
          )}
          {deja.length > 0 && (
            <details className="bq-el-d">
              <summary>Ce que la fiche indique déjà</summary>
              <ul>
                {deja.map(([t, v]) => (
                  <li key={t}>
                    <span>{t}</span>
                    <b>{v}</b>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="bq-q-cta">
          {prise ? (
            <>
              <Link href="/compte/connexion" className="btn full">
                Me connecter
              </Link>
              <a className="lnk" href={`mailto:bonjour@bestable.fr?subject=${encodeURIComponent(`Ma fiche ${fiche.title} a déjà un gérant`)}`}>
                Écrire à Be Stable
              </a>
            </>
          ) : (
            <>
              <button type="button" className="btn full" onClick={() => aller("prix")} autoFocus>
                Oui, je gère cette écurie
                <Ic n="arrow" className="" />
              </button>
              <p className="bq-el-f">
                Gratuit.
                <Link href="/compte/inscription?retrouver=1">
                  <u>Ce n’est pas mon écurie</u>
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Ta demande est partie ---------- */
  if (etape === "fait") {
    const validee = listing?.status === "validee";
    const gagnes = Math.max(0, jauge.n - avant.n);
    return (
      <div className="bq-arr bq-win">
        <section className="bq-win-hero" style={{ backgroundImage: `linear-gradient(90deg,var(--vert-deep) 52%,rgba(11,51,37,.6) 66%,rgba(11,51,37,0) 86%),url(${ILL("sereine")})` }}>
          <h1>{validee ? `${fiche.title} est à ton nom.` : `${fiche.title} est en cours de mise à ton nom.`}</h1>
          <p>{validee ? "Ton adresse e-mail est celle de la fiche : pas besoin d’attendre. Voici ta fiche telle que les cavaliers la voient." : "Ta demande a été envoyée. Voici ta fiche telle que les cavaliers la verront."}</p>
        </section>
        <article className="bq-win-card" aria-label="Ta fiche sur bestable.fr">
          <div className="im" style={{ backgroundImage: `url(${photo})` }}>
            {!validee && (
              <span className="bq-win-st">
                <Ic n="clock" className="" />
                En vérification
              </span>
            )}
          </div>
          {gagnes > 0 && (
            <span className="bq-win-flot" aria-hidden="true">
              <Flot />
            </span>
          )}
          <div className="bd">
            <h2>{fiche.title}</h2>
            <p className="l">{lieu}</p>
            <div className="tags">
              {prixAffiche && <span className="t1">{prixAffiche}</span>}
              {placesAffiche && <span className="t2">{placesAffiche}</span>}
              {contactAffiche && (
                <span className="t3">
                  <Ic n="mail" className="" />
                  {contactAffiche}
                </span>
              )}
            </div>
            <div className="jg">
              <span className="n">
                <b>{jauge.n}</b> sur {jauge.total}
              </span>
              <span className="sg">
                {Array.from({ length: jauge.total }, (_, i) => (
                  <i key={i} className={i < avant.n ? "on" : i < jauge.n ? "neuf" : undefined} style={{ ["--d" as string]: i - avant.n }} />
                ))}
              </span>
            </div>
            {gagnes > 0 && (
              <p className="cap">
                {gagnes === 1 ? "Une information a été ajoutée." : `${["", "", "Deux", "Trois"][gagnes] ?? gagnes} informations ont été ajoutées.`}
                {validee ? " Elles sont déjà sur ta fiche." : " Elles s’affichent quand la fiche est à ton nom."}
              </p>
            )}
          </div>
        </article>
        {gagnes > 0 && (
          <div className="bq-win-gain">
            <span className="f" aria-hidden="true">
              <Flot />
            </span>
            <p>
              <b>Ton premier flot.</b> Il est ajouté dans l’application. Les suivants viendront avec tes photos et ce que tu proposes.
            </p>
          </div>
        )}
        <section className="bq-win-suite">
          <h2>La suite</h2>
          <ol>
            {validee ? (
              <>
                <li className="ok">
                  <span className="d">
                    <Ic n="ck" className="" />
                  </span>
                  <div>
                    <b>Ta fiche est à ton nom</b>
                    <small>Elle porte la mention « revendiquée ». Tu la modifies toi-même, dans Vitrine.</small>
                  </div>
                </li>
                <li className="now">
                  <span className="d" />
                  <div>
                    <b>Les demandes des cavaliers arrivent ici</b>
                    <small>Dans l’application, et par e-mail à {email.trim()}.</small>
                  </div>
                </li>
              </>
            ) : (
              <>
                <li className="ok">
                  <span className="d">
                    <Ic n="ck" className="" />
                  </span>
                  <div>
                    <b>Demande envoyée</b>
                    <small>Aujourd’hui, avec tes prix et tes places.</small>
                  </div>
                </li>
                <li className="now">
                  <span className="d" />
                  <div>
                    <b>Nous contrôlons ton SIRET</b>
                    <small>Compte deux jours ouvrés. En cas de doute, nous t’appelons.</small>
                  </div>
                </li>
                <li>
                  <span className="d" />
                  <div>
                    <b>Ta fiche à ton nom</b>
                    <small>Un e-mail te prévient. Elle porte la mention « revendiquée », c’est-à-dire à ton nom. Tu la modifies toi-même.</small>
                  </div>
                </li>
              </>
            )}
          </ol>
          <p className="pr">Gratuit · 0 % de commission sur tes pensions · Droit de retrait à tout moment</p>
        </section>
        <div className="bq-win-cta">
          <button type="button" className="btn full" onClick={() => compte && entrer(compte)}>
            Découvrir mon application
            <Ic n="arrow" className="" />
          </button>
          {!validee && (
            <button type="button" className="lnk" onClick={() => compte && (enter(compte, "/ma-fiche#vt-photos"), undefined)}>
              Préparer mes photos en attendant
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Les quatre étapes ---------- */
  const n = etape === "prix" ? 1 : etape === "places" ? 2 : etape === "rev" ? 4 : 3;
  const precedente: Record<Etape, Etape> = { elle: "elle", prix: "elle", places: "prix", contact: "places", code: "contact", rev: compte && !codeBon ? "contact" : "code", fait: "rev" };
  const focus = etape === "prix" ? "prix" : etape === "places" ? "places" : etape === "contact" ? "contact" : etape === "rev" ? "rev" : "";

  let titre = "";
  let sous: ReactNode = "";
  let corps: ReactNode = null;
  let cta = "Valider";
  let suite: () => void = () => undefined;
  let alt: ReactNode = null;

  if (etape === "prix") {
    titre = "Formules et prix";
    sous = "Ajoute une ligne par formule. La fiche affiche le prix le plus bas avec une place libre.";
    const maj = (i: number, p: Partial<Formule>) => setFormules((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
    corps = (
      <>
        <div className="bq-fm">
          {formules.map((x, i) => (
            <div key={i} className="bq-fm-r" style={{ position: "relative" }}>
              <input className="nm" aria-label="Nom de la formule" placeholder="Nom de la formule" value={x.nom} onChange={(e) => maj(i, { nom: e.target.value })} />
              <label className="px">
                <input inputMode="numeric" aria-label="Prix par mois" placeholder="—" value={x.prix} onChange={(e) => maj(i, { prix: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
                <span>€ / mois</span>
              </label>
              <label className="pl">
                <input inputMode="numeric" aria-label="Places libres sur cette formule" placeholder="?" value={x.places} onChange={(e) => maj(i, { places: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
                <span>{x.places === "1" ? "place libre" : "places libres"}</span>
              </label>
            </div>
          ))}
          <button type="button" className="bq-fm-add" onClick={() => setFormules((l) => [...l, { ...VIDE }])}>
            <Ic n="plus" className="" />
            Ajouter une formule
          </button>
        </div>
        <details className="bq-q-alt" open={!!prixMin && !formulesPleines.some((x) => x.prix)}>
          <summary>Ou indiquer seulement : pension à partir de</summary>
          <label className="bq-q-in">
            <input inputMode="numeric" placeholder="280" aria-label="Pension à partir de, par mois" value={prixMin} onChange={(e) => setPrixMin(e.target.value.replace(/\D/g, "").slice(0, 5))} />
            <span>€ / mois</span>
          </label>
        </details>
      </>
    );
    suite = () => {
      setSansPrix(false);
      // Les places déjà notées sur les formules préparent l'étape suivante.
      const total = formulesPleines.reduce((t, x) => t + (Number(x.places) || 0), 0);
      if (total > 0 && mode === "nb" && places === 0) setPlaces(total);
      aller("places");
    };
    alt = (
      <button type="button" className="lnk" onClick={() => (setSansPrix(true), aller("places"))}>
        Je n’affiche pas de prix pour le moment
      </button>
    );
  } else if (etape === "places") {
    titre = "Des places libres aujourd’hui ?";
    sous = "Cette information est très consultée par les propriétaires. Tu la confirmes chaque mois. La date de mise à jour s’affiche.";
    corps = (
      <>
        <div className={`bq-pls${mode === "nb" ? "" : " off"}`}>
          <button type="button" aria-label="Une place de moins" onClick={() => setPlaces((p) => Math.max(0, p - 1))}>
            −
          </button>
          <b aria-live="polite">{mode === "nb" ? places : mode === "complet" ? 0 : "?"}</b>
          <button type="button" className="p" aria-label="Une place de plus" onClick={() => setPlaces((p) => Math.min(99, p + 1))}>
            +
          </button>
        </div>
        <div className="bq-seg3" role="group" aria-label="Ce qu’indique ta fiche">
          {(
            [
              ["nb", "Un nombre"],
              ["complet", "Complet"],
              ["tais", "Je préfère ne pas l’indiquer"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={mode === k} className={mode === k ? "on" : undefined} onClick={() => setMode(k)}>
              {t}
            </button>
          ))}
        </div>
      </>
    );
    suite = () => aller("contact");
  } else if (etape === "contact") {
    titre = "Où reçois-tu les demandes ?";
    sous = compte ? "Les demandes des cavaliers arrivent à cette adresse. Elle n’est jamais affichée. Les cavaliers écrivent depuis ta fiche." : "Ton e-mail ouvre ton compte, sans mot de passe. Il n’est jamais affiché. Les cavaliers écrivent depuis ta fiche.";
    corps = (
      <>
        <label className="bq-q-f">
          <span>E-mail des demandes</span>
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" readOnly={!!compte} />
        </label>
        <div className="bq-flux" aria-label="Le chemin d’une demande : ta fiche, l’application, ton e-mail">
          <span>
            <Ic n="globe" className="" />
            <small>Ta fiche</small>
          </span>
          <i />
          <span>
            <Ic n="inbox" className="" />
            <small>L’application</small>
          </span>
          <i />
          <span>
            <Ic n="mail" className="" />
            <small>Ton e-mail</small>
          </span>
        </div>
        <label className="bq-q-f">
          <span>
            Téléphone affiché <em>facultatif</em>
          </span>
          <input type="tel" inputMode="tel" autoComplete="tel" value={telAffiche} onChange={(e) => setTelAffiche(e.target.value)} placeholder="06 …" />
          <small>Visible sur ta fiche. Laisse vide pour recevoir seulement des demandes écrites.</small>
        </label>
        {!compte && (
          <p className="bq-q-s" style={{ margin: "14px 0 0", fontSize: 12.5 }}>
            En continuant, tu acceptes les <LienLegal t="cgu">conditions</LienLegal> de Be Stable. Ce que nous faisons de tes informations : <LienLegal t="confidentialite">confidentialité</LienLegal>.
          </p>
        )}
      </>
    );
    cta = compte ? "Valider" : busy ? "Envoi…" : "Recevoir le code";
    suite = demanderCode;
  } else if (etape === "code") {
    titre = "Code de confirmation";
    sous = `Six chiffres envoyés à ${email.trim()}. Pense aussi à vérifier les indésirables.`;
    corps = (
      <>
        <CodeInput value={code} onChange={(v) => (setCode(v), v.length === 6 && verifier(v))} disabled={busy || codeBon} />
        {codeBon && (
          <p className="bq-otp-ok">
            <Ic n="ck" className="" />
            Code validé. Ton compte est ouvert.
          </p>
        )}
      </>
    );
    cta = codeBon ? "Continuer" : busy ? "Vérification…" : "Valider";
    suite = () => (codeBon ? aller("rev") : verifier(code));
    alt = !codeBon ? (
      <button type="button" className="lnk" onClick={demanderCode}>
        Renvoyer le code
      </button>
    ) : null;
  } else if (etape === "rev") {
    titre = "Confirmer que tu diriges cette écurie";
    sous = "Nous vérifions que tu diriges bien cette écurie. Ces informations ne sont pas publiées. C’est gratuit, sans commission sur tes pensions.";
    const siretN = siret.replace(/\D/g, "").length;
    corps = (
      <>
        <fieldset className="bq-q-g">
          <legend>Tes informations</legend>
          <label className="bq-q-f">
            <span>Nom et prénom</span>
            <input autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <label className="bq-q-f">
            <span>Fonction</span>
            <input value={fonction} onChange={(e) => setFonction(e.target.value)} placeholder="Gérante, propriétaire, responsable…" />
          </label>
          <label className="bq-q-f">
            <span>Téléphone</span>
            <input type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
            <small>Pour te joindre en cas de doute. Jamais affiché.</small>
          </label>
          <p className="bq-q-rep">
            <Ic n="ck" className="" />
            {email.trim()}, vérifié par le code
          </p>
        </fieldset>
        <fieldset className="bq-q-g">
          <legend>L’écurie</legend>
          <label className="bq-q-f">
            <span>Raison sociale</span>
            <input autoComplete="organization" value={raison} onChange={(e) => setRaison(e.target.value)} />
          </label>
          <label className="bq-q-f">
            <span>Numéro SIRET</span>
            <input inputMode="numeric" value={siret} onChange={(e) => setSiret(e.target.value.replace(/[^\d ]/g, "").slice(0, 20))} placeholder="14 chiffres" />
            <small className={siretN === 14 ? "ok" : undefined}>
              {siretN === 14 && <Ic n="ck" className="" />}
              14 chiffres. Nous vérifions qu’il correspond à l’écurie.
            </small>
          </label>
          <label className="bq-q-f">
            <span>
              Précisions <em>facultatif</em>
            </span>
            <textarea rows={2} value={precisions} onChange={(e) => setPrecisions(e.target.value)} placeholder="Ajoute ce qui peut nous aider à faire le lien avec l’écurie." />
          </label>
        </fieldset>
        <button type="button" className={`bq-att${atteste ? " on" : ""}`} aria-pressed={atteste} onClick={() => (setAtteste(!atteste), setErr(""))}>
          <span className="b">{atteste && <Ic n="ck" className="" />}</span>
          <span>J’atteste sur l’honneur diriger cette écurie ou avoir le droit de la représenter.</span>
        </button>
      </>
    );
    cta = busy ? "Envoi…" : "Envoyer ma demande";
    suite = envoyer;
  }

  return (
    <form
      className="bq-arr bq-q"
      noValidate
      onChange={() => err && setErr("")}
      onSubmit={(e) => {
        e.preventDefault();
        suite();
      }}
    >
      <div className="bq-q-top">
        <button type="button" className="bq-q-back" onClick={() => aller(precedente[etape])} aria-label="Revenir">
          <Ic n="back" className="" />
        </button>
        <span className="bq-q-bars" role="img" aria-label={`Étape ${n} sur 4`}>
          {[1, 2, 3, 4].map((j) => (
            <i key={j} className={j < n ? "ok" : j === n ? "now" : undefined} />
          ))}
        </span>
        <span className="bq-q-n">{n}/4</span>
      </div>

      <section className="bq-fv" aria-label="Ta fiche, telle que la verront les cavaliers">
        <div className="bq-fv-hd">
          <span className="im" style={{ backgroundImage: `url(${photo})` }} />
          <span className="nm">
            <b>{fiche.title}</b>
            <small>{lieu}</small>
          </span>
          <span className="sc">
            <b>{jauge.n}</b>
            <small>sur {jauge.total}</small>
          </span>
        </div>
        <div className="bq-fv-tags">
          <Tag ok={!!prixAffiche && fait.prix} t={fait.prix && prixAffiche ? prixAffiche : "Prix"} focus={focus === "prix"} />
          <Tag ok={!!placesAffiche && fait.places} t={fait.places && placesAffiche ? placesAffiche : "Places"} focus={focus === "places"} />
          <Tag ok={!!contactAffiche && fait.contact} t={fait.contact && contactAffiche ? contactAffiche : "Contact"} focus={focus === "contact"} />
          {focus === "rev" && <Tag ok={false} t="À ton nom" focus ic="flag" />}
        </div>
        <span className="bq-fv-jg">
          {Array.from({ length: jauge.total }, (_, i) => (
            <i key={i} className={i < jauge.n ? "on" : undefined} />
          ))}
        </span>
      </section>

      <div className="bq-q-body">
        <h1>{titre}</h1>
        <p className="bq-q-s">{sous}</p>
        {corps}
        {erreur}
      </div>

      <div className="bq-q-cta">
        <button className="btn full" disabled={busy || (etape === "code" && !codeBon && code.length !== 6)}>
          {cta}
          <Ic n="arrow" className="" />
        </button>
        {alt}
      </div>
    </form>
  );
}

function Tag({ ok, t, focus, ic }: { ok: boolean; t: string; focus?: boolean; ic?: string }) {
  return (
    <span className={`${ok ? "ok" : "vide"}${focus ? " focus" : ""}`}>
      {!ok && <Ic n={ic ?? "plus"} className="" />}
      {t}
    </span>
  );
}

function Jauge({ n, total }: { n: number; total: number }) {
  return (
    <span className="bq-jg" role="img" aria-label={`${n} sur ${total}`} style={{ ["--n" as string]: total }}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < n ? "on" : undefined} />
      ))}
    </span>
  );
}
