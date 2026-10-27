"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "@/components/carnet/ui";
import { withBase } from "@/components/bs/ui";
import { Stories } from "@/components/bs/histoire";
import { useAnnuaire } from "@/components/bs/account-ui";
import { ChampAdresse } from "@/components/bs/champ-adresse";
import { CodeInput, Marque } from "@/components/bs/rejoindre";
import { Alerte } from "@/components/bs/porte-brique";
import { ArriveeFiche, type NouvelleEcurie } from "@/components/bs/arrivee-fiche";
import { LienLegal } from "@/components/bs/texte-legal";
import { useBriques } from "@/components/bs/briques";
import { api, ApiError, type Choix, type StableHit } from "@/lib/account/api";
import { enter, getSession, sessionFrom, setSession, type AccountSession } from "@/lib/account/session";
import { EcuriesTexte } from "@/lib/annuaire";
import { mesurer } from "@/lib/mesure";
import "@/app/carnet/briques.css";
import "@/app/carnet/arrivee-fiche.css";

/**
 * L'entrée directe (lot 6, 27 octobre 2026) : quelqu'un ouvre l'app sans être
 * passé par sa fiche ni par une demande. L'histoire (trois scènes), puis
 * « Trouve ton écurie » :
 *   - trouvée : la même arrivée que depuis bestable.fr (ArriveeFiche) ;
 *   - pas dans l'annuaire : on l'ajoute (nom, commune, type), puis les mêmes étapes ;
 *   - pas encore d'écurie : on le dit simplement, avec l'alerte du simulateur d'installation.
 */
type Vue = "histoire" | "cherche" | "ajout" | "creer" | "projet";

const dire = (x: unknown, defaut: string) => (x instanceof ApiError ? x.message : defaut);

