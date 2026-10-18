"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { GardeFait, GardeListe } from "@/components/bs/garder";
import { ArTop, CodeInput } from "@/components/bs/rejoindre";
import { Ill } from "@/components/carnet/ui";
import { api, ApiError, appUrl, type AuthResponse } from "@/lib/account/api";
import { AVEC_APPLE, AVEC_GOOGLE, lireRetour, partirVers, revenirDe, type Fournisseur } from "@/lib/account/oauth";
import { enter, getSession, hasAccountData, hasLegacyData, hasLocaleData, sessionFrom, setSession, type AccountSession } from "@/lib/account/session";
import { adoptLocale, resumeLocale, type ResumeEssai } from "@/lib/account/vault";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Se connecter : l'e-mail, puis le code reçu, ou « Continuer avec Google »
 * (Apple quand il sera branché). Plus de mot de passe (décision du 18 octobre).
 * Google revient ici avec ?code=… : le compte s'ouvre comme avec le code.
 *
 * Avec ?garder=1 (le bandeau « Garder mes chiffres ») ou depuis l'écurie
 * essayée sans compte : « On garde tout pour demain. », puis l'écurie de
 * l'essai passe dans le compte (chiffrée). Si le compte a déjà la sienne,
 * le gérant choisit laquelle garder.
 *
 * En gardant un essai, on demande d'abord le nom de l'écurie (rien n'est
 * revendiqué : la fiche mon-ecurie.fr se reprend plus tard). Il devient le
 * nom de l'écurie dans l'app et part au site après le code, pour les e-mails.
 */
