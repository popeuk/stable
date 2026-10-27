"use client";

import { JaiUneSauvegarde } from "@/components/bs/reprendre-sauvegarde";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { GardeFait, GardeListe } from "@/components/bs/garder";
import { ArTop, CodeInput, Marque } from "@/components/bs/rejoindre";
import { Ic, Ill } from "@/components/carnet/ui";
import { api, ApiError, appUrl, type AuthResponse, type StableHit } from "@/lib/account/api";
import { AVEC_APPLE, AVEC_GOOGLE, lireRetour, partirVers, revenirDe, type Fournisseur } from "@/lib/account/oauth";
import { enter, getSession, hasAccountData, hasLegacyData, hasLocaleData, sessionFrom, setSession, type AccountSession } from "@/lib/account/session";
import { adoptLocale, resumeLocale, type ResumeEssai } from "@/lib/account/vault";
import { useSettingsStore } from "@/stores/settings-store";
import { mesurer } from "@/lib/mesure";

/**
 * Un seul compte (27 octobre 2026) : le site renvoie ici ses gérants, avec
 * ?vers=ma-fiche (son ancien tableau de bord) ou rien. Déjà connecté dans
 * l'app : droit à l'écran voulu ; sinon, après le code.
 */
const VERS: Record<string, string> = { "ma-fiche": "/ma-fiche", demandes: "/demandes", accueil: "/accueil" };
const cible = () => (typeof window === "undefined" ? "/accueil" : (VERS[new URLSearchParams(window.location.search).get("vers") ?? ""] ?? "/accueil"));

/**
 * Se connecter : l'e-mail, puis le code reçu, ou « Continuer avec Google »
 * (Apple quand il sera branché). Plus de mot de passe (décision du 18 octobre).
 * Google revient ici avec ?code=… : le compte s'ouvre comme avec le code.
 *
 * Avec ?garder=1 (le bandeau « Créer mon compte ») ou depuis l'écurie
 * essayée sans compte : « On garde tout pour demain. », puis l'écurie de
 * l'essai passe dans le compte (chiffrée). Si le compte a déjà la sienne,
 * le gérant choisit laquelle garder.
 *
 * En créant le compte depuis un essai, on demande d'abord l'e-mail et le
 * code (décision de Samuel du 18 octobre : on sait qui c'est avant de
 * parler d'écurie). Un compte qui a déjà sa fiche la garde, sans question.
 * Sinon on cherche l'écurie dans mon-ecurie.fr : seule une fiche libre se
 * choisit, une fiche déjà reprise appartient au compte de son gérant. Rien
 * n'est revendiqué : une fois le compte créé, « C'est ma fiche » le propose,
 * sans obligation. Le nom devient celui de l'écurie dans l'app ; le nom et la
 * fiche choisie partent au site, pour les e-mails.
 */
