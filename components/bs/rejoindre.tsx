"use client";

import { LienLegal } from "@/components/bs/texte-legal";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { withBase } from "@/components/bs/ui";
import { nf, useAnnuaire } from "@/components/bs/account-ui";
import { EcuriesTexte, ecuriesTexte } from "@/lib/annuaire";
import { mesurer } from "@/lib/mesure";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { Ic, Ill } from "@/components/carnet/ui";
import { Stories } from "@/components/bs/histoire";
import { api, ApiError, type Fiche, type StableHit } from "@/lib/account/api";
import { enter, getSession, hasAccountData, hasLegacyData, hasLocaleData, sessionFrom, setSession, updateAccount, type AccountSession, type Listing } from "@/lib/account/session";
import { adoptLocale } from "@/lib/account/vault";

/**
 * Rejoindre Be Stable : une question par écran.
 *   0. trois scènes (les stories), puis pourquoi on cherche l'écurie (mon-ecurie.fr) ;
 *   1. le nom de l'écurie (ou l'ajouter si elle n'est pas dans l'annuaire) ;
 *   2. « C'est elle ? », puis sa fiche aujourd'hui / reprise, à faire glisser ;
 *   3. les places libres ;
 *   4. le prix « à partir de » ;
 *   5. l'e-mail, puis le code reçu (pas de mot de passe).
 * La demande part toute seule après le code, puis la rosette.
 * Sur ordinateur, la fiche se construit à côté de la question.
 *
 * Ce n'est plus la porte d'entrée (voir Essayer) : on y arrive depuis l'app
 * pour retrouver sa fiche mon-ecurie.fr (/compte/inscription?retrouver=1,
 * directement à la recherche) ou depuis un lien du site (?fiche=ID).
 * Une écurie essayée sans compte passe dans le compte après le code.
 */
type Etape = "accueil" | "pourquoi" | "nom" | "creer" | "elle" | "gain" | "places" | "prix" | "email" | "code" | "envoi" | "fait";
const RANG: Record<Etape, number> = { accueil: 0, pourquoi: 0, nom: 1, creer: 1, elle: 2, gain: 2, places: 3, prix: 4, email: 5, code: 5, envoi: 5, fait: 5 };
const PHOTO = withBase("/img/exemple-pre.jpg");