const SANS_NOM = (n: string) => !n.trim() || n.trim() === "Mon écurie";
export default function Page() {
  const [mode, setMode] = useState<"nom" | "email" | "code">("email");
  const [nom, setNom] = useState("");
  /** Pas encore d'écurie : un projet, dit au site pour les e-mails. */
  const [projet, setProjet] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState<"legacy" | "locale" | null>(null);
  const [garder, setGarder] = useState<ResumeEssai | null>(null);
  const [fait, setFait] = useState<AccountSession | null>(null);

  useEffect(() => {
    const voulu = new URLSearchParams(window.location.search).get("garder") === "1" || getSession()?.kind === "locale";
    if (voulu && hasLocaleData()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGarder(resumeLocale() ?? { chevaux: 0, pension: 0, frais: 0, seances: 0 });
      const deja = useSettingsStore.getState().stableName;
      setNom(SANS_NOM(deja) ? "" : deja);
      setMode("nom");
    }
    // Retour de Google ou d'Apple.
    const retour = lireRetour(window.location.search);
    if (!retour) return;
    window.history.replaceState(null, "", window.location.pathname + (voulu ? "?garder=1" : ""));
    if (retour.erreur) return setErr("La connexion a été annulée. Réessaie, ou reçois un code par e-mail.");
    void run(async () => ouvrir(await api.connexionSupabase(await revenirDe(retour.code!))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function avec(f: Fournisseur) {
    const retour = appUrl(`/compte/connexion/${garder ? "?garder=1" : ""}`);
    void run(() => partirVers(f, retour));
  }

  async function ouvrir(r: AuthResponse) {
    const s = sessionFrom(r);
    // L'écurie essayée sans compte passe dans le compte.
    if (hasLocaleData()) {
      setSession(s);
      // Le nom (ou le projet) part au site, avec le jeton du compte : sans effet tant que l'extension ne le connaît pas.
      // Lu dans les réglages de l'essai : il survit au détour par Google.
      const deja = useSettingsStore.getState().stableName;
      const ecurie = projet || SANS_NOM(deja) ? "" : deja.trim();
      if (garder && (ecurie || projet)) void api.majMoi(projet ? { projet: true } : { ecurie }).catch(() => {});
      if (hasAccountData(s.userId)) return setAdopt("locale");
      await adoptLocale("locale");
      return setFait(s);
    }
    if (!hasAccountData(s.userId) && hasLegacyData()) {
      setSession(s);
      return setAdopt("legacy");
    }
    // Sans fiche aussi : la fiche se propose plus tard, dans l'app.
    enter(s, "/accueil");
  }

  async function run(f: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await f();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  if (adopt)
    return (
      <div className="carnet">
        <AdoptChoice source={adopt} />
      </div>
    );

  if (fait)
    return (
      <div className="carnet">
        <div className="ar">
          <GardeFait onOpen={() => enter(fait, "/accueil")} />
        </div>
      </div>
    );

  const top = (
    <ArTop
      onBack={mode === "code" ? () => (setMode("email"), setErr("")) : mode === "email" && garder ? () => (setMode("nom"), setErr("")) : undefined}
      right={
        garder ? (
          <Link href="/accueil" className="ar-link">
            Plus tard
          </Link>
        ) : (
          <Link href="/bienvenue" className="ar-link">
            Essayer sans compte
          </Link>
        )
      }
    />
  );
  const erreur = err ? (
    <p className="ar-err" role="alert">
      {err}
    </p>
  ) : null;

  return (
    <div className="carnet">
      <div className="ar ar-duo">
        {mode === "nom" && (
          <form
            className="ar-v"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (nom.trim().length < 2) return setErr("Le nom de ton écurie, tel que tes clients le disent.");
              useSettingsStore.getState().setIdentity({ stableName: nom.trim() });
              setProjet(false);
              setErr("");
              setMode("email");
            }}
          >
            {top}
            <div className="q rise">
              <h1>Ton écurie s’appelle comment ?</h1>
              <p>On garde ton mois à son nom.</p>
            </div>
            <label className="input ar-in">
              <input autoFocus type="text" autoComplete="organization" maxLength={120} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Le nom que tes clients connaissent" aria-label="Le nom de ton écurie" />
            </label>
            {garder && <GardeListe r={garder} />}
            {erreur}
            <div className="foot">
              <button className="btn full" disabled={!nom.trim()}>
                Continuer
              </button>
              <button type="button" className="lnk" onClick={() => (setNom(""), setProjet(true), setErr(""), setMode("email"))}>
                Je n’ai pas encore d’écurie
              </button>
            </div>
          </form>
        )}

        {mode === "email" && (
          <form className="ar-v" noValidate onSubmit={(e) => (e.preventDefault(), run(async () => (await api.envoyerCode(email.trim()), setCode(""), setMode("code"))))}>
            {top}
            {garder ? (
              <div className="q rise">
                <h1>{nom.trim() ? `On garde ${nom.trim()}.` : "On garde tout pour demain."}</h1>
                <p>Ton e-mail, puis un code.</p>
              </div>
            ) : (
              <>
                <div className="hero-ill rise" style={{ height: 170 }}>
                  <Ill n="assise" alt="La gérante, assise, une tasse de café à la main." />
                </div>
                <div className="q rise" style={{ animationDelay: ".08s" }}>
                  <h1>Content de te revoir.</h1>
                </div>
              </>
            )}
            <label className="input ar-in">
              <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
            </label>
            {garder && !nom.trim() && <GardeListe r={garder} />}
            {erreur}
            <div className="foot">
              <button className="btn full" disabled={busy || !email.trim()}>
                {busy ? "Envoi…" : "Recevoir mon code"}
              </button>
              {AVEC_GOOGLE && (
                <button type="button" className="btn line full" disabled={busy} onClick={() => avec("google")}>
                  Continuer avec Google
                </button>
              )}
              {AVEC_APPLE && (
                <button type="button" className="btn line full" disabled={busy} onClick={() => avec("apple")}>
                  Continuer avec Apple
                </button>
              )}
              <p className="ar-proof">Le même compte que sur mon-ecurie.fr. Pas de mot de passe.</p>
            </div>
          </form>
        )}

        {mode === "code" && (
          <form className="ar-v" onSubmit={(e) => (e.preventDefault(), run(async () => ouvrir(await api.verifierCode(email.trim(), code))))}>
            {top}
            <div className="q">
              <h1>Le code reçu.</h1>
              <p>Envoyé à {email.trim()}.</p>
            </div>
            <CodeInput
              value={code}
              disabled={busy}
              onChange={(v) => {
                setCode(v);
                if (v.length === 6) run(async () => ouvrir(await api.verifierCode(email.trim(), v)));
              }}
            />
            {erreur}
            <div className="foot">
              <button className="btn full" disabled={busy || code.length !== 6}>
                {busy ? "Vérification…" : "Entrer"}
              </button>
              <p className="ar-proof">
                Rien reçu ? Regarde les indésirables, ou{" "}
                <button type="button" className="lnk" onClick={() => run(async () => (await api.envoyerCode(email.trim()), setCode("")))}>
                  renvoie le code
                </button>
                .
              </p>
            </div>
          </form>
        )}

        <aside className="ar-side" aria-hidden="true">
          <div className="hero-ill">
            <Ill n="sereine" className="mul" />
          </div>
          <p className="k">Be Stable</p>
          <p className="ar-big">Ton écurie, ce qu’elle te rapporte.</p>
        </aside>
      </div>
    </div>
  );
}
