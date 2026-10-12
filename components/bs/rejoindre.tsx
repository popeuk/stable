"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Picto } from "@/components/bs/picto";
import { Rosette, withBase } from "@/components/bs/ui";
import { FichePreview, nf, useAnnuaire } from "@/components/bs/account-ui";
import { AdoptChoice } from "@/components/bs/adopt-choice";
import { api, ApiError, type Fiche, type StableHit } from "@/lib/account/api";
import { enter, getSession, hasAccountData, hasLegacyData, sessionFrom, setSession, updateAccount, type AccountSession, type Listing } from "@/lib/account/session";

/**
 * Rejoindre Be Stable : une question par écran.
 *   0. ce qu'est Be Stable, puis pourquoi on cherche l'écurie (mon-ecurie.fr) ;
 *   1. le nom de l'écurie (ou l'ajouter si elle n'est pas dans l'annuaire) ;
 *   2. « C'est elle ? », puis sa fiche aujourd'hui / reprise, à faire glisser ;
 *   3. les places libres ;
 *   4. le prix « à partir de » ;
 *   5. l'e-mail, puis le code reçu (pas de mot de passe).
 * La demande part toute seule après le code, et le flot se tamponne.
 * Sur ordinateur, la fiche se construit à côté de la question.
 */
type Etape = "accueil" | "pourquoi" | "nom" | "creer" | "elle" | "gain" | "places" | "prix" | "email" | "code" | "envoi" | "fait";
const RANG: Record<Etape, number> = { accueil: 0, pourquoi: 0, nom: 1, creer: 1, elle: 2, gain: 2, places: 3, prix: 4, email: 5, code: 5, envoi: 5, fait: 5 };
const PHOTO = withBase("/img/exemple-pre.jpg");

/** Les messages du site sont au « vous » : l'app parle au « tu ». */
const TU: Record<string, string> = {
  trop_d_essais: "Trop d’essais depuis cette connexion. Réessaie un peu plus tard.",
  code_faux: "Ce code ne correspond pas. Vérifie les six chiffres.",
  code_expire: "Ce code n’est plus valable. Demande-en un nouveau.",
  email_invalide: "Cette adresse e-mail ne semble pas valide.",
  hors_ligne: "Pas de connexion. Vérifie ton réseau et réessaie.",
  revendication_en_cours: "Une demande est déjà en cours pour cette fiche. Si c’est la tienne, tu recevras un e-mail.",
  deja_revendiquee: "Cette fiche a déjà un gérant. Si c’est une erreur, écris à bonjour@mon-ecurie.fr.",
};
const dire = (x: unknown, defaut: string) => (x instanceof ApiError ? TU[x.code] ?? x.message : defaut);

