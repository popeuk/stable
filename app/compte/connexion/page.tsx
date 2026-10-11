"use client";

import Link from "next/link";
import { useState } from "react";
import { AccTop, Field, PasswordField } from "@/components/bs/account-ui";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { Picto } from "@/components/bs/picto";
import { api, ApiError } from "@/lib/account/api";
import { enter, hasAccountData, hasLegacyData, sessionFrom, setSession } from "@/lib/account/session";

/**
 * Se connecter. Le compte est celui de mon-ecurie.fr : un gérant qui a déjà
 * revendiqué sa fiche entre ici avec son mot de passe habituel.
 */
export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [adopt, setAdopt] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.connexion({ email: email.trim(), password });
      const s = sessionFrom(r);
      if (!hasAccountData(s.userId) && hasLegacyData()) {
        setSession(s);
        setAdopt(true);
      } else enter(s);
    } catch (x) {
      setErr(x instanceof ApiError ? x : new ApiError("erreur", "Une erreur est survenue. Réessayez dans un instant."));
    } finally {
      setBusy(false);
    }
  }

  if (adopt) return <AdoptChoice />;

  return (
    <main className="bs-acc">
      <AccTop right={<Link href="/bienvenue" className="bs-link">Créer un compte</Link>} />
      <div style={{ marginTop: "min(12vh, 72px)", maxWidth: 420, width: "100%", alignSelf: "center" }}>
        <h1 className="bs-d bs-t1">Content de te revoir.</h1>
        <p className="bs-p">Ton compte mon-ecurie.fr marche ici aussi : même e-mail, même mot de passe.</p>
        <form onSubmit={submit} noValidate style={{ marginTop: 8 }}>
          <Field label="E-mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus error={err?.code === "email_inconnu" ? err.message : undefined} />
          <PasswordField value={password} onChange={setPassword} autoComplete="current-password" meter={false} error={err?.code === "mauvais_mot_de_passe" ? err.message : undefined} />
          <p style={{ textAlign: "right", marginTop: 8 }}>
            <Link href={`/compte/oubli${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="bs-link">
              Mot de passe oublié ?
            </Link>
          </p>
          {err && err.code !== "email_inconnu" && err.code !== "mauvais_mot_de_passe" && (
            <p className="bs-alert" role="alert">
              <Picto name="clock" />
              <span>{err.message}</span>
            </p>
          )}
          <button type="submit" className="bs-btn" style={{ marginTop: 18 }} disabled={busy || !email || !password}>
            {busy ? "Connexion…" : "Me connecter"}
          </button>
        </form>
        <div className="bs-or">pas encore de compte</div>
        <Link href="/bienvenue" className="bs-btn line">
          Trouver mon écurie et créer mon compte
        </Link>
        <p className="bs-help" style={{ textAlign: "center", marginTop: 14 }}>
          Ta gestion (chevaux, argent, planning) reste chiffrée sur cet appareil. Seule ta fiche publique passe par mon-ecurie.fr.
        </p>
      </div>
    </main>
  );
}
