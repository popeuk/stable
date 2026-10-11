"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccTop, Field } from "@/components/bs/account-ui";
import { Picto } from "@/components/bs/picto";
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

  return (
    <main className="bs-acc">
      <AccTop right={<Link href="/compte/connexion" className="bs-link">Me connecter</Link>} />
      <div style={{ marginTop: "min(12vh, 72px)", maxWidth: 420, width: "100%", alignSelf: "center" }}>
        {sent ? (
          <>
            <h1 className="bs-d bs-t1">Regarde ta boîte mail.</h1>
            <p className="bs-alert ok" role="status">
              <Picto name="check" />
              <span>
                Si un compte existe pour <b>{email.trim()}</b>, un e-mail de mon-ecurie.fr vient de partir avec un lien pour choisir un nouveau mot de passe.
              </span>
            </p>
            <ul className="bs-steps" style={{ marginTop: 18 }}>
              <li>
                <span>1</span>Le lien reste valable 24 heures.
              </li>
              <li>
                <span>2</span>Rien reçu dans 5 minutes ? Regarde dans les indésirables.
              </li>
              <li>
                <span>3</span>Toujours rien ? Vérifie l’adresse et renvoie le lien.
              </li>
            </ul>
            <button type="button" className="bs-btn line" onClick={() => setSent(false)}>
              Renvoyer le lien
            </button>
          </>
        ) : (
          <>
            <h1 className="bs-d bs-t1">Mot de passe oublié</h1>
            <p className="bs-p">Donne l’adresse de ton compte. Tu reçois un lien pour choisir un nouveau mot de passe, valable pour Be Stable et pour mon-ecurie.fr.</p>
            <form onSubmit={submit} noValidate>
              <Field label="E-mail du compte" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus error={err || undefined} />
              <button type="submit" className="bs-btn" style={{ marginTop: 18 }} disabled={busy || !email.trim()}>
                {busy ? "Envoi…" : "Recevoir le lien"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: 16 }}>
              <Link href="/compte/connexion" className="bs-link">
                Je l’ai retrouvé, me connecter
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
