"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordField } from "@/components/bs/account-ui";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { Picto } from "@/components/bs/picto";
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

  if (adopt) return <AdoptChoice />;

  return (
    <main className="rj">
      <div className="rj-main">
        <header className="rj-top">
          {mode === "email" ? (
            <span className="bs-wm">be stable</span>
          ) : (
            <button type="button" className="rj-back" onClick={() => (setMode("email"), setErr(""))} aria-label="Revenir">
              <Picto name="chevL" />
            </button>
          )}
          <Link href="/bienvenue" className="bs-link">
            Créer mon accès
          </Link>
        </header>

        {mode === "email" && (
          <form className="rj-step" noValidate onSubmit={(e) => (e.preventDefault(), run(async () => (await api.envoyerCode(email.trim()), setCode(""), setMode("code"))))}>
            <h1 className="rj-q">Content de te revoir.</h1>
            <label className="rj-in">
              <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
            </label>
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go" disabled={busy || !email.trim()}>
                {busy ? "Envoi…" : "Recevoir mon code"}
              </button>
              <p className="rj-proof">
                Le même compte que sur mon-ecurie.fr.{" "}
                <button type="button" className="bs-link" onClick={() => (setMode("mdp"), setErr(""))}>
                  J’ai un mot de passe
                </button>
              </p>
            </div>
          </form>
        )}

        {mode === "code" && (
          <form className="rj-step" onSubmit={(e) => (e.preventDefault(), run(async () => ouvrir(await api.verifierCode(email.trim(), code))))}>
            <h1 className="rj-q">Le code reçu.</h1>
            <p className="rj-sub">Envoyé à {email.trim()}.</p>
            <label className="rj-code">
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                disabled={busy}
                aria-label="Code à six chiffres"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) run(async () => ouvrir(await api.verifierCode(email.trim(), v)));
                }}
              />
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={i === code.length ? "on" : code[i] ? "full" : ""}>
                  {code[i] ?? ""}
                </span>
              ))}
            </label>
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go" disabled={busy || code.length !== 6}>
                {busy ? "Vérification…" : "Entrer"}
              </button>
              <p className="rj-proof">
                Rien reçu ? Regarde les indésirables, ou{" "}
                <button type="button" className="bs-link" onClick={() => run(async () => (await api.envoyerCode(email.trim()), setCode("")))}>
                  renvoie le code
                </button>
                .
              </p>
            </div>
          </form>
        )}

        {mode === "mdp" && (
          <form className="rj-step" noValidate onSubmit={(e) => (e.preventDefault(), run(async () => ouvrir(await api.connexion({ email: email.trim(), password: pw }))))}>
            <h1 className="rj-q">Avec ton mot de passe.</h1>
            <label className="rj-in">
              <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
            </label>
            <PasswordField value={pw} onChange={setPw} meter={false} autoComplete="current-password" />
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go" disabled={busy || !email.trim() || !pw}>
                {busy ? "Connexion…" : "Me connecter"}
              </button>
              <p className="rj-proof">
                <Link href={`/compte/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="bs-link">
                  Mot de passe oublié ?
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
      <aside className="rj-side" aria-hidden="true">
        <div className="rj-side-in">
          <p className="rj-side-t">Be Stable</p>
          <p className="bs-d" style={{ fontSize: 40, marginTop: 12, color: "var(--ink-1)" }}>
            Ton écurie, ce qu’elle te <span className="bs-hl">rapporte</span>.
          </p>
        </div>
      </aside>
    </main>
  );
}
