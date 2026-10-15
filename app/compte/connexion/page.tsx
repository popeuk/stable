"use client";

import Link from "next/link";
import { useState } from "react";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { ArTop, CodeInput, PwInput } from "@/components/bs/rejoindre";
import { Ill } from "@/components/carnet/ui";
import { api, ApiError, type AuthResponse } from "@/lib/account/api";
import { enter, hasAccountData, hasLegacyData, sessionFrom, setSession } from "@/lib/account/session";

/**
 * Se connecter : l'e-mail, puis le code reçu. Pas de mot de passe à retenir.
 * Ceux qui en ont un sur mon-ecurie.fr peuvent toujours s'en servir.
 */
export default function Page() {
  const [mode, setMode] = useState<"email" | "code" | "mdp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState(false);

  function ouvrir(r: AuthResponse) {
    const s = sessionFrom(r);
    if (!hasAccountData(s.userId) && hasLegacyData()) {
      setSession(s);
      return setAdopt(true);
    }
    enter(s, r.listing ? "/accueil" : "/bienvenue");
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
        <AdoptChoice />
      </div>
    );

  const top = (
    <ArTop
      onBack={mode === "email" ? undefined : () => (setMode("email"), setErr(""))}
      right={
        <Link href="/bienvenue" className="ar-link">
          Créer mon accès
        </Link>
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
            <div className="hero-ill rise" style={{ height: 170 }}>
              <Ill n="assise" alt="La gérante, assise, une tasse de café à la main." />
            </div>
            <div className="q rise" style={{ animationDelay: ".08s" }}>
              <h3>Content de te revoir.</h3>
            </div>
            <label className="input ar-in">
              <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
            </label>
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
