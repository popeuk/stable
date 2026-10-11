"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccTop, PasswordField } from "@/components/bs/account-ui";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { Picto } from "@/components/bs/picto";
import { api, ApiError, PW_MIN } from "@/lib/account/api";
import { enter, hasAccountData, hasLegacyData, sessionFrom, setSession } from "@/lib/account/session";

/** Le lien de l'e-mail arrive ici : nouveau mot de passe, puis connexion directe. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Nouveau />
    </Suspense>
  );
}

function Nouveau() {
  const q = useSearchParams();
  const login = q.get("login") ?? "";
  const key = q.get("key") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [adopt, setAdopt] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || password.length < PW_MIN) return;
    setBusy(true);
    setErr(null);
    try {
      const s = sessionFrom(await api.nouveau({ login, key, password }));
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
  const broken = !login || !key || err?.code === "lien_invalide";

  return (
    <main className="bs-acc">
      <AccTop right={<Link href="/compte/connexion" className="bs-link">Me connecter</Link>} />
      <div style={{ marginTop: "min(12vh, 72px)", maxWidth: 420, width: "100%", alignSelf: "center" }}>
        {broken ? (
          <>
            <h1 className="bs-d bs-t1">Ce lien n’est plus valable.</h1>
            <p className="bs-p">Il a peut-être déjà servi, ou il date de plus de 24 heures. Demande-en un nouveau : c’est immédiat.</p>
            <Link href="/compte/oubli" className="bs-btn" style={{ marginTop: 18 }}>
              Recevoir un nouveau lien
            </Link>
          </>
        ) : (
          <>
            <h1 className="bs-d bs-t1">Choisis ton nouveau mot de passe</h1>
            <p className="bs-p">Il remplace l’ancien sur Be Stable et sur mon-ecurie.fr. Tu seras connecté juste après.</p>
            <form onSubmit={submit} noValidate>
              <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} error={err && err.code !== "lien_invalide" ? err.message : undefined} />
              <button type="submit" className="bs-btn" style={{ marginTop: 18 }} disabled={busy || password.length < PW_MIN}>
                {busy ? "Enregistrement…" : (
                  <>
                    Enregistrer et me connecter <Picto name="arrowR" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
