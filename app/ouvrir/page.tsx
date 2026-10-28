"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { ArTop } from "@/components/bs/rejoindre";
import { Ill } from "@/components/carnet/ui";
import { api, ApiError } from "@/lib/account/api";
import { enter, hasAccountData, hasLegacyData, sessionFrom, setSession, type AccountSession } from "@/lib/account/session";
import { mesurer } from "@/lib/mesure";

/**
 * Le lien « Ouvrir ma fiche » des e-mails envoyés à l'adresse d'une fiche
 * (décision du 27 octobre 2026, cas 1). Le lien porte ?l=… ; rien ne se passe
 * au chargement, parce que les antivirus des messageries ouvrent les liens
 * tout seuls. Le bouton ouvre le compte de cette adresse et lui rend la fiche
 * si personne ne l'a encore, puis mène droit à la fiche.
 */
export default function Page() {
  const [jeton, setJeton] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** La fiche avait déjà un gérant : le compte est ouvert, sans la fiche. */
  const [prise, setPrise] = useState<AccountSession | null>(null);
  const [adopt, setAdopt] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJeton(new URLSearchParams(window.location.search).get("l") ?? "");
  }, []);

  async function ouvrir() {
    if (busy || !jeton) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.ouvrirLien(jeton);
      if (r.nouveau) mesurer("compte_cree");
      const s = sessionFrom(r);
      if (!r.a_toi) return setPrise(s);
      if (!hasAccountData(s.userId) && hasLegacyData()) {
        setSession(s);
        return setAdopt(true);
      }
      // Lien venu d'une demande (?d=, site 1.8.8) : droit à cette demande.
      const d = Number(new URLSearchParams(window.location.search).get("d")) || 0;
      enter(s, d ? `/demandes?d=${d}` : "/ma-fiche");
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Ça n’a pas marché. Réessaie dans un instant.");
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

  const top = <ArTop />;

  return (
    <div className="carnet">
      <div className="ar">
        <div className="ar-v">
          {top}
          <div className="hero-ill rise" style={{ height: 170 }}>
            <Ill n="rosette" alt="La gérante tient la rosette de son écurie." />
          </div>
          {prise ? (
            <>
              <div className="q rise" style={{ animationDelay: ".08s" }}>
                <h1>Cette fiche a déjà un gérant.</h1>
                <p>Ton compte est ouvert, mais la fiche est rattachée à une autre adresse. Si c’est une erreur, écris-nous à bonjour@bestable.fr : on regarde avec toi.</p>
              </div>
              <div className="foot">
                <button type="button" className="btn full" onClick={() => enter(prise, "/accueil")}>
                  Continuer
                </button>
              </div>
            </>
          ) : jeton === "" ? (
            <>
              <div className="q rise" style={{ animationDelay: ".08s" }}>
                <h1>Ce lien est incomplet.</h1>
                <p>Rouvre-le depuis l’e-mail, ou entre avec ton adresse : tu recevras un code.</p>
              </div>
              <div className="foot">
                <Link href="/compte/connexion" className="btn full">
                  Entrer avec mon e-mail
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="q rise" style={{ animationDelay: ".08s" }}>
                <h1>Ta fiche t’attend.</h1>
                <p>Un geste et elle est à toi : tu corriges tes prix, tes places et tes photos, et tu reçois les demandes des cavaliers. Sans mot de passe.</p>
              </div>
              {err && (
                <p className="ar-err" role="alert">
                  {err}
                </p>
              )}
              <div className="foot">
                <button type="button" className="btn full" disabled={busy || jeton === null} onClick={() => void ouvrir()}>
                  {busy ? "Ouverture…" : "Ouvrir ma fiche"}
                </button>
                {err && (
                  <Link href="/compte/connexion" className="lnk">
                    Entrer avec mon e-mail
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
