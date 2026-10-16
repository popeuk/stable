"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { GardeFait, GardeListe } from "@/components/bs/garder";
import { ArTop, CodeInput, PwInput } from "@/components/bs/rejoindre";
import { Ill } from "@/components/carnet/ui";
import { api, ApiError, type AuthResponse } from "@/lib/account/api";
import { enter, getSession, hasAccountData, hasLegacyData, hasLocaleData, sessionFrom, setSession, type AccountSession } from "@/lib/account/session";
import { adoptLocale, resumeLocale, type ResumeEssai } from "@/lib/account/vault";

/**
 * Se connecter : l'e-mail, puis le code reçu. Pas de mot de passe à retenir.
 * Ceux qui en ont un sur mon-ecurie.fr peuvent toujours s'en servir.
 *
 * Avec ?garder=1 (le bandeau « Garder mes chiffres ») ou depuis l'écurie
 * essayée sans compte : « On garde tout pour demain. », puis l'écurie de
 * l'essai passe dans le compte (chiffrée). Si le compte a déjà la sienne,
 * le gérant choisit laquelle garder.
 */
export default function Page() {
  const [mode, setMode] = useState<"email" | "code" | "mdp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState<"legacy" | "locale" | null>(null);
  const [garder, setGarder] = useState<ResumeEssai | null>(null);
  const [fait, setFait] = useState<AccountSession | null>(null);

  useEffect(() => {
    const voulu = new URLSearchParams(window.location.search).get("garder") === "1" || getSession()?.kind === "locale";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (voulu && hasLocaleData()) setGarder(resumeLocale() ?? { chevaux: 0, pension: 0, frais: 0, seances: 0 });
  }, []);

  async function ouvrir(r: AuthResponse) {
    const s = sessionFrom(r);
    // L'écurie essayée sans compte passe dans le compte.
    if (hasLocaleData()) {
      setSession(s);
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
      onBack={mode === "email" ? undefined : () => (setMode("email"), setErr(""))}
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
        {mode === "email" && (
          <form className="ar-v" noValidate onSubmit={(e) => (e.preventDefault(), run(async () => (await api.envoyerCode(email.trim()), setCode(""), setMode("code"))))}>
            {top}
            {garder ? (
              <div className="q rise">
                <h3>On garde tout pour demain.</h3>
                <p>Ton e-mail, puis un code. Pas de mot de passe.</p>
              </div>
            ) : (
              <>
                <div className="hero-ill rise" style={{ height: 170 }}>
                  <Ill n="assise" alt="La gérante, assise, une tasse de café à la main." />
                </div>
                <div className="q rise" style={{ animationDelay: ".08s" }}>
                  <h3>Content de te revoir.</h3>
                </div>
              </>
            )}
            <label className="input ar-in">
              <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
            </label>
            {garder && <GardeListe r={garder} />}
            {erreur}
            <div className="foot">
              <button className="btn full" disabled={busy || !email.trim()}>
                {busy ? "Envoi…" : "Recevoir mon code"}
              </button>
              <p className="ar-proof">
                Le même compte que sur mon-ecurie.fr.{" "}
                <button type="button" className="lnk" onClick={() => (setMode("mdp"), setErr(""))}>
                  J’ai un mot de passe
                </button>
              </p>
            </div>
          </form>
        )}

        {mode === "code" && (
          <form className="ar-v" onSubmit={(e) => (e.preventDefault(), run(async () => ouvrir(await api.verifierCode(email.trim(), code))))}>
            {top}
            <div className="q">
              <h3>Le code reçu.</h3>
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

        {mode === "mdp" && (
          <form className="ar-v" noValidate onSubmit={(e) => (e.preventDefault(), run(async () => ouvrir(await api.connexion({ email: email.trim(), password: pw }))))}>
            {top}
            <div className="q">
              <h3>Avec ton mot de passe.</h3>
            </div>
            <div className="ar-form">
              <label className="field">
                <span>E-mail</span>
                <input className="input" autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" />
              </label>
              <PwInput value={pw} onChange={setPw} meter={false} autoComplete="current-password" />
            </div>
            {erreur}
            <div className="foot">
              <button className="btn full" disabled={busy || !email.trim() || !pw}>
                {busy ? "Connexion…" : "Me connecter"}
              </button>
              <p className="ar-proof">
                <Link href={`/compte/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="lnk">
                  Mot de passe oublié ?
                </Link>
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