export function EntreeDirecte({ depart = "histoire", retour }: { depart?: Vue; retour?: () => void }) {
  const router = useRouter();
  const chiffres = useAnnuaire();
  const [vue, setVue] = useState<Vue>(depart);
  const [compte, setCompte] = useState<AccountSession | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StableHit[] | null>(null);
  const [cherche, setCherche] = useState(false);
  const [err, setErr] = useState("");
  const [choix, setChoix] = useState<Choix | null>(null);
  const [nouvelle, setNouvelle] = useState<NouvelleEcurie>({ title: "", code_postal: "", commune: "", univers: "ecuries-proprietaires" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const s = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s?.kind === "compte") setCompte(s);
    api.choix().then(setChoix, () => undefined);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [vue]);

  const aller = (v: Vue) => {
    setErr("");
    setVue(v);
  };

  function chercher(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) return setHits(null);
    timer.current = setTimeout(async () => {
      setCherche(true);
      setErr("");
      try {
        setHits((await api.chercher(v.trim())).resultats.slice(0, 6));
      } catch {
        setErr("La recherche ne répond pas. Vérifie ta connexion.");
      } finally {
        setCherche(false);
      }
    }, 260);
  }

  if (vue === "histoire")
    return (
      <div className="ar">
        <Stories onStart={() => aller("cherche")} login={!compte} cta="Trouver mon écurie" />
      </div>
    );

  if (vue === "creer") return <ArriveeFiche nouvelle={nouvelle} onRetour={() => aller("ajout")} />;

  /* ---------- Trouve ton écurie ---------- */
  if (vue === "cherche")
    return (
      <form className="bq-arr bq-ch2" onSubmit={(e) => (e.preventDefault(), hits?.[0] && router.push(`/compte/inscription?fiche=${hits[0].id}`))}>
        <div className="bq-ch2-hd">
          <div className="bq-ch2-top">
            {retour || depart === "histoire" ? (
              <button type="button" className="bq-q-back" aria-label="Revenir" onClick={() => (retour ? retour() : aller("histoire"))}>
                <Ic n="back" className="" />
              </button>
            ) : (
              <span className="ar-wm">be stable</span>
            )}
          </div>
          <h1>Trouve ton écurie</h1>
          <p>{EcuriesTexte(chiffres?.ecuries)} sont déjà dans l’annuaire bestable.fr. La tienne y est peut-être.</p>
        </div>
        <label className="bq-ch2-s">
          <Ic n="search" className="" />
          <input autoFocus value={q} onChange={(e) => chercher(e.target.value)} placeholder="Nom de l’écurie ou commune" aria-label="Nom de l’écurie ou commune" autoComplete="off" enterKeyHint="search" />
          {cherche ? <span className="ar-spin" aria-hidden /> : <span />}
        </label>
        {err && (
          <p className="bq-q-err" role="alert" style={{ margin: "12px var(--gut) 0" }}>
            {err}
          </p>
        )}
        {hits && (
          <>
            <p className="bq-ch2-n" aria-live="polite">
              {hits.length === 0 ? "Aucune fiche à ce nom." : hits.length === 1 ? "1 fiche trouvée" : `${hits.length} fiches trouvées`}
            </p>
            {hits.length > 0 && (
              <div className="bq-ch2-r">
                {hits.map((h) => (
                  <button key={h.id} type="button" className="bq-ch2-i" onClick={() => router.push(`/compte/inscription?fiche=${h.id}`)}>
                    <span className="im" style={{ backgroundImage: `url(${h.image || withBase("/img/carnet/accueil-premier.webp")})` }} />
                    <span>
                      <b>
                        <Marque t={h.title} q={q} />
                      </b>
                      <small>
                        {[h.commune, h.departement].filter(Boolean).join(" · ")}
                        {h.statut === "revendiquee" ? " · déjà à un gérant" : h.statut === "en_verification" ? " · demande en cours" : ""}
                      </small>
                    </span>
                    <Ic n="chev" className="chev" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <p className="bq-ch2-o">Tu ne la trouves pas ?</p>
        <div className="bq-ch2-x">
          <button
            type="button"
            onClick={() => {
              if (!nouvelle.title && q.trim()) setNouvelle({ ...nouvelle, title: q.trim() });
              aller("ajout");
            }}
          >
            <Ic n="plus" className="" />
            <span>
              <b>Mon écurie n’est pas dans l’annuaire</b>
              <small>Tu l’ajoutes : nom, commune, type. Puis les mêmes étapes.</small>
            </span>
            <Ic n="chev" className="chev" />
          </button>
          <button type="button" onClick={() => aller("projet")}>
            <Ic n="flag" className="" />
            <span>
              <b>Je n’ai pas encore d’écurie</b>
              <small>Tu prépares un projet d’installation.</small>
            </span>
            <Ic n="chev" className="chev" />
          </button>
        </div>
      </form>
    );

  /* ---------- Ajouter son écurie ---------- */
  if (vue === "ajout") {
    const univers = Object.entries(choix?.univers ?? {});
    return (
      <form
        className="bq-arr bq-q"
        noValidate
        onChange={() => err && setErr("")}
        onSubmit={(e) => {
          e.preventDefault();
          if (!nouvelle.title.trim()) return setErr("Indique le nom de l’écurie.");
          if (!/^\d{5}$/.test(nouvelle.code_postal) || !nouvelle.commune.trim()) return setErr("Choisis la commune dans la liste proposée.");
          aller("creer");
        }}
      >
        <div className="bq-q-top">
          <button type="button" className="bq-q-back" onClick={() => aller("cherche")} aria-label="Revenir à la recherche">
            <Ic n="back" className="" />
          </button>
          <span className="bq-q-bars" role="img" aria-label="Avant l’étape 1 sur 4">
            {[1, 2, 3, 4].map((j) => (
              <i key={j} />
            ))}
          </span>
          <span className="bq-q-n">0/4</span>
        </div>
        <div className="bq-q-body">
          <h1>Ajouter ton écurie</h1>
          <p className="bq-q-s">Trois informations pour créer sa fiche sur bestable.fr. Elle sera vérifiée avant d’être publiée.</p>
          <label className="bq-q-f">
            <span>Nom de l’écurie</span>
            <input autoComplete="organization" value={nouvelle.title} onChange={(e) => setNouvelle({ ...nouvelle, title: e.target.value })} placeholder="Ex. : Écurie du Moulin" />
          </label>
          <div className="bq-q-f">
            <span>Commune</span>
            <ChampAdresse
              surUneLigne
              communes
              className="bq-q-adr"
              ariaLabel="Commune"
              value={nouvelle.commune}
              onChange={(v) => setNouvelle({ ...nouvelle, commune: v, code_postal: "" })}
              onChoisir={(s) => setNouvelle({ ...nouvelle, commune: s.ville, code_postal: s.codePostal })}
              placeholder="Commune ou code postal"
              autoComplete="address-level2"
            />
            {nouvelle.code_postal && (
              <small className="ok">
                <Ic n="ck" className="" />
                {nouvelle.commune} ({nouvelle.code_postal})
              </small>
            )}
          </div>
          {univers.length > 0 && (
            <div className="bq-q-f" role="group" aria-label="Type de structure">
              <span>Type de structure</span>
              <div className="chips">
                {univers.map(([k, l]) => (
                  <button key={k} type="button" className="chip" aria-pressed={nouvelle.univers === k} onClick={() => setNouvelle({ ...nouvelle, univers: k })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {err && (
            <p className="bq-q-err" role="alert">
              {err}
            </p>
          )}
        </div>
        <div className="bq-q-cta">
          <button className="btn full">
            Créer ma fiche
            <Ic n="arrow" className="" />
          </button>
          <button type="button" className="lnk" onClick={() => aller("cherche")}>
            Revenir à la recherche
          </button>
        </div>
      </form>
    );
  }

  /* ---------- Pas encore d'écurie ---------- */
  return (
    <div className="bq-arr bq-pj">
      <div className="bq-q-top">
        <button type="button" className="bq-q-back" onClick={() => aller("cherche")} aria-label="Revenir à la recherche">
          <Ic n="back" className="" />
        </button>
        <span />
        <span />
      </div>
      <div className="bq-pj-im" style={{ backgroundImage: `url(${withBase("/img/carnet/brouette.webp")})` }} role="img" aria-label="La gérante pousse une brouette." />
      <div className="bq-q-body">
        <h1>Tu prépares ton écurie</h1>
        <p className="bq-q-s">Be Stable accompagne d’abord les écuries en activité : leur fiche, leurs demandes, leurs chiffres. Pour un projet, il n’y a pas encore de fiche à remplir.</p>
      </div>
      {compte ? (
        <>
          <Alerte id="projet" />
          <div className="bq-q-cta bq-pj-cta">
            <button type="button" className="btn line full" onClick={() => enter(compte, "/accueil")}>
              Découvrir l’application
            </button>
            <button type="button" className="lnk" onClick={() => aller("cherche")}>
              Revenir à la recherche
            </button>
          </div>
        </>
      ) : (
        <ProjetSansCompte onCompte={setCompte} />
      )}
    </div>
  );
}

/**
 * L'alerte du simulateur pour quelqu'un qui n'a pas encore de compte : son e-mail
 * et le code ouvrent le compte (marqué « projet »), puis l'alerte est posée.
 */
function ProjetSansCompte({ onCompte }: { onCompte: (s: AccountSession) => void }) {
  const { basculerAlerte } = useBriques();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [etape, setEtape] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function envoyer(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Cette adresse e-mail semble incomplète. Vérifie-la.");
    setBusy(true);
    setErr("");
    try {
      await api.envoyerCode(email.trim());
      setCode("");
      setEtape("code");
    } catch (x) {
      setErr(dire(x, "Le code n’est pas parti. Réessaie."));
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
      if (r.nouveau) mesurer("compte_cree");
      const s = sessionFrom(r);
      setSession(s);
      await api.majMoi({ projet: true }).catch(() => undefined);
      basculerAlerte("projet");
      onCompte(s);
    } catch (x) {
      setErr(dire(x, "Le code n’est pas passé. Réessaie."));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="bq-al" onSubmit={(e) => (etape === "email" ? envoyer(e) : (e.preventDefault(), verifier(code)))} noValidate>
      <span className="bq-al-k">
        <Ic n="bell" className="" />
        Bientôt
      </span>
      <h2>Le simulateur d’installation</h2>
      <p>Ton prix, tes places, tes frais : ce qu’il te resterait chaque mois, et combien de chevaux il te faut. Nous le préparons.</p>
      {etape === "email" ? (
        <>
          <label className="bq-q-f" style={{ textAlign: "left" }}>
            <span>Ton e-mail</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => (setEmail(e.target.value), setErr(""))} placeholder="ton@email.fr" />
          </label>
          {err && (
            <p className="bq-q-err" role="alert">
              {err}
            </p>
          )}
          <button className="btn full" disabled={busy} style={{ marginTop: 12 }}>
            <Ic n="bell" className="" />
            {busy ? "Envoi…" : "Me prévenir à l’ouverture"}
          </button>
          <p className="bq-al-f">
            Un seul e-mail à l’ouverture, rien d’autre. Ton adresse ouvre aussi ton compte, sans mot de passe : un code te sera envoyé. <LienLegal t="confidentialite">Confidentialité</LienLegal>
          </p>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 10px" }}>Six chiffres envoyés à {email.trim()}. Pense aussi à vérifier les indésirables.</p>
          <CodeInput value={code} onChange={(v) => (setCode(v), v.length === 6 && verifier(v))} disabled={busy} />
          {err && (
            <p className="bq-q-err" role="alert">
              {err}
            </p>
          )}
          <button className="btn full" disabled={busy || code.length !== 6} style={{ marginTop: 12 }}>
            {busy ? "Vérification…" : "Valider"}
          </button>
          <button type="button" className="lnk" onClick={() => envoyer()}>
            Renvoyer le code
          </button>
        </>
      )}
    </form>
  );
}