export function Rejoindre({ ficheId = 0, creer = false }: { ficheId?: number; creer?: boolean }) {
  const chiffres = useAnnuaire();
  const [etape, setEtape] = useState<Etape>(creer ? "creer" : ficheId ? "elle" : "accueil");
  const [hist, setHist] = useState<Etape[]>([]);
  const [compte, setCompte] = useState<AccountSession | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StableHit[] | null>(null);
  const [cherche, setCherche] = useState(false);
  const [fiche, setFiche] = useState<Partial<Fiche>>({ photos: [], formules: [], places_libres: "", prix_min: "" });
  const [places, setPlaces] = useState<string>("");
  const [prix, setPrix] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adopt, setAdopt] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const s = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s?.kind === "compte") setCompte(s);
    if (ficheId)
      api.ecurie(ficheId).then(
        (f) => setFiche(f),
        () => setErr("Cette fiche n’est plus en ligne."),
      );
  }, [ficheId]);

  const aller = (e: Etape) => {
    setErr("");
    setHist((h) => [...h, etape]);
    setEtape(e);
  };
  const retour = () => {
    setErr("");
    setHist((h) => {
      const p = h[h.length - 1];
      if (p) setEtape(p);
      return h.slice(0, -1);
    });
  };

  function chercher(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) return setHits(null);
    timer.current = setTimeout(async () => {
      setCherche(true);
      try {
        setHits((await api.chercher(v.trim())).resultats.slice(0, 6));
      } catch {
        setErr("La recherche ne répond pas. Vérifie ta connexion.");
      } finally {
        setCherche(false);
      }
    }, 260);
  }

  async function choisir(h: StableHit) {
    setBusy(true);
    try {
      setFiche(await api.ecurie(h.id));
      aller("elle");
    } catch {
      setErr("Cette fiche ne répond pas. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  /** La demande (revendication ou création), une fois le compte ouvert. */
  async function envoyer(s: AccountSession) {
    setEtape("envoi");
    const saisie = { places_libres: places, prix_min: prix };
    try {
      const r = fiche.id
        ? await api.revendiquer(fiche.id, { fiche: saisie })
        : await api.creer({ univers: "ecuries-proprietaires", fiche: { ...saisie, title: fiche.title, code_postal: fiche.code_postal, commune: fiche.commune } });
      setListing(r.listing);
      updateAccount({ listing: r.listing });
      setEtape("fait");
    } catch (x) {
      const e = x instanceof ApiError ? x : null;
      if (e?.code === "deja_une_fiche" && e.data.listing) {
        setListing(e.data.listing as Listing);
        updateAccount({ listing: e.data.listing as Listing });
        return setEtape("fait");
      }
      if (e?.code === "doublon" && e.data.fiche) {
        setFiche(await api.ecurie(Number((e.data.fiche as { id: number }).id)));
        setEtape("elle");
        return setErr("Cette écurie est déjà dans l’annuaire : la voici.");
      }
      setErr(dire(x, "La demande n’est pas partie. Réessaie."));
      setEtape(s ? "prix" : "email");
    }
  }

  async function demanderCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Cette adresse ne semble pas complète.");
    setBusy(true);
    setErr("");
    try {
      await api.envoyerCode(email.trim());
      setCode("");
      aller("code");
    } catch (x) {
      setErr(dire(x, "L’envoi n’a pas abouti. Réessaie."));
    } finally {
      setBusy(false);
    }
  }

  async function verifier(c: string) {
    if (busy || c.length !== 6) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.verifierCode(email.trim(), c);
      const s = sessionFrom(r);
      setSession(s);
      setCompte(s);
      // Un compte qui a déjà sa fiche validée entre directement dans l'app.
      if (r.listing?.status === "validee") return entrer(s, "/accueil");
      await envoyer(s);
    } catch (x) {
      setErr(dire(x, "Le code n’a pas pu être vérifié."));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function entrer(s: AccountSession, to: string) {
    if (!hasAccountData(s.userId) && hasLegacyData()) return setAdopt(true);
    enter(s, to);
  }

  if (adopt) return <AdoptChoice to="/parcours" />;

  const n = RANG[etape];
  const prixN = Number(prix);
  const apercu: Partial<Fiche> = { ...fiche, places_libres: places, prix_min: prix || fiche.prix_min };
  const statut = fiche.statut;

  const panneau =
    etape === "gain" ? null : (
      <div className="rj-side-in">
        {fiche.title ? (
          <>
            <p className="rj-side-t">{etape === "fait" ? "Ta fiche, en vérification" : "Ta fiche, en direct"}</p>
            <FichePreview f={apercu} pending={etape === "fait"} />
          </>
        ) : (
          <>
            <p className="rj-side-t">Ce qu’une fiche reprise montre aux cavaliers</p>
            <FichePreview f={{ title: "Ton écurie", commune: "Ta commune", photos: [{ id: 0, url: PHOTO }], prix_min: "420", places_libres: "2" }} claimed />
            <p className="rj-side-ex">Exemple. 0 % de commission, gratuit.</p>
          </>
        )}
      </div>
    );

  return (
    <main className={`rj${etape === "gain" ? " gain" : ""}`}>
      <div className="rj-main">
        <header className="rj-top">
          {hist.length > 0 && etape !== "fait" && etape !== "envoi" ? (
            <button type="button" className="rj-back" onClick={retour} aria-label="Revenir">
              <Picto name="chevL" />
            </button>
          ) : (
            <span className="bs-wm">be stable</span>
          )}
          {etape !== "fait" && n > 0 && (
            <div className="rj-dots" aria-label={`Étape ${n} sur 5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <i key={i} className={i <= n ? "on" : ""} />
              ))}
            </div>
          )}
          {!compte && (etape === "nom" || etape === "accueil" || etape === "pourquoi") ? (
            <Link href="/compte/connexion" className="bs-link">
              Me connecter
            </Link>
          ) : (
            <span style={{ width: 24 }} />
          )}
        </header>

        {/* 0. Ce qu'est Be Stable */}
        {etape === "accueil" && (
          <div className="rj-step rj-intro">
            <h1 className="rj-q">
              Ton écurie tourne. <span className="hl">Be Stable te dit ce qu’elle te rapporte.</span>
            </h1>
            <ul className="rj-pts">
              <li>
                <Picto name="cal" />
                <span>
                  <b>Tes chevaux, leurs soins, ton planning</b>
                  Au même endroit, notés en deux gestes depuis la cour.
                </span>
              </li>
              <li>
                <Picto name="euro" />
                <span>
                  <b>Ce que chaque cheval te laisse</b>
                  Pensions, soins, foin : l’app fait les comptes pour toi. Pas de tableur.
                </span>
              </li>
              <li>
                <Picto name="flag" />
                <span>
                  <b>Ta fiche sur mon-ecurie.fr</b>
                  L’annuaire où les cavaliers cherchent une pension pour leur cheval.
                </span>
              </li>
            </ul>
            <div className="rj-foot">
              <button type="button" className="bs-btn rj-go" onClick={() => aller("pourquoi")}>
                Commencer
              </button>
              <button type="button" className="bs-link rj-demo" onClick={() => enter({ kind: "demo" }, "/accueil")}>
                Juste regarder ? Ouvre l’écurie de démonstration
              </button>
            </div>
          </div>
        )}

        {/* 0 bis. Pourquoi on cherche l'écurie */}
        {etape === "pourquoi" && (
          <div className="rj-step rj-intro">
            <h1 className="rj-q">D’abord, retrouvons ton écurie.</h1>
            <p className="rj-sub">
              Elle a sans doute déjà sa fiche sur <b>mon-ecurie.fr</b>, l’annuaire des pensions pour chevaux : <b className="num">{chiffres ? nf(chiffres.ecuries) : "7 681"}</b> écuries y sont, partout en France. En la reprenant :
            </p>
            <ul className="rj-pts">
              <li>
                <Picto name="check" />
                <span>
                  <b>Elle passe à ton nom</b>
                  Tes places libres, tes prix, tes photos : c’est toi qui les donnes, plus personne d’autre.
                </span>
              </li>
              <li>
                <Picto name="check" />
                <span>
                  <b>Les cavaliers la voient à jour</b>
                  Ceux qui cherchent une pension près de chez toi tombent sur les bonnes informations.
                </span>
              </li>
              <li>
                <Picto name="check" />
                <span>
                  <b>Gratuit, sans commission</b>
                  Rien n’est pris sur tes pensions. On vérifie chaque demande à la main, en général sous deux jours ouvrés.
                </span>
              </li>
            </ul>
            <div className="rj-foot">
              <button type="button" className="bs-btn rj-go" onClick={() => aller("nom")}>
                Trouver mon écurie
              </button>
              <button type="button" className="bs-link rj-demo" onClick={() => aller("creer")}>
                Elle n’est pas sur l’annuaire ? L’ajouter
              </button>
            </div>
          </div>
        )}

        {/* 1. Le nom */}
        {etape === "nom" && (
          <form className="rj-step" onSubmit={(e) => (e.preventDefault(), hits?.[0] && choisir(hits[0]))}>
            <h1 className="rj-q">Comment s’appelle ton écurie ?</h1>
            <label className="rj-in">
              <Picto name="search" />
              <input autoFocus value={q} onChange={(e) => chercher(e.target.value)} placeholder="Nom ou commune" aria-label="Nom de ton écurie ou commune" autoComplete="off" enterKeyHint="search" />
              {cherche && <span className="rj-spin" aria-hidden />}
            </label>
            {hits && (
              <ul className="rj-hits" aria-live="polite">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => choisir(h)} disabled={busy}>
                      <b>{h.title}</b>
                      <span>{[h.commune, h.departement && `(${h.departement})`].filter(Boolean).join(" ")}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    className="add"
                    onClick={() => {
                      setFiche({ ...fiche, id: undefined, title: q.trim(), statut: undefined });
                      aller("creer");
                    }}
                  >
                    <b>{hits.length ? "Elle n’est pas dans la liste" : "Aucune écurie à ce nom"}</b>
                    <span>l’ajouter à l’annuaire</span>
                  </button>
                </li>
              </ul>
            )}
            <div className="rj-foot rj-foot-libre">
              <p className="rj-proof">
                <b className="num">{chiffres ? nf(chiffres.ecuries) : "7 681"}</b> écuries · gratuit · 0 % de commission
              </p>
              <button type="button" className="bs-link" style={{ color: "var(--ink-3)", fontWeight: 500 }} onClick={() => enter({ kind: "demo" }, "/accueil")}>
                Juste regarder ? La démo
              </button>
            </div>
          </form>
        )}

        {/* 1 bis. L'ajouter */}
        {etape === "creer" && (
          <form
            className="rj-step"
            onSubmit={(e) => {
              e.preventDefault();
              if (!fiche.title?.trim() || !/^\d{5}$/.test(fiche.code_postal ?? "") || !fiche.commune?.trim()) return setErr("Le nom, le code postal et la commune suffisent.");
              aller("gain");
            }}
          >
            <h1 className="rj-q">Ajoutons-la.</h1>
            <label className="rj-in">
              <input autoFocus value={fiche.title ?? ""} onChange={(e) => setFiche({ ...fiche, title: e.target.value })} placeholder="Nom de l’écurie" aria-label="Nom de l’écurie" autoComplete="organization" />
            </label>
            <div className="rj-two">
              <label className="rj-in">
                <input value={fiche.code_postal ?? ""} onChange={(e) => setFiche({ ...fiche, code_postal: e.target.value.replace(/\D/g, "").slice(0, 5) })} placeholder="Code postal" aria-label="Code postal" inputMode="numeric" autoComplete="postal-code" />
              </label>
              <label className="rj-in">
                <input value={fiche.commune ?? ""} onChange={(e) => setFiche({ ...fiche, commune: e.target.value })} placeholder="Commune" aria-label="Commune" autoComplete="address-level2" />
              </label>
            </div>
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go">Continuer</button>
            </div>
          </form>
        )}

        {/* 2. C'est elle ? */}
        {etape === "elle" && (
          <div className="rj-step">
            <h1 className="rj-q">{statut === "revendiquee" ? "Elle a déjà son gérant." : statut === "en_verification" ? "Une demande est déjà en cours." : "C’est elle ?"}</h1>
            <div className="bs-mob">
              <FichePreview f={fiche} />
            </div>
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              {statut === "revendiquee" ? (
                <>
                  <p className="rj-proof">C’est toi ? Entre avec ton e-mail.</p>
                  <Link href="/compte/connexion" className="bs-btn rj-go">
                    Me connecter
                  </Link>
                </>
              ) : statut === "en_verification" ? (
                <>
                  <p className="rj-proof">Si c’est la tienne, ton e-mail suffit pour la retrouver.</p>
                  <button type="button" className="bs-btn rj-go" onClick={() => aller(compte ? "places" : "email")}>
                    C’est ma demande
                  </button>
                </>
              ) : (
                <div className="rj-two">
                  <button type="button" className="bs-btn line rj-go" onClick={() => (setEtape("nom"), setHist([]))}>
                    Non
                  </button>
                  <button type="button" className="bs-btn rj-go" onClick={() => aller("gain")} autoFocus>
                    Oui, c’est elle
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2 bis. Aujourd'hui / reprise */}
        {etape === "gain" && (
          <div className="rj-step">
            <h1 className="rj-q">Glisse.</h1>
            <AvantApres f={fiche} />
            <div className="rj-foot">
              <button type="button" className="bs-btn rj-go" onClick={() => aller("places")}>
                Je veux celle de droite
              </button>
              <p className="rj-proof">Gratuit · 0 % de commission · vérifiée à la main</p>
            </div>
          </div>
        )}

        {/* 3. Places */}
        {etape === "places" && (
          <form className="rj-step" onSubmit={(e) => (e.preventDefault(), aller("prix"))}>
            <h1 className="rj-q">Des places libres en ce moment ?</h1>
            <div className="rj-stepper">
              <button type="button" aria-label="Une place de moins" onClick={() => setPlaces(String(Math.max(0, Number(places || 1) - 1)))}>
                −
              </button>
              <input className="num" inputMode="numeric" value={places} placeholder="?" aria-label="Places libres" onChange={(e) => setPlaces(e.target.value.replace(/\D/g, "").slice(0, 2))} autoFocus />
              <button type="button" aria-label="Une place de plus" onClick={() => setPlaces(String(Number(places || 0) + 1))}>
                +
              </button>
            </div>
            <div className="rj-chips">
              <button type="button" className="bs-chip" aria-pressed={places === "0"} onClick={() => setPlaces("0")}>
                Complet
              </button>
              <button type="button" className="bs-chip" aria-pressed={places === ""} onClick={() => setPlaces("")}>
                Je ne dis pas
              </button>
            </div>
            <div className="rj-foot">
              <button className="bs-btn rj-go">Suivant</button>
            </div>
          </form>
        )}

        {/* 4. Prix */}
        {etape === "prix" && (
          <form className="rj-step" onSubmit={(e) => (e.preventDefault(), compte ? envoyer(compte) : aller("email"))}>
            <h1 className="rj-q">Ta pension, à partir de combien ?</h1>
            <label className="rj-big">
              <input className="num" inputMode="numeric" value={prix} placeholder="0" aria-label="Prix à partir de, par mois" onChange={(e) => setPrix(e.target.value.replace(/\D/g, "").slice(0, 5))} autoFocus />
              <span>€ / mois</span>
            </label>
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go">{prixN > 0 ? "Suivant" : "Passer"}</button>
            </div>
          </form>
        )}

        {/* 5. E-mail */}
        {etape === "email" && (
          <form className="rj-step" onSubmit={demanderCode} noValidate>
            <h1 className="rj-q">Où t’envoyer ton code ?</h1>
            <label className="rj-in">
              <input autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.fr" aria-label="Ton e-mail" />
            </label>
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go" disabled={busy}>
                {busy ? "Envoi…" : "Recevoir le code"}
              </button>
              <p className="rj-proof">
                Pas de mot de passe. En continuant, tu acceptes les{" "}
                <a href="https://www.mon-ecurie.fr/cgu/" target="_blank" rel="noreferrer">
                  conditions
                </a>{" "}
                de mon-ecurie.fr.
              </p>
            </div>
          </form>
        )}

        {/* 5 bis. Le code */}
        {etape === "code" && (
          <form className="rj-step" onSubmit={(e) => (e.preventDefault(), verifier(code))}>
            <h1 className="rj-q">Le code reçu.</h1>
            <p className="rj-sub">Envoyé à {email.trim()}.</p>
            <CodeInput value={code} onChange={(v) => (setCode(v), v.length === 6 && verifier(v))} disabled={busy} />
            {err && <p className="rj-err">{err}</p>}
            <div className="rj-foot">
              <button className="bs-btn rj-go" disabled={busy || code.length !== 6}>
                {busy ? "Vérification…" : "Valider"}
              </button>
              <p className="rj-proof">
                Rien reçu ? Regarde les indésirables, ou{" "}
                <button type="button" className="bs-link" onClick={() => demanderCode()}>
                  renvoie le code
                </button>
                .
              </p>
            </div>
          </form>
        )}

        {etape === "envoi" && (
          <div className="rj-step">
            <h1 className="rj-q">Un instant…</h1>
          </div>
        )}

        {/* Le flot */}
        {etape === "fait" && (
          <div className="rj-step rj-fait">
            <div className="rj-stamp">
              <Rosette lines={["En", "piste"]} size={128} />
            </div>
            <h1 className="rj-q">{listing?.status === "validee" ? "Ta fiche est à toi." : "Demande envoyée."}</h1>
            <p className="rj-sub">{listing?.status === "validee" ? "Tout est prêt dans Be Stable." : "On vérifie à la main, en général sous deux jours ouvrés. Tu reçois un e-mail dès que la fiche est à toi."}</p>
            <div className="rj-foot">
              <button type="button" className="bs-btn rj-go" onClick={() => compte && entrer(compte, "/parcours")}>
                Ouvrir Be Stable <Picto name="arrowR" />
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="rj-side" aria-hidden="true">
        {etape === "gain" ? null : panneau}
      </aside>
    </main>
  );
}

/** Sa fiche aujourd'hui à gauche, reprise à droite ; la poignée se tire au doigt ou à la souris. */
function AvantApres({ f }: { f: Partial<Fiche> }) {
  const calme = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [x, setX] = useState(calme ? 34 : 88);
  // À l'arrivée, la poignée balaie la fiche une fois et montre surtout la version reprise.
  useEffect(() => {
    if (calme) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      setX(88 - (88 - 34) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const go = setTimeout(() => (raf = requestAnimationFrame(step)), 350);
    return () => (clearTimeout(go), cancelAnimationFrame(raf));
  }, [calme]);
  const photo = f.photos?.[0]?.url || PHOTO;
  const prix = Number(f.prix_min) > 0 ? Number(f.prix_min) : 420;
  const face = (apres: boolean) => (
    <div className={`face ${apres ? "apres" : "avant"}`}>
      <div className="ph" style={apres ? { backgroundImage: `url(${photo})` } : undefined}>{!apres && "Pas de photo"}</div>
      <div className="bd">
        <b>{f.title}</b>
        <span className="loc">{[f.commune, f.code_postal].filter(Boolean).join(" · ")}</span>
        <span className={apres ? "badge rev" : "badge non"}>{apres ? "✓ Revendiquée" : "Non revendiquée"}</span>
        <span className={apres ? "px" : "px vide"}>
          {apres ? (
            <>
              <small>à partir de</small>
              <strong className="num">{nf(prix)} €</strong>
              <small>/ mois</small>
            </>
          ) : (
            "Tarifs non communiqués"
          )}
        </span>
        <span className={apres ? "pl ok" : "pl"}>{apres ? "2 places libres" : "Places : non précisé"}</span>
      </div>
    </div>
  );
  return (
    <div className="rj-ba" style={{ ["--x" as string]: `${x}%` }}>
      <div className="cadre">
        {face(false)}
        <div className="calque" aria-hidden>
          {face(true)}
        </div>
        <span className="tag a">Aujourd’hui</span>
        <span className="tag b">Reprise</span>
        <i className="knob" aria-hidden />
        <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} aria-label="Comparer ta fiche aujourd’hui et reprise" />
      </div>
      <p className="ex">À droite : photo, prix et places d’exemple. Les tiens les remplacent.</p>
    </div>
  );
}

/** Six chiffres ; le code collé depuis l'e-mail se remplit d'un coup. */
function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="rj-code">
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label="Code à six chiffres"
      />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={i === value.length ? "on" : value[i] ? "full" : ""}>
          {value[i] ?? ""}
        </span>
      ))}
    </label>
  );
}
