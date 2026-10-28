"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { ArTop, CodeInput } from "@/components/bs/rejoindre";
import { Ill } from "@/components/carnet/ui";
import { api, ApiError, type Fiche } from "@/lib/account/api";
import { enter, hasAccountData, hasLegacyData, sessionFrom, setSession } from "@/lib/account/session";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * « C'est ton écurie ? » (28 octobre 2026, décision de Samuel). Le lien
 * « Répondre » d'un e-mail de demande mène ici un gérant qui n'est pas
 * connecté sur cet appareil : ?f= la fiche, ?d= la demande. Oui : le site
 * envoie le code à l'adresse du compte de la fiche (POST code/ecurie), l'app
 * n'en voit que la forme masquée ; les six chiffres ouvrent le compte et
 * mènent à la demande. Non : la connexion habituelle.
 */
export default function Page() {
  const [f, setF] = useState(0);
  const [d, setD] = useState(0);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [etape, setEtape] = useState<"question" | "code">("question");
  const [adresse, setAdresse] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fid = Number(q.get("f")) || 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setF(fid);
    setD(Number(q.get("d")) || 0);
    if (fid) void api.ecurie(fid).then(setFiche, () => setFiche(null));
  }, []);

  const vers = d ? `/demandes?d=${d}` : "/demandes";
  const autre = `/compte/connexion/?vers=demandes`;
  const raison = (e: unknown) => (e instanceof ApiError ? e.message : "Ça n’a pas marché. Réessaie dans un instant.");

  async function envoyer() {
    if (busy || !f) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.codeEcurie(f);
      setAdresse(r.adresse);
      setCode("");
      setEtape("code");
    } catch (e) {
      setErr(raison(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifier(v: string) {
    if (busy || v.length !== 6) return;
    setBusy(true);
    setErr("");
    try {
      const s = sessionFrom(await api.verifierCodeFiche(f, v));
      if (s.listing?.title) useSettingsStore.getState().setIdentity({ stableName: s.listing.title });
      if (!hasAccountData(s.userId) && hasLegacyData()) {
        setSession(s);
        return setAdopt(true);
      }
      enter(s, vers);
    } catch (e) {
      setErr(raison(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  if (adopt)
    return (
      <div className="carnet">
        <AdoptChoice source="legacy" />
      </div>
    );

  const lieu = fiche ? [fiche.commune, fiche.departement].filter(Boolean).join(" · ") : "";
  const photo = fiche?.photos?.[0]?.url;

  return (
    <div className="carnet">
      <div className="ar">
        {etape === "question" ? (
          <div className="ar-v">
            <ArTop />
            {photo ? (
              <div className="rise" style={{ height: 170, borderRadius: 12, overflow: "hidden", margin: "0 0 4px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ) : (
              <div className="hero-ill rise" style={{ height: 170 }}>
                <Ill n="rosette" alt="La gérante tient la rosette de son écurie." />
              </div>
            )}
            <div className="q rise" style={{ animationDelay: ".08s" }}>
              <h1>{fiche ? `${fiche.title}, c’est ton écurie ?` : "C’est ton écurie ?"}</h1>
              <p>
                {lieu ? `${lieu}. ` : ""}Un cavalier t’a écrit. Si c’est bien ton écurie, on t’envoie un code à
                l’adresse de son compte, et tu arrives sur sa demande.
              </p>
            </div>
            {err && (
              <p className="ar-err" role="alert">
                {err}
              </p>
            )}
            <div className="foot">
              <button type="button" className="btn full" disabled={busy || !f} onClick={() => void envoyer()}>
                {busy ? "Envoi du code…" : "Oui, c’est mon écurie"}
              </button>
              <Link href={autre} className="lnk">
                Non, entrer avec mon adresse
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="ar-v"
            onSubmit={(e) => {
              e.preventDefault();
              void verifier(code);
            }}
          >
            <ArTop />
            <div className="q">
              <h1>Le code reçu par e-mail</h1>
              <p>Envoyé à {adresse || "l’adresse de ton compte"}.</p>
            </div>
            <CodeInput
              value={code}
              disabled={busy}
              onChange={(v) => {
                setCode(v);
                if (v.length === 6) void verifier(v);
              }}
            />
            {err && (
              <p className="ar-err" role="alert">
                {err}
              </p>
            )}
            <div className="foot">
              <button className="btn full" disabled={busy || code.length !== 6}>
                {busy ? "Vérification…" : "Voir la demande"}
              </button>
              <p className="ar-proof">
                Rien reçu ? Regarde les indésirables, ou{" "}
                <button type="button" className="lnk" onClick={() => void envoyer()} disabled={busy}>
                  renvoie un code
                </button>
                . Ce n’est plus ton adresse ?{" "}
                <Link href={autre} className="lnk">
                  Entrer autrement
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