/** Les messages du site sont au « vous » : l'app parle au « tu ». */
const TU: Record<string, string> = {
  trop_d_essais: "Trop d’essais. Attends quelques minutes et réessaie.",
  code_ralenti: "Par sécurité, cette adresse n’accepte qu’un code par quart d’heure aujourd’hui. Réessaie dans quelques minutes.",
  code_faux: "Ce code ne correspond pas. Vérifie les six chiffres.",
  code_expire: "Ce code n’est plus valable. Demande-en un nouveau.",
  email_invalide: "Cette adresse e-mail a l’air incomplète. Vérifie-la.",
  hors_ligne: "Pas de connexion. Vérifie ton réseau et réessaie.",
  revendication_en_cours: "Une demande est déjà en cours pour cette fiche. Si c’est la tienne, tu recevras un e-mail.",
  deja_revendiquee: "Cette fiche est déjà au nom de quelqu’un. Si c’est une erreur, écris à bonjour@bestable.fr.",
};
const dire = (x: unknown, defaut: string) => (x instanceof ApiError ? TU[x.code] ?? x.message : defaut);
const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Rejoindre({ ficheId = 0, creer = false, retrouver = false, depuis = null }: { ficheId?: number; creer?: boolean; retrouver?: boolean; depuis?: string | null }) {
  const chiffres = useAnnuaire();
  const [etape, setEtape] = useState<Etape>(creer ? "creer" : ficheId ? "elle" : retrouver ? "nom" : "accueil");
  const [hist, setHist] = useState<Etape[]>([]);
  const [compte, setCompte] = useState<AccountSession | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StableHit[] | null>(null);
  const [cherche, setCherche] = useState(false);
  const [fiche, setFiche] = useState<Partial<Fiche>>({ photos: [], formules: [], places_libres: "", prix_min: "" });
  const [places, setPlaces] = useState<string>("");
  const [prix, setPrix] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState<"legacy" | "locale" | null>(null);
  const garde = useRef(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const s = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s?.kind === "compte") setCompte(s);
    if (ficheId)
      api.ecurie(ficheId).then(
        (f) => setFiche(f),
        () => setErr("Cette fiche n’est plus en ligne. Choisis une autre écurie ou ajoute la tienne."),
      );
  }, [ficheId]);

  const aller = (e: Etape) => {
    setErr("");
    setHist((h) => [...h, etape]);
    setEtape(e);
  };
  const retour = () => {
    setErr("");
    setHist((h) => {
      const p = h[h.length - 1];
      if (p) setEtape(p);
      return h.slice(0, -1);
    });
  };

  function chercher(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) return setHits(null);
    timer.current = setTimeout(async () => {
      setCherche(true);
      try {
        setHits((await api.chercher(v.trim())).resultats.slice(0, 6));
      } catch {
        setErr("La recherche ne répond pas. Vérifie ta connexion.");
      } finally {
        setCherche(false);
      }
    }, 260);
  }

  async function choisir(h: StableHit) {
    setBusy(true);
    try {
      setFiche(await api.ecurie(h.id));
      aller("elle");
    } catch {
      setErr("Impossible d’ouvrir cette fiche. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  /** La demande (revendication ou création), une fois le compte ouvert. */
  async function envoyer(s: AccountSession) {
    setEtape("envoi");
    const saisie = { places_libres: places, prix_min: prix };
    try {
      const r = fiche.id
        ? await api.revendiquer(fiche.id, { fiche: saisie })
        : await api.creer({ univers: "ecuries-proprietaires", fiche: { ...saisie, title: fiche.title, code_postal: fiche.code_postal, commune: fiche.commune } });
      setListing(r.listing);
      updateAccount({ listing: r.listing });
      setEtape("fait");
    } catch (x) {
      const e = x instanceof ApiError ? x : null;
      if (e?.code === "deja_une_fiche" && e.data.listing) {
        setListing(e.data.listing as Listing);
        updateAccount({ listing: e.data.listing as Listing });
        return setEtape("fait");
      }
      if (e?.code === "doublon" && e.data.fiche) {
        setFiche(await api.ecurie(Number((e.data.fiche as { id: number }).id)));
        setEtape("elle");
        return setErr("Cette écurie est déjà dans l’annuaire : la voici.");
      }
      setErr(dire(x, "La demande n’est pas partie. Réessaie."));
      setEtape(s ? "prix" : "email");
    }
  }

  async function demanderCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Cette adresse e-mail a l’air incomplète. Vérifie-la.");
    setBusy(true);
    setErr("");
    try {
      await api.envoyerCode(email.trim());
      setCode("");
      aller("code");
    } catch (x) {
      setErr(dire(x, "Ce n’est pas parti. Réessaie."));
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
      // L'écurie essayée sans compte passe dans un compte encore vide.
      if (hasLocaleData() && !hasAccountData(s.userId)) garde.current = await adoptLocale("locale");
      // Un compte qui a déjà sa fiche validée entre directement dans l'app.
      if (r.listing?.status === "validee") return entrer(s, "/accueil");
      await envoyer(s);
    } catch (x) {
      setErr(dire(x, "Le code n’est pas passé. Réessaie."));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function entrer(s: AccountSession, to: string) {
    if (hasLocaleData()) return setAdopt("locale");
    if (!hasAccountData(s.userId) && hasLegacyData()) return setAdopt("legacy");
    enter(s, garde.current ? "/accueil" : to);
  }

  if (adopt) return <AdoptChoice to={adopt === "locale" ? "/accueil" : "/parcours"} source={adopt} />;

  const n = RANG[etape];
  const prixN = Number(prix);
  const apercu: Partial<Fiche> = { ...fiche, places_libres: places, prix_min: prix || fiche.prix_min };
  const statut = fiche.statut;
  const erreur = err ? (
    <p className="ar-err" role="alert">
      {err}
    </p>
  ) : null;

  /** Sur ordinateur : la fiche telle qu'elle se construit. */
  const panneau =
    etape === "gain" ? null : (
      <aside className="ar-side" aria-hidden="true">
        {fiche.title ? (
          <>
            <p className="k">{etape === "fait" ? "Ta fiche, en vérification" : "Ta fiche, en direct"}</p>
            <div className="ar-apercu">
              <FicheCarte f={apercu} etat={etape === "fait" ? "verif" : "avant"} />
            </div>
          </>
        ) : (
          <>
            <p className="k">Ce qu’une fiche à ton nom montre aux cavaliers</p>
            <div className="ar-apercu">
              <FicheCarte f={{ title: "Ton écurie", commune: "Ta commune", photos: [{ id: 0, url: PHOTO }], prix_min: "420", places_libres: "2" }} etat="reprise" />
            </div>
            <p className="ar-ex">Exemple. 0 % de commission, gratuit.</p>
          </>
        )}
      </aside>
    );

  // Les trois scènes : plein écran, sans en-tête.
  if (etape === "accueil")
    return (
      <div className="ar ar-duo">
        <Stories onStart={() => aller("pourquoi")} login={!compte} />
        {panneau}
      </div>
    );

  const top = (
    <header className="ar-top">
      {hist.length > 0 && etape !== "fait" && etape !== "envoi" ? (
        <button type="button" className="ar-back" onClick={retour} aria-label="Revenir">
          <Ic n="back" className="" />
        </button>
      ) : retrouver && etape === "nom" ? (
        <Link href="/ma-fiche" className="ar-back" aria-label="Revenir à ma fiche">
          <Ic n="back" className="" />
        </Link>
      ) : (creer || ficheId > 0 || depuis) && etape !== "fait" && etape !== "envoi" ? (
        // Arrivé directement sur une étape (ajouter son écurie, « C'est la mienne ») : on peut toujours repartir d'où l'on vient.
        <button
          type="button"
          className={`ar-back${depuis === "ecurie" ? " ar-back-l" : ""}`}
          aria-label={depuis === "ecurie" ? "Revenir à Mon écurie" : "Revenir"}
          onClick={() => (depuis === "ecurie" ? window.location.assign(withBase("/ecurie")) : window.history.length > 1 ? window.history.back() : window.location.assign(withBase("/accueil")))}
        >
          <Ic n="back" className="" />
          {depuis === "ecurie" && <span aria-hidden="true">Mon écurie</span>}
        </button>
      ) : (
        <span className="ar-wm">be stable</span>
      )}
      {etape !== "fait" && n > 0 ? (
        <span className="dots" role="img" aria-label={`Étape ${n} sur 5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={i <= n ? "on" : ""} />
          ))}
        </span>
      ) : (
        <span />
      )}
      {!compte && (etape === "nom" || etape === "pourquoi") ? (
        <Link href="/compte/connexion" className="ar-link">
          Me connecter
        </Link>
      ) : (
        <span />
      )}
    </header>
  );

  return (
    <div className={`ar${etape === "gain" ? "" : " ar-duo"}`}>
      {/* 0 bis. Pourquoi on cherche l'écurie */}
      {etape === "pourquoi" && (
        <div className="ar-v">
          {top}
          <div className="ar-hero rise">
            <Ill n="cavaliere" alt="Une cavalière cherche une pension sur son téléphone, appuyée à la barrière du paddock." />
          </div>
          <div className="q rise" style={{ animationDelay: ".08s" }}>
            <h1>D’abord, on retrouve ton écurie.</h1>
            <p>
              Elle a sans doute déjà sa fiche sur <b>bestable.fr</b>, l’annuaire des pensions pour chevaux : <b className="num">{ecuriesTexte(chiffres?.ecuries)}</b> y sont, partout en France. En la reprenant :
            </p>
          </div>
          <ul className="ar-pts rise" style={{ animationDelay: ".16s" }}>
            {["Elle passe à ton nom", "Les cavaliers la voient à jour", "Gratuit, sans commission"].map((t) => (
              <li key={t}>
                <span className="pk">
                  <Ic n="ck" className="" />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="foot">
            <button type="button" className="btn full" onClick={() => aller("nom")}>
              Trouver mon écurie
            </button>
            <button type="button" className="lnk" onClick={() => aller("creer")}>
              Elle n’est pas sur l’annuaire ? L’ajouter
            </button>
          </div>
        </div>
      )}

      {/* 1. Le nom */}
      {etape === "nom" && (
        <form className="ar-v" onSubmit={(e) => (e.preventDefault(), hits?.[0] && choisir(hits[0]))}>
          {top}
          <div className="q">
            <h1>Comment s’appelle ton écurie ?</h1>
          </div>
          <label className="input ar-in">
            <Ic n="search" className="ar-ico" />
            <input autoFocus value={q} onChange={(e) => chercher(e.target.value)} placeholder="Nom ou commune" aria-label="Nom de ton écurie ou commune" autoComplete="off" enterKeyHint="search" />
            {cherche && <span className="ar-spin" aria-hidden />}
          </label>
          {erreur}
          {hits && (
            <ul className="ar-hits" aria-live="polite">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => choisir(h)} disabled={busy}>
                    <b>
                      <Marque t={h.title} q={q} />
                    </b>
                    <span>{[h.commune, h.departement && `(${h.departement})`].filter(Boolean).join(" ")}</span>
                    <Ic n="chev" className="chev" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="add"
                  onClick={() => {
                    setFiche({ ...fiche, id: undefined, title: q.trim(), statut: undefined });
                    aller("creer");
                  }}
                >
                  <b>{hits.length ? "Elle n’est pas dans la liste" : "Aucune écurie à ce nom"}</b>
                  <span>l’ajouter à l’annuaire</span>
                  <Ic n="plus" className="chev" />
                </button>
              </li>
            </ul>
          )}
          <div className="foot">
            <p className="ar-proof">
              <b className="num">{EcuriesTexte(chiffres?.ecuries)}</b> · gratuit · 0 % de commission
            </p>
          </div>
        </form>
      )}

      {/* 1 bis. L'ajouter */}
      {etape === "creer" && (
        <form
          className="ar-v"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fiche.title?.trim() || !/^\d{5}$/.test(fiche.code_postal ?? "") || !fiche.commune?.trim()) return setErr("Le nom, le code postal et la commune suffisent.");
            aller("gain");
          }}
        >
          {top}
          <div className="q">
            <h1>On l’ajoute.</h1>
            <p>Le nom, le code postal et la commune suffisent.</p>
          </div>
          <div className="ar-form">
            <label className="field">
              <span>Nom de l’écurie</span>
              <input className="input" autoFocus value={fiche.title ?? ""} onChange={(e) => setFiche({ ...fiche, title: e.target.value })} placeholder="Ex. : Les Trois Pommiers" autoComplete="organization" />
            </label>
            <div className="ar-two">
              <label className="field">
                <span>Code postal</span>
                <input className="input num" value={fiche.code_postal ?? ""} onChange={(e) => setFiche({ ...fiche, code_postal: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="Code postal" inputMode="numeric" autoComplete="postal-code" />
              </label>
              <label className="field">
                <span>Commune</span>
                <input className="input" value={fiche.commune ?? ""} onChange={(e) => setFiche({ ...fiche, commune: e.target.value })} placeholder="Commune" autoComplete="address-level2" />
              </label>
            </div>
          </div>
          {erreur}
          <div className="foot">
            <button className="btn full">Continuer</button>
          </div>
        </form>
      )}

      {/* 2. C'est elle ? */}
      {etape === "elle" && (
        <div className="ar-v">
          {top}
          <div className="q">
            <h1>{statut === "revendiquee" ? "Elle est déjà au nom de quelqu’un." : statut === "en_verification" ? "Une demande est déjà en cours." : "C’est elle ?"}</h1>
          </div>
          <div className="ar-apercu" aria-label="Aperçu de la fiche sur bestable.fr">
            <FicheCarte f={fiche} etat="avant" />
          </div>
          {erreur}
          <div className="foot">
            {statut === "revendiquee" ? (
              <>
                <p className="ar-proof">
                  Elle est déjà au nom de quelqu’un. Si c’est toi, entre avec l’e-mail utilisé ce jour-là : tu retrouves ta fiche.
                </p>
                <Link href="/compte/connexion" className="btn full">
                  Me connecter
                </Link>
                <p className="ar-proof">
                  Ce n’est pas toi ?{" "}
                  <a className="lnk" href={`mailto:bonjour@bestable.fr?subject=${encodeURIComponent(`Ma fiche ${fiche.title ?? ""} est reprise par quelqu’un d’autre`)}`}>
                    Écris-nous
                  </a>
                  , on vérifie à la main. Ou{" "}
                  <button type="button" className="lnk" onClick={() => (setEtape("nom"), setHist([]))}>
                    choisis une autre écurie
                  </button>
                  .
                </p>
              </>
            ) : statut === "en_verification" ? (
              <>
                <p className="ar-proof">Si c’est la tienne, ton e-mail suffit pour la retrouver.</p>
                <button type="button" className="btn full" onClick={() => aller(compte ? "places" : "email")}>
                  C’est ma demande
                </button>
              </>
            ) : (
              <div className="ar-two">
                <button type="button" className="btn line" onClick={() => (setEtape("nom"), setHist([]))}>
                  Non
                </button>
                <button type="button" className="btn" onClick={() => aller("gain")} autoFocus>
                  Oui, c’est elle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2 bis. Aujourd'hui / reprise */}
      {etape === "gain" && (
        <div className="ar-v">
          {top}
          <div className="q">
            <h1>Fais glisser pour comparer.</h1>
          </div>
          <AvantApres f={fiche} />
          <div className="foot">
            <button type="button" className="btn full" onClick={() => aller("places")}>
              Je veux celle de droite
            </button>
            <p className="ar-proof">Gratuit · 0 % de commission · vérifiée à la main</p>
          </div>
        </div>
      )}

      {/* 3. Places */}
      {etape === "places" && (
        <form className="ar-v" onSubmit={(e) => (e.preventDefault(), aller("prix"))}>
          {top}
          <div className="q">
            <h1>Des places libres en ce moment ?</h1>
          </div>
          <div className="ar-grand">
            <button type="button" aria-label="Une place de moins" onClick={() => setPlaces(String(Math.max(0, Number(places || 1) - 1)))}>
              −
            </button>
            <input inputMode="numeric" value={places} placeholder="?" aria-label="Places libres" onChange={(e) => setPlaces(e.target.value.replace(/\D/g, "").slice(0, 2))} autoFocus />
            <button type="button" aria-label="Une place de plus" onClick={() => setPlaces(String(Number(places || 0) + 1))}>
              +
            </button>
          </div>
          <div className="chips ar-chips">
            <button type="button" className="chip" aria-pressed={places === "0"} onClick={() => setPlaces("0")}>
              Complet
            </button>
            <button type="button" className="chip" aria-pressed={places === ""} onClick={() => setPlaces("")}>
              Je préfère ne pas le dire
            </button>
          </div>
          <div className="foot">
            <button className="btn full">Suivant</button>
          </div>
        </form>
      )}

      {/* 4. Prix */}
      {etape === "prix" && (
        <form className="ar-v" onSubmit={(e) => (e.preventDefault(), compte ? envoyer(compte) : aller("email"))}>
          {top}
          <div className="q">
            <h1>Ta pension, à partir de combien ?</h1>
          </div>
          <label className="ar-prix">
            <input inputMode="numeric" value={prix} placeholder="0" aria-label="Ta pension la moins chère, par mois" onChange={(e) => setPrix(e.target.value.replace(/\D/g, "").slice(0, 5))} autoFocus />
            <span>€ / mois</span>
          </label>
          <p className="ar-ex" style={{ textAlign: "center" }}>
            Le prix le plus bas de tes formules. Il s’affiche « à partir de ».
          </p>
          {erreur}
          <div className="foot">
            <button className="btn full">{prixN > 0 ? "Suivant" : "Passer"}</button>
          </div>
        </form>
      )}

      {/* 5. E-mail */}
      {etape === "email" && (
        <form className="ar-v" onSubmit={demanderCode} noValidate>
          {top}
          <div className="q">
            <h1>Où t’envoyer ton code ?</h1>
          </div>
          <label className="input ar-in">
            <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
          </label>
          {erreur}
          <div className="foot">
            <button className="btn full" disabled={busy}>
              {busy ? "Envoi…" : "Recevoir le code"}
            </button>
            <p className="ar-proof">
              Pas de mot de passe. En continuant, tu acceptes les{" "}
              <LienLegal t="cgu">conditions</LienLegal> de Be Stable. Ce qu’on fait de tes informations :{" "}
              <LienLegal t="confidentialite">confidentialité</LienLegal>.
            </p>
          </div>
        </form>
      )}

      {/* 5 bis. Le code */}
      {etape === "code" && (
        <form className="ar-v" onSubmit={(e) => (e.preventDefault(), verifier(code))}>
          {top}
          <div className="q">
            <h1>Le code reçu par e-mail</h1>
            <p>Envoyé à {email.trim()}.</p>
          </div>
          <CodeInput value={code} onChange={(v) => (setCode(v), v.length === 6 && verifier(v))} disabled={busy} />
          {erreur}
          <div className="foot">
            <button className="btn full" disabled={busy || code.length !== 6}>
              {busy ? "Vérification…" : "Continuer"}
            </button>
            <p className="ar-proof">
              Rien reçu ? Regarde les indésirables, ou{" "}
              <button type="button" className="lnk" onClick={() => demanderCode()}>
                renvoie le code
              </button>
              .
            </p>
          </div>
        </form>
      )}

      {etape === "envoi" && (
        <div className="ar-v" aria-busy="true">
          {top}
          <div className="q">
            <h1>Un instant…</h1>
          </div>
        </div>
      )}

      {/* La rosette */}
      {etape === "fait" && (
        <div className="ar-v ar-fait">
          {top}
          <div className="hero-ill rise">
            <Ill n="rosette" alt="La gérante brandit une rosette." />
          </div>
          <div className="q rise" style={{ animationDelay: ".08s" }}>
            <h1>{listing?.status === "validee" ? "Ta fiche est à toi." : "Demande envoyée."}</h1>
            <p>{listing?.status === "validee" ? "Tout est prêt dans Be Stable." : "On vérifie à la main, en général sous deux jours ouvrés. Tu reçois un e-mail dès que la fiche est à toi."}</p>
          </div>
          <div className="foot">
            <button type="button" className="btn full" onClick={() => compte && entrer(compte, "/parcours")}>
              Ouvrir Be Stable
              <Ic n="arrow" className="" />
            </button>
          </div>
        </div>
      )}

      {panneau}
    </div>
  );
}

/* ---------- La fiche, telle que les cavaliers la voient ---------- */
const plie = (s: string) =>
  [...s]
    .map((c) => {
      const f = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return f.length === 1 ? f : c;
    })
    .join("");
/** Le nom trouvé, avec la partie tapée soulignée. */
export function Marque({ t, q }: { t: string; q: string }) {
  const k = plie(q.trim());
  const i = k.length >= 2 ? plie(t).indexOf(k) : -1;
  if (i < 0) return <>{t}</>;
  return (
    <>
      {t.slice(0, i)}
      <mark>{t.slice(i, i + k.length)}</mark>
      {t.slice(i + k.length)}
    </>
  );
}

/** avant : la fiche telle qu'elle est ; reprise : la version à jour ; verif : demande partie. */
function FicheCarte({ f, etat, exemple }: { f: Partial<Fiche>; etat: "avant" | "reprise" | "verif"; exemple?: ReactNode }) {
  const photo = f.photos?.[0]?.url;
  const price = Number(f.prix_min);
  const places = f.places_libres;
  const pill =
    etat === "reprise" ? (
      <span className="pill ink">✓ À ton nom</span>
    ) : etat === "verif" ? (
      <span className="pill">En vérification</span>
    ) : f.statut === "revendiquee" ? (
      <span className="pill">Déjà à quelqu’un</span>
    ) : f.statut === "en_verification" ? (
      <span className="pill">En vérification</span>
    ) : (
      <span className="pill">Pas encore à ton nom</span>
    );
  return (
    <div className="ar-fc">
      <div className="ph" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
        {!photo && (exemple ?? "Pas de photo")}
      </div>
      <div className="bd">
        <b>{f.title || "Le nom de ton écurie"}</b>
        <span className="loc">{[f.commune, f.code_postal].filter(Boolean).join(" · ") || "Commune"}</span>
        {pill}
        {price > 0 ? (
          <span className="px">
            à partir de<strong>{`${nf(price)}\u00a0€`}</strong>/ mois
          </span>
        ) : (
          <span className="px">Tarifs non communiqués</span>
        )}
        <span className={`pl${Number(places) > 0 ? " ok" : ""}`}>
          {places === "" || places === undefined ? "Places : non précisé" : Number(places) > 0 ? `${places} place${Number(places) > 1 ? "s" : ""} libre${Number(places) > 1 ? "s" : ""}` : "Complet pour le moment"}
        </span>
      </div>
    </div>
  );
}

/** Sa fiche aujourd'hui à gauche, reprise à droite ; la poignée se tire au doigt ou à la souris. */
function AvantApres({ f }: { f: Partial<Fiche> }) {
  const doux = calme();
  const [x, setX] = useState(doux ? 34 : 88);
  // À l'arrivée, la poignée balaie la fiche une fois et montre surtout la version reprise.
  useEffect(() => {
    if (doux) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      setX(88 - (88 - 34) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const go = setTimeout(() => (raf = requestAnimationFrame(step)), 350);
    return () => (clearTimeout(go), cancelAnimationFrame(raf));
  }, [doux]);
  const reprise: Partial<Fiche> = { ...f, prix_min: String(Number(f.prix_min) > 0 ? Number(f.prix_min) : 420), places_libres: "2" };
  return (
    <>
      <div className="ar-ba" style={{ ["--x" as string]: `${x}%` }}>
        <FicheCarte f={{ ...f, photos: [] }} etat="avant" />
        <div className="calque" aria-hidden>
          <FicheCarte f={reprise} etat="reprise" exemple={<Ill n="matin" />} />
        </div>
        <span className="tag a">Aujourd’hui</span>
        <span className="tag b">À ton nom</span>
        <i className="knob" aria-hidden />
        <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label="Ta fiche aujourd’hui, et une fois à ton nom" />
      </div>
      <p className="ar-ex">À droite : photo, prix et places d’exemple. Les tiens les remplacent.</p>
    </>
  );
}

/* ---------- Pièces partagées avec la connexion et le mot de passe ---------- */
/** Six chiffres ; le code collé depuis l'e-mail se remplit d'un coup. */
export function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="ar-code">
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label="Code à six chiffres"
      />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={i === value.length ? "on" : value[i] ? "full" : ""} aria-hidden>
          {value[i] ?? (i === value.length ? <i className="ar-caret" /> : "")}
        </span>
      ))}
    </label>
  );
}

/** Le haut des écrans de compte : le retour ou be stable, et un lien à droite. */
export function ArTop({ onBack, right }: { onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="ar-top">
      {onBack ? (
        <button type="button" className="ar-back" onClick={onBack} aria-label="Revenir">
          <Ic n="back" className="" />
        </button>
      ) : (
        <span className="ar-wm">be stable</span>
      )}
      <span />
      {right ?? <span />}
    </header>
  );
}