const FICHE = "be-stable-fiche-choisie";
const SANS_NOM = (n: string) => !n.trim() || n.trim() === "Mon écurie";
export default function Page() {
  const [mode, setMode] = useState<"nom" | "email" | "code">("email");
  const [nom, setNom] = useState("");
  /** Pas encore d'écurie : un projet, dit au site pour les e-mails. */
  const [projet, setProjet] = useState(false);
  /** La fiche mon-ecurie.fr choisie, sans la revendiquer. */
  const [fiche, setFiche] = useState<StableHit | null>(null);
  const [hits, setHits] = useState<StableHit[] | null>(null);
  const [cherche, setCherche] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState<"legacy" | "locale" | null>(null);
  const [garder, setGarder] = useState<ResumeEssai | null>(null);
  const [fait, setFait] = useState<AccountSession | null>(null);
  /** Le compte est ouvert (code bon), il attend que l'écurie soit dite. */
  const [attente, setAttente] = useState<AccountSession | null>(null);

  useEffect(() => {
    const deja = getSession();
    if (deja?.kind === "compte" && !lireRetour(window.location.search)) return enter(deja, cible());
    const voulu = new URLSearchParams(window.location.search).get("garder") === "1" || getSession()?.kind === "locale";
    if (voulu && hasLocaleData()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGarder(resumeLocale() ?? { chevaux: 0, pension: 0, frais: 0, seances: 0 });
      const deja = useSettingsStore.getState().stableName;
      setNom(SANS_NOM(deja) ? "" : deja);
      setFiche(lireFiche());
    }
    // Retour de Google ou d'Apple.
    const retour = lireRetour(window.location.search);
    if (!retour) return;
    window.history.replaceState(null, "", window.location.pathname + (voulu ? "?garder=1" : ""));
    if (retour.erreur) return setErr("La connexion a été annulée. Réessaie, ou reçois un code par e-mail.");
    void run(async () => ouvrir(await api.connexionSupabase(await revenirDe(retour.code!))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function avec(f: Fournisseur) {
    const retour = appUrl(`/compte/connexion/${garder ? "?garder=1" : ""}`);
    void run(() => partirVers(f, retour));
  }

  async function ouvrir(r: AuthResponse & { nouveau?: boolean }) {
    if (r.nouveau) mesurer("compte_cree");
    const s = sessionFrom(r);
    // L'écurie essayée sans compte passe dans le compte.
    if (hasLocaleData()) {
      // Le compte a déjà sa fiche : c'est son écurie, sans question.
      if (s.listing) {
        useSettingsStore.getState().setIdentity({ stableName: s.listing.title });
        return finir(s, { ecurie: "", fiche: null, projet: false });
      }
      // Sinon, l'écurie se dit maintenant qu'on sait qui c'est.
      setAttente(s);
      setCode("");
      setErr("");
      return setMode("nom");
    }
    if (!hasAccountData(s.userId) && hasLegacyData()) {
      setSession(s);
      return setAdopt("legacy");
    }
    // Sans fiche aussi : la fiche se propose plus tard, dans l'app.
    enter(s, cible());
  }

  /** L'écurie est dite : l'essai passe dans le compte. Le nom (ou le projet) part au site, sans effet tant que l'extension ne le connaît pas. */
  async function finir(s: AccountSession, dit: { ecurie: string; fiche: StableHit | null; projet: boolean }) {
    setSession(s);
    if (dit.ecurie || dit.projet) void api.majMoi(dit.projet ? { projet: true } : { ecurie: dit.ecurie, ...(dit.fiche ? { fiche: dit.fiche.id } : {}) }).catch(() => {});
    ecrireFiche(null);
    if (hasAccountData(s.userId)) return setAdopt("locale");
    await adoptLocale("locale");
    setFait(s);
  }

  async function run(f: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await f();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Ça n’a pas marché. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function chercher(v: string) {
    setNom(v);
    setFiche(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) return setHits(null);
    timer.current = setTimeout(async () => {
      setCherche(true);
      try {
        setHits((await api.chercher(v.trim())).resultats.slice(0, 5));
      } catch {
        setHits(null);
      } finally {
        setCherche(false);
      }
    }, 260);
  }

  /** L'écurie est dite : celle de l'annuaire (h), ou le nom tapé. */
  function garderNom(h: StableHit | null) {
    // Une fiche déjà reprise appartient au compte de son gérant : elle ne se choisit pas ici.
    if (h && h.statut !== "libre") return setErr(`${h.title} a déjà un compte, avec une autre adresse. Si c’est ton écurie, écris-nous : on regarde avec toi.`);
    const n = (h?.title ?? nom).trim();
    if (n.length < 2) return setErr("Le nom de ton écurie, tel que tes clients le disent.");
    useSettingsStore.getState().setIdentity({ stableName: n });
    setNom(n);
    setFiche(h);
    ecrireFiche(h);
    setHits(null);
    setProjet(false);
    setErr("");
    if (attente) void run(() => finir(attente, { ecurie: n, fiche: h, projet: false }));
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
          <GardeFait onOpen={() => enter(fait, "/accueil")} fiche={fiche && fiche.statut === "libre" && !projet ? fiche : null} onFiche={(id) => enter(fait, `/compte/inscription?fiche=${id}`)} />
        </div>
      </div>
    );

  const top = (
    <ArTop
      onBack={mode === "code" ? () => (setMode("email"), setErr("")) : undefined}
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
        {mode === "nom" && (
          <form className="ar-v" noValidate onSubmit={(e) => (e.preventDefault(), garderNom(fiche))}>
            {top}
            <div className="q rise">
              <h1>Ton écurie s’appelle comment ?</h1>
              <p>Si elle est sur bestable.fr, choisis-la. Rien ne change sur sa fiche.</p>
            </div>
            <label className="input ar-in">
              <Ic n="search" className="ar-ico" />
              <input autoFocus type="text" autoComplete="off" enterKeyHint="next" maxLength={120} value={nom} onChange={(e) => chercher(e.target.value)} placeholder="Nom ou commune" aria-label="Le nom de ton écurie" />
              {cherche && <span className="ar-spin" aria-hidden />}
            </label>
            {hits && (
              <ul className="ar-hits" aria-live="polite">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => garderNom(h)}>
                      <b>
                        <Marque t={h.title} q={nom} />
                      </b>
                      <span>
                        {[h.commune, h.departement && `(${h.departement})`].filter(Boolean).join(" ")}
                        {h.statut !== "libre" && " · déjà un compte"}
                      </span>
                      <Ic n="chev" className="chev" />
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="add" onClick={() => garderNom(null)}>
                    <b>{hits.length ? "Elle n’est pas dans la liste" : "Aucune écurie à ce nom"}</b>
                    <span>continuer avec « {nom.trim()} »</span>
                    <Ic n="chev" className="chev" />
                  </button>
                </li>
              </ul>
            )}
            {erreur}
            <div className="foot">
              {!hits && (
                <button className="btn full" disabled={!nom.trim()}>
                  Continuer
                </button>
              )}
              <button type="button" className="lnk" onClick={() => (setNom(""), setFiche(null), ecrireFiche(null), setHits(null), setProjet(true), setErr(""), attente ? void run(() => finir(attente, { ecurie: "", fiche: null, projet: true })) : setMode("email"))}>
                Je n’ai pas encore d’écurie
              </button>
            </div>
          </form>
        )}

        {mode === "email" && (
          <form className="ar-v" noValidate onSubmit={(e) => (e.preventDefault(), run(async () => (await api.envoyerCode(email.trim()), setCode(""), setMode("code"))))}>
            {top}
            {garder ? (
              <div className="q rise">
                <h1>Ton compte</h1>
                <p>Ton e-mail, puis un code. Ensuite, ton écurie. Tes chiffres vont dans ton compte.</p>
              </div>
            ) : (
              <>
                <div className="hero-ill rise" style={{ height: 170 }}>
                  <Ill n="assise" alt="La gérante, assise, une tasse de café à la main." />
                </div>
                <div className="q rise" style={{ animationDelay: ".08s" }}>
                  <h1>Te revoilà.</h1>
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
              {!garder && <JaiUneSauvegarde className="lnk ar-sauv" />}
              {AVEC_GOOGLE && (
                <button type="button" className="btn line full" disabled={busy} onClick={() => avec("google")}>
                  Continuer avec Google
                </button>
              )}
              {AVEC_APPLE && (
                <button type="button" className="btn line full" disabled={busy} onClick={() => avec("apple")}>
                  Continuer avec Apple
                </button>
              )}
              <p className="ar-proof">Le même compte que sur bestable.fr. Pas de mot de passe.</p>
            </div>
          </form>
        )}

        {mode === "code" && (
          <form className="ar-v" onSubmit={(e) => (e.preventDefault(), run(async () => ouvrir(await api.verifierCode(email.trim(), code))))}>
            {top}
            <div className="q">
              <h1>Le code reçu par e-mail</h1>
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

/** La fiche choisie survit au détour par Google (même onglet). */
function lireFiche(): StableHit | null {
  try {
    return JSON.parse(sessionStorage.getItem(FICHE) ?? "null") as StableHit | null;
  } catch {
    return null;
  }
}
function ecrireFiche(h: StableHit | null) {
  try {
    if (h) sessionStorage.setItem(FICHE, JSON.stringify(h));
    else sessionStorage.removeItem(FICHE);
  } catch {}
}
