"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { ArTop, PwInput } from "@/components/bs/rejoindre";
import { Ic } from "@/components/carnet/ui";
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

  if (adopt)
    return (
      <div className="carnet">
        <AdoptChoice />
      </div>
    );
  const broken = !login || !key || err?.code === "lien_invalide";
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
        {broken ? (
          <div className="ar-v">
            {top}
            <div className="q">
              <h3>Ce lien n’est plus valable.</h3>
              <p>Il a peut-être déjà servi, ou il date de plus de 24 heures. Demande-en un nouveau : c’est immédiat.</p>
            </div>
            <div className="foot">
              <Link href="/compte/oubli" className="btn full">
                Recevoir un nouveau lien
              </Link>
            </div>
          </div>
        ) : (
          <form className="ar-v" onSubmit={submit} noValidate>
            {top}
            <div className="q">
              <h3>Choisis ton nouveau mot de passe</h3>
              <p>Il remplace l’ancien sur Be Stable et sur mon-ecurie.fr. Tu seras connecté juste après.</p>
            </div>
            <div className="ar-form">
              <PwInput label="Nouveau mot de passe" value={password} onChange={setPassword} error={err && err.code !== "lien_invalide" ? err.message : undefined} />
            </div>
            <div className="foot">
              <button type="submit" className="btn full" disabled={busy || password.length < PW_MIN}>
                {busy ? (
                  "Enregistrement…"
                ) : (
                  <>
                    Enregistrer et me connecter
                    <Ic n="arrow" className="" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
