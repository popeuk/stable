"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArTop } from "@/components/bs/rejoindre";
import { Ill } from "@/components/carnet/ui";
import { api, ApiError } from "@/lib/account/api";

/** Mot de passe oublié : un lien par e-mail, valable 24 heures. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Oubli />
    </Suspense>
  );
}

function Oubli() {
  const [email, setEmail] = useState(useSearchParams().get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await api.oubli(email.trim());
      setSent(true);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  const top = (
    <ArTop
      right={
        <Link href="/compte/connexion" className="ar-link">
          Me connecter
        </Link>
      }
    />
  );

  return (
    <div className="carnet">
      <div className="ar">
        {sent ? (
          <div className="ar-v">
            {top}
            <div className="hero-ill rise" style={{ height: 150 }}>
              <Ill n="foin" alt="" />
            </div>
            <div className="q rise" style={{ animationDelay: ".08s" }} role="status">
              <h3>Regarde ta boîte mail.</h3>
              <p>
                Si un compte existe pour <b>{email.trim()}</b>, un e-mail de mon-ecurie.fr vient de partir avec un lien pour choisir un nouveau mot de passe.
              </p>
            </div>
            <ol className="ar-steps">
              <li>Le lien reste valable 24 heures.</li>
              <li>Rien reçu dans 5 minutes ? Regarde dans les indésirables.</li>
              <li>Toujours rien ? Vérifie l’adresse et renvoie le lien.</li>
            </ol>
            <div className="foot">
              <button type="button" className="btn line full" onClick={() => setSent(false)}>
                Renvoyer le lien
              </button>
            </div>
          </div>
        ) : (
          <form className="ar-v" onSubmit={submit} noValidate>
            {top}
            <div className="q">
              <h3>Mot de passe oublié</h3>
              <p>Donne l’adresse de ton compte. Tu reçois un lien pour choisir un nouveau mot de passe, valable pour Be Stable et pour mon-ecurie.fr.</p>
            </div>
            <div className="ar-form">
              <label className="field">
                <span>E-mail du compte</span>
                <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus aria-invalid={!!err} />
              </label>
            </div>
            {err && (
              <p className="ar-err" role="alert">
                {err}
              </p>
            )}
            <div className="foot">
              <button type="submit" className="btn full" disabled={busy || !email.trim()}>
                {busy ? "Envoi…" : "Recevoir le lien"}
              </button>
              <Link href="/compte/connexion" className="lnk">
                Je l’ai retrouvé, me connecter
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
