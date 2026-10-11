"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccTop, Field, FichePreview, PasswordField, ResultSheet } from "@/components/bs/account-ui";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { Picto } from "@/components/bs/picto";
import { Rosette } from "@/components/bs/ui";
import { api, ApiError, PW_MIN, type Choix, type Fiche } from "@/lib/account/api";
import { enter, getSession, hasAccountData, hasLegacyData, sessionFrom, setSession, updateAccount, type AccountSession } from "@/lib/account/session";

/**
 * Reprendre (ou créer) sa fiche mon-ecurie.fr et ouvrir son compte Be Stable,
 * dans cet ordre :
 *   1. voir sa fiche telle que les cavaliers la voient, et ce qui lui manque ;
 *   2. créer son compte (prénom, nom, e-mail, mot de passe) ;
 *   3. montrer que c'est bien son écurie, et mettre déjà ses places et son prix ;
 *   4. la confirmation, puis Be Stable.
 * La valeur d'abord, l'engagement ensuite.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Inscription />
    </Suspense>
  );
}

type Etape = "fiche" | "creer" | "compte" | "preuve" | "fait";
const FONCTIONS = ["Gérant·e ou propriétaire", "Associé·e", "Salarié·e, moniteur·rice", "Autre"];
const VIDE: Partial<Fiche> = { title: "", commune: "", code_postal: "", photos: [], formules: [], places_libres: "", prix_min: "" };

function Inscription() {
  const q = useSearchParams();
  const ficheId = Number(q.get("fiche")) || 0;
  const creation = !ficheId;
  const [compte, setCompte] = useState<AccountSession | null>(() => {
    const s = getSession();
    return s?.kind === "compte" ? s : null;
  });
  const [etape, setEtape] = useState<Etape>(creation ? "creer" : "fiche");
  const [fiche, setFiche] = useState<Partial<Fiche>>(VIDE);
  const [charge, setCharge] = useState(!creation);
  const [introuvable, setIntrouvable] = useState(false);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [adopt, setAdopt] = useState(false);

  useEffect(() => {
    if (ficheId)
      api.ecurie(ficheId).then(
        (f) => {
          setFiche(f);
          setCharge(false);
        },
        () => {
          setIntrouvable(true);
          setCharge(false);
        },
      );
    api.choix().then(setChoix, () => {});
  }, [ficheId]);

  const nom = fiche.title || "ton écurie";
  const n = { fiche: 1, creer: 1, compte: 2, preuve: 3, fait: 4 }[etape];
  const suivante = () => setEtape(compte ? "preuve" : "compte");

  if (adopt) return <AdoptChoice to="/parcours" />;

  const aside = (
    <>
      <FichePreview f={fiche} claimed={etape === "fait"} />
      {etape !== "creer" && <ResultSheet f={fiche} claimed={etape === "fait"} />}
    </>
  );

  return (
    <main className="bs-acc">
      <AccTop right={!compte ? <Link href="/compte/connexion" className="bs-link">J’ai déjà un compte</Link> : <span className="bs-help" style={{ margin: 0 }}>{compte.email}</span>} />
      <div className="bs-acc-split">
        <div style={{ maxWidth: 480, width: "100%" }}>
          {etape !== "fait" && (
            <>
              <div className="bs-steps-top" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <i key={i} className={i <= n ? "on" : ""} />
                ))}
              </div>
              <p>
                Étape {Math.min(n, 3)} sur 3 · {n === 1 ? (creation ? "ton écurie" : "ta fiche") : n === 2 ? "ton compte" : "la vérification"}
              </p>
            </>
          )}

          {etape === "fiche" &&
            (charge ? (
              <p className="bs-p" style={{ marginTop: 24 }}>
                Chargement de la fiche…
              </p>
            ) : introuvable ? (
              <>
                <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
                  Cette fiche n’est plus en ligne.
                </h1>
                <Link href="/bienvenue" className="bs-btn" style={{ marginTop: 18 }}>
                  Chercher mon écurie
                </Link>
              </>
            ) : (
              <EtapeFiche f={fiche} onOk={suivante} />
            ))}
          {etape === "creer" && <EtapeCreer f={fiche} setF={setFiche} choix={choix} onOk={suivante} />}
          {etape === "compte" && (
            <EtapeCompte
              nom={nom}
              onOk={(s) => {
                setCompte(s);
                // Le compte a déjà sa fiche ou sa demande (revendiquée sur le site) : rien à redemander.
                setEtape(s.listing && s.listing.status !== "refusee" ? "fait" : "preuve");
              }}
            />
          )}
          {etape === "preuve" && compte && (
            <EtapePreuve
              f={fiche}
              setF={setFiche}
              ficheId={ficheId}
              compte={compte}
              univers={(fiche as { univers?: string }).univers ?? ""}
              onOk={(listing) => {
                updateAccount({ listing });
                setEtape("fait");
              }}
              onDoublon={(id) => (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/compte/inscription/?fiche=${id}`)}
            />
          )}
          {etape === "fait" && (
            <EtapeFait
              nom={nom}
              creation={creation}
              onGo={(to) => {
                const s = getSession();
                if (s?.kind !== "compte") return;
                if (!hasAccountData(s.userId) && hasLegacyData()) setAdopt(true);
                else enter(s, to);
              }}
            />
          )}
        </div>
        <div className="aside bs-desk">{aside}</div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function EtapeFiche({ f, onOk }: { f: Partial<Fiche>; onOk: () => void }) {
  if (f.statut === "revendiquee")
    return (
      <>
        <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
          {f.title} a déjà son gérant.
        </h1>
        <p className="bs-p">C’est toi ? Connecte-toi avec ton compte mon-ecurie.fr : ta fiche t’attend dans Be Stable. Sinon, écris-nous à bonjour@mon-ecurie.fr, on regarde ensemble.</p>
        <Link href="/compte/connexion" className="bs-btn" style={{ marginTop: 18 }}>
          Me connecter
        </Link>
        <Link href="/bienvenue" className="bs-btn line" style={{ marginTop: 8 }}>
          Chercher une autre écurie
        </Link>
      </>
    );
  if (f.statut === "en_verification")
    return (
      <>
        <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
          Une demande est déjà en cours pour {f.title}.
        </h1>
        <p className="bs-p">Si elle vient de toi, crée ton accès Be Stable avec la même adresse e-mail : ton écurie peut tourner dans l’app pendant la vérification, et la fiche te rejoindra dès qu’elle est validée.</p>
        <button type="button" className="bs-btn" style={{ marginTop: 18 }} onClick={onOk}>
          C’est ma demande : créer mon accès
        </button>
        <Link href="/compte/connexion" className="bs-btn line" style={{ marginTop: 8 }}>
          J’ai déjà un compte
        </Link>
        <p className="bs-help" style={{ textAlign: "center" }}>Ce n’est pas toi ? Écris-nous à bonjour@mon-ecurie.fr, on regarde ensemble.</p>
      </>
    );
  const manque = 100 - (f.remplissage ?? 0);
  return (
    <>
      <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
        Voilà ta fiche, telle que les cavaliers la voient.
      </h1>
      <p className="bs-p">
        {manque > 40
          ? "Pour l’instant, la fiche ne leur donne pas de quoi te choisir : ni prix, ni places, ni photos. Reprends-la et complète-la en quelques minutes."
          : "La fiche est déjà bien remplie. Reprends-la pour qu’elle porte le badge « Revendiquée » et rester maître de ce qu’elle affiche."}
      </p>
      <div className="bs-mob">
        <FichePreview f={f} />
        <ResultSheet f={f} />
      </div>
      <button type="button" className="bs-btn" style={{ marginTop: 22 }} onClick={onOk}>
        C’est mon écurie, je la reprends <Picto name="arrowR" />
      </button>
      <p className="bs-help" style={{ textAlign: "center" }}>
        Gratuit. 0 % de commission sur tes pensions. Vérifié à la main par l’équipe.
      </p>
      <p style={{ textAlign: "center", marginTop: 12 }}>
        <Link href="/bienvenue" className="bs-link" style={{ color: "var(--ink-2)" }}>
          Ce n’est pas la bonne écurie
        </Link>
      </p>
    </>
  );
}

function EtapeCreer({ f, setF, choix, onOk }: { f: Partial<Fiche> & { univers?: string }; setF: (f: Partial<Fiche>) => void; choix: Choix | null; onOk: () => void }) {
  const [err, setErr] = useState("");
  const univers = choix?.univers ?? { "ecuries-proprietaires": "Propriétaires / Pension", "centres-equestres": "Centre équestre" };
  const set = (p: Record<string, unknown>) => setF({ ...f, ...p });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.title?.trim()) return setErr("title");
        if (!/^\d{5}$/.test(f.code_postal ?? "") || !f.commune?.trim()) return setErr("lieu");
        onOk();
      }}
      noValidate
    >
      <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
        Ajoutons ton écurie à l’annuaire.
      </h1>
      <p className="bs-p">Quatre informations suffisent. Elle reste invisible du public jusqu’à notre vérification.</p>
      <Field label="Nom de l’écurie" value={f.title ?? ""} onChange={(e) => set({ title: e.target.value })} autoComplete="organization" placeholder="Ex. Écurie des Tilleuls" error={err === "title" ? "Indique le nom de l’écurie." : undefined} />
      <div className="bs-lbl">
        <span>Ce que tu proposes surtout</span>
        <div className="bs-chips" style={{ marginTop: 0 }}>
          {Object.entries(univers).map(([k, l]) => (
            <button key={k} type="button" className="bs-chip" aria-pressed={(f.univers ?? "ecuries-proprietaires") === k} onClick={() => set({ univers: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <Field label="Adresse" optional value={f.adresse ?? ""} onChange={(e) => set({ adresse: e.target.value })} autoComplete="street-address" placeholder="Ex. 12 chemin des Prés" hint="Pour placer l’écurie au bon endroit sur la carte." />
      <div style={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", gap: 10 }}>
        <Field label="Code postal" inputMode="numeric" maxLength={5} value={f.code_postal ?? ""} onChange={(e) => set({ code_postal: e.target.value.replace(/\D/g, "") })} autoComplete="postal-code" />
        <Field label="Commune" value={f.commune ?? ""} onChange={(e) => set({ commune: e.target.value })} autoComplete="address-level2" />
      </div>
      {err === "lieu" && <p className="bs-err">Indique le code postal (5 chiffres) et la commune.</p>}
      <button type="submit" className="bs-btn" style={{ marginTop: 22 }}>
        Continuer <Picto name="arrowR" />
      </button>
      <p style={{ textAlign: "center", marginTop: 12 }}>
        <Link href="/bienvenue" className="bs-link" style={{ color: "var(--ink-2)" }}>
          Revenir à la recherche
        </Link>
      </p>
    </form>
  );
}

function EtapeCompte({ nom, onOk }: { nom: string; onOk: (s: AccountSession) => void }) {
  const [mode, setMode] = useState<"creer" | "connexion">("creer");
  const [prenom, setPrenom] = useState("");
  const [nomFamille, setNomFamille] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (mode === "creer" && (!prenom.trim() || !nomFamille.trim())) return setErr(new ApiError("nom_requis", "Indique ton prénom et ton nom : ils servent à vérifier la demande."));
    setBusy(true);
    try {
      const r = mode === "creer" ? await api.inscription({ prenom: prenom.trim(), nom: nomFamille.trim(), email: email.trim(), telephone: "", password: pw, site: "" }) : await api.connexion({ email: email.trim(), password: pw });
      const s = sessionFrom(r);
      setSession(s);
      onOk(s);
    } catch (x) {
      setErr(x instanceof ApiError ? x : new ApiError("erreur", "Une erreur est survenue. Réessaie dans un instant."));
    } finally {
      setBusy(false);
    }
  }

  const champ = (c: string) => (err && ((c === "email" && ["email_invalide", "compte_existe", "email_inconnu"].includes(err.code)) || (c === "pw" && ["mot_de_passe_court", "mauvais_mot_de_passe"].includes(err.code))) ? err.message : undefined);

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
        {mode === "creer" ? "Ton compte, pour ta fiche et pour Be Stable." : "Connecte-toi pour continuer."}
      </h1>
      <p className="bs-p">{mode === "creer" ? `Un seul compte : il te sert à gérer la fiche de ${nom} sur mon-ecurie.fr et à faire tourner l’écurie dans Be Stable.` : "Avec ton compte mon-ecurie.fr habituel."}</p>
      {mode === "creer" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10 }}>
          <Field label="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" autoFocus error={err?.code === "nom_requis" && !prenom.trim() ? " " : undefined} />
          <Field label="Nom" value={nomFamille} onChange={(e) => setNomFamille(e.target.value)} autoComplete="family-name" error={err?.code === "nom_requis" && !nomFamille.trim() ? " " : undefined} />
        </div>
      )}
      {err?.code === "nom_requis" && <p className="bs-err">{err.message}</p>}
      <Field
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={
          err?.code === "compte_existe" ? (
            <>
              Cette adresse a déjà un compte.{" "}
              <button type="button" onClick={() => (setMode("connexion"), setErr(null))}>
                Me connecter avec
              </button>
            </>
          ) : (
            champ("email")
          )
        }
        hint={mode === "creer" ? "Les e-mails de mon-ecurie.fr (validation, mot de passe) arrivent ici." : undefined}
      />
      <PasswordField value={pw} onChange={setPw} meter={mode === "creer"} autoComplete={mode === "creer" ? "new-password" : "current-password"} error={champ("pw")} />
      {mode === "connexion" && (
        <p style={{ textAlign: "right", marginTop: 8 }}>
          <Link href="/compte/oubli" className="bs-link">
            Mot de passe oublié ?
          </Link>
        </p>
      )}
      {err && !["email_invalide", "compte_existe", "email_inconnu", "mot_de_passe_court", "mauvais_mot_de_passe", "nom_requis"].includes(err.code) && <p className="bs-alert">{err.message}</p>}
      <button type="submit" className="bs-btn" style={{ marginTop: 20 }} disabled={busy || !email.trim() || (mode === "creer" ? pw.length < PW_MIN : !pw)}>
        {busy ? "Un instant…" : mode === "creer" ? "Créer mon compte et continuer" : "Me connecter et continuer"}
      </button>
      <p className="bs-help" style={{ textAlign: "center" }}>
        {mode === "creer" ? (
          <>
            En créant ton compte, tu acceptes les{" "}
            <a href="https://www.mon-ecurie.fr/cgu/" target="_blank" rel="noreferrer" className="bs-link" style={{ fontSize: 12.5 }}>
              conditions d’utilisation
            </a>{" "}
            de mon-ecurie.fr. Aucune carte bancaire demandée.
          </>
        ) : (
          <button type="button" className="bs-link" onClick={() => (setMode("creer"), setErr(null))}>
            Je n’ai pas encore de compte
          </button>
        )}
      </p>
    </form>
  );
}

function EtapePreuve({
  f,
  setF,
  ficheId,
  compte,
  univers,
  onOk,
  onDoublon,
}: {
  f: Partial<Fiche>;
  setF: (f: Partial<Fiche>) => void;
  ficheId: number;
  compte: AccountSession;
  univers: string;
  onOk: (l: NonNullable<AccountSession["listing"]>) => void;
  onDoublon: (id: number) => void;
}) {
  const [fonction, setFonction] = useState("");
  const [tel, setTel] = useState(compte.telephone ?? "");
  const [siret, setSiret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const places = f.places_libres ?? "";
  const nbPlaces = useMemo(() => (places === "" ? null : Number(places)), [places]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (!fonction) return setErr(new ApiError("fonction_requise", "Choisis ton rôle dans l’écurie."));
    if (tel.replace(/\D/g, "").length < 9) return setErr(new ApiError("telephone_requis", "Indique un numéro où te joindre."));
    setBusy(true);
    const demande = {
      fonction,
      telephone: tel,
      siret,
      raison: "",
      message,
      fiche: { places_libres: f.places_libres ?? "", prix_min: f.prix_min ?? "", ...(ficheId ? {} : { title: f.title, adresse: f.adresse, code_postal: f.code_postal, commune: f.commune }) },
    };
    try {
      const r = ficheId ? await api.revendiquer(ficheId, demande) : await api.creer({ ...demande, univers });
      onOk(r.listing);
    } catch (x) {
      const e2 = x instanceof ApiError ? x : new ApiError("erreur", "Une erreur est survenue. Réessaie dans un instant.");
      // Le compte a déjà une demande en cours (déposée sur le site, ou juste avant) : c'est gagné.
      if (e2.code === "deja_une_fiche" && e2.data.listing) return onOk(e2.data.listing as NonNullable<AccountSession["listing"]>);
      setErr(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="bs-d bs-t1" style={{ marginTop: 10 }}>
        Dernière ligne droite : montre que c’est ton écurie.
      </h1>
      <p className="bs-p">On vérifie chaque demande à la main, pour qu’aucune fiche ne change de main par erreur. Ça protège aussi la tienne.</p>

      <div className="bs-lbl">
        <span>Ton rôle à l’écurie</span>
        <div className="bs-chips" style={{ marginTop: 0 }}>
          {FONCTIONS.map((x) => (
            <button key={x} type="button" className="bs-chip" aria-pressed={fonction === x} onClick={() => setFonction(x)}>
              {x}
            </button>
          ))}
        </div>
        {err?.code === "fonction_requise" && <p className="bs-err">{err.message}</p>}
      </div>
      <Field label="Ton téléphone" type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} hint="Pour te joindre si une question se pose pendant la vérification. Il n’apparaît pas sur la fiche." error={err?.code === "telephone_requis" ? err.message : undefined} />
      <Field label="SIRET de l’écurie" optional inputMode="numeric" value={siret} onChange={(e) => setSiret(e.target.value.replace(/[^\d ]/g, ""))} hint="Le plus rapide pour vérifier : 14 chiffres, sur un Kbis ou une facture." error={err?.code === "siret_invalide" ? err.message : undefined} />

      <p className="bs-sec" style={{ marginTop: 26 }}>Pendant qu’on vérifie, mets ta fiche à jour</p>
      <div className="bs-lbl" style={{ marginTop: 6 }}>
        <span>
          Places libres en pension <em>facultatif</em>
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="bs-in" style={{ padding: 0, width: 148 }}>
            <button type="button" className="eye" aria-label="Une place de moins" onClick={() => setF({ ...f, places_libres: String(Math.max(0, (nbPlaces ?? 1) - 1)) })}>
              −
            </button>
            <input inputMode="numeric" aria-label="Places libres" value={places} placeholder="?" onChange={(e) => setF({ ...f, places_libres: e.target.value.replace(/\D/g, "").slice(0, 3) })} style={{ textAlign: "center", fontWeight: 700 }} />
            <button type="button" className="eye" aria-label="Une place de plus" onClick={() => setF({ ...f, places_libres: String((nbPlaces ?? 0) + 1) })}>
              +
            </button>
          </div>
          <button type="button" className="bs-chip" aria-pressed={places === "0"} onClick={() => setF({ ...f, places_libres: "0" })}>
            Complet
          </button>
          <button type="button" className="bs-chip" aria-pressed={places === ""} onClick={() => setF({ ...f, places_libres: "" })}>
            Je préfère ne pas dire
          </button>
        </div>
        <p className="bs-help">C’est la première chose qu’un cavalier regarde.</p>
      </div>
      <Field label="Pension à partir de" optional inputMode="numeric" unit="€ / mois" value={f.prix_min ?? ""} onChange={(e) => setF({ ...f, prix_min: e.target.value.replace(/\D/g, "").slice(0, 5) })} hint="Ton tarif le plus bas. Tu détailleras tes formules ensuite." />
      <label className="bs-lbl">
        <span>
          Un mot pour l’équipe <em>facultatif</em>
        </span>
        <span className="bs-in" style={{ display: "flex", margin: 0, fontWeight: 400 }}>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. l’adresse a changé, l’écurie a été reprise en 2024…" />
        </span>
      </label>

      <div className="bs-mob" style={{ marginTop: 18 }}>
        <FichePreview f={f} />
      </div>

      {err?.code === "doublon" && (
        <p className="bs-alert" role="alert">
          <Picto name="horse" />
          <span>
            {err.message}{" "}
            <button type="button" className="bs-link" onClick={() => onDoublon(Number((err.data.fiche as { id?: number } | undefined)?.id ?? 0))}>
              Voir la fiche existante
            </button>
          </span>
        </p>
      )}
      {err && !["fonction_requise", "telephone_requis", "siret_invalide", "doublon"].includes(err.code) && (
        <p className="bs-alert" role="alert">
          {err.message}
        </p>
      )}
      <button type="submit" className="bs-btn" style={{ marginTop: 20 }} disabled={busy}>
        {busy ? "Envoi…" : "Envoyer ma demande"}
      </button>
      <p className="bs-help" style={{ textAlign: "center" }}>
        Réponse par e-mail, en général sous deux jours ouvrés.
      </p>
    </form>
  );
}

function EtapeFait({ nom, creation, onGo }: { nom: string; creation: boolean; onGo: (to: string) => void }) {
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <Rosette lines={["Demande", "envoyée"]} size={112} />
      </div>
      <h1 className="bs-d bs-t1" style={{ marginTop: 14, textAlign: "center" }}>
        Demande envoyée.
      </h1>
      <p className="bs-p" style={{ textAlign: "center" }}>
        {creation ? `${nom} est en route vers l’annuaire.` : `${nom} affiche déjà « En vérification ».`} Un e-mail de confirmation vient de partir.
      </p>
      <ol className="bs-steps" style={{ marginTop: 20 }}>
        <li>
          <span>1</span>Nous vérifions à la main que tu gères bien {nom}. Compte deux jours ouvrés.
        </li>
        <li>
          <span>2</span>Tu reçois un e-mail dès que la fiche est à toi, avec ce que tu viens de saisir déjà en place.
        </li>
        <li>
          <span>3</span>La fiche porte le badge « Revendiquée » : les cavaliers savent que les infos viennent de toi.
        </li>
      </ol>
      <p className="bs-p" style={{ marginTop: 18, color: "var(--ink-1)", fontWeight: 560 }}>
        En attendant, ton écurie peut déjà tourner dans Be Stable.
      </p>
      <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={() => onGo("/parcours")}>
        Installer mon écurie dans Be Stable <Picto name="arrowR" />
      </button>
      <button type="button" className="bs-btn line" style={{ marginTop: 8 }} onClick={() => onGo("/ma-fiche")}>
        Compléter ma fiche
      </button>
    </div>
  );
}
