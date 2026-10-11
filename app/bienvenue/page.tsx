"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AccTop, HitRow, nf, useAnnuaire } from "@/components/bs/account-ui";
import { Picto } from "@/components/bs/picto";
import { api, type StableHit } from "@/lib/account/api";
import { enter, getSession, type Session } from "@/lib/account/session";
import { withBase } from "@/components/bs/ui";

/**
 * La porte d'entrée des gérants. On cherche son écurie avant tout compte :
 * la valeur d'abord (« ma fiche existe, voilà ce qu'elle montre »),
 * l'inscription ensuite. Les arguments sont des faits : l'annuaire, la
 * gratuité, zéro commission, le badge. Aucune promesse de demandes.
 */
export default function BienvenuePage() {
  const [s, setS] = useState<Session | null>(null);
  const chiffres = useAnnuaire();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StableHit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Un compte déjà ouvert sur cet appareil, avec sa fiche, va directement à son écurie.
  useEffect(() => {
    const cur = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(cur);
    if (cur?.kind === "compte" && cur.listing) window.location.replace(withBase("/accueil"));
  }, []);

  function chercher(v: string, now = false) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits(null);
      return;
    }
    const go = async () => {
      setBusy(true);
      setErr("");
      try {
        const r = await api.chercher(v.trim());
        setHits(r.resultats);
        setTotal(r.total);
      } catch {
        setErr("La recherche ne répond pas. Vérifie ta connexion et réessaie.");
      } finally {
        setBusy(false);
      }
    };
    if (now) go();
    else timer.current = setTimeout(go, 320);
  }

  const ecuries = chiffres ? nf(chiffres.ecuries) : "7 681";

  return (
    <main className="bs-acc">
      <AccTop
        right={
          s?.kind === "compte" ? (
            <Link href="/accueil" className="bs-link">
              Ouvrir Be Stable
            </Link>
          ) : (
            <Link href="/compte/connexion" className="bs-btn line" style={{ width: "auto", minHeight: 38, padding: "0 14px", fontSize: 14 }}>
              Me connecter
            </Link>
          )
        }
      />
      <div className="bs-acc-split">
        <div>
          <h1 className="bs-d bs-t1 xl" style={{ marginTop: 18, fontSize: 34, lineHeight: 1.02 }}>
            Ton écurie est déjà en <span className="bs-hl">piste</span>.
          </h1>
          <p className="bs-p" style={{ fontSize: 16, marginTop: 12 }}>
            mon-ecurie.fr recense {ecuries} écuries partout en France. Retrouve la tienne, reprends ta fiche, et fais tourner l’écurie avec Be Stable. Gratuit, sans commission.
          </p>

          <form
            className="bs-find"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              chercher(q, true);
            }}
          >
            <Picto name="search" />
            <input value={q} onChange={(e) => chercher(e.target.value)} placeholder="Nom de l’écurie ou commune" aria-label="Chercher mon écurie" autoComplete="off" enterKeyHint="search" />
            <button type="submit">{busy ? "…" : "Chercher"}</button>
          </form>
          <p className="bs-help">Pas besoin de compte pour chercher.</p>

          {err && <p className="bs-alert">{err}</p>}
          {hits && (
            <section aria-live="polite" style={{ marginTop: 10 }}>
              {hits.length === 0 ? (
                <p className="bs-p" style={{ marginTop: 6 }}>
                  Aucune écurie ne s’appelle comme ça. Essaie avec la commune ou le numéro du département, ou ajoute la tienne.
                </p>
              ) : (
                <p className="bs-sec" style={{ marginTop: 10 }}>
                  {total > hits.length ? `${hits.length} premiers résultats sur ${nf(total)}` : `${hits.length} résultat${hits.length > 1 ? "s" : ""}`}
                </p>
              )}
              {hits.map((h) => (
                <HitRow key={h.id} h={h} onPick={() => (window.location.href = withBase(`/compte/inscription/?fiche=${h.id}`))} />
              ))}
              <Link href="/compte/inscription?creer=1" className="bs-hit">
                <span className="ph" style={{ background: "var(--vert-soft)", color: "var(--vert)" }}>
                  <Picto name="plus" />
                </span>
                <span className="tx">
                  <b>Mon écurie n’est pas dans la liste</b>
                  <span>l’ajouter à l’annuaire, gratuitement</span>
                </span>
                <Picto name="chev" />
              </Link>
            </section>
          )}

          <div className="bs-proof">
            <div>
              <b>{ecuries}</b>
              <span>écuries recensées</span>
            </div>
            <div>
              <b>{chiffres?.departements ?? 99}</b>
              <span>départements</span>
            </div>
            <div>
              <b>0 %</b>
              <span>de commission sur tes pensions</span>
            </div>
          </div>

          <div className="bs-mob" style={{ marginTop: 22 }}>
            <Atouts />
          </div>

          <div style={{ marginTop: 26, display: "grid", gap: 8 }}>
            {s?.kind !== "compte" && (
              <Link href="/compte/connexion" className="bs-btn line">
                J’ai déjà un compte mon-ecurie.fr
              </Link>
            )}
            <button type="button" className="bs-link" style={{ justifySelf: "center", color: "var(--ink-2)", marginTop: 6 }} onClick={() => enter({ kind: "demo" }, "/accueil")}>
              Juste regarder ? Essayer avec une écurie de démonstration
            </button>
          </div>
        </div>
        <aside className="aside bs-desk">
          <Atouts />
        </aside>
      </div>
    </main>
  );
}

/** Ce que la fiche reprise et l'app changent, en faits. */
function Atouts() {
  return (
    <div className="bs-gain3">
      {(
        [
          ["euro", "Le prix d’abord, le coup de cœur ensuite.", "Les cavaliers comparent avant de se déplacer. Affiche tes formules, tes tarifs et tes places libres : c’est ce qu’ils regardent en premier."],
          ["check", "Revendiquée, ça se voit.", "Le badge « Revendiquée » dit aux cavaliers que les informations viennent de toi, pas d’un recensement."],
          ["personne", "Les cavaliers t’écrivent en direct.", "Leurs demandes arrivent chez toi, sans intermédiaire. La pension se règle entre vous : zéro commission, même pas un brin de foin."],
          ["cal", "Et l’écurie tourne mieux.", "Le même compte ouvre Be Stable : planning des cours, soins, factures, et ce que chaque cheval te rapporte vraiment."],
        ] as const
      ).map(([p, t, d]) => (
        <div key={t}>
          <span className="bs-pic soft">
            <Picto name={p} />
          </span>
          <span>
            <b>{t}</b>
            <p>{d}</p>
          </span>
        </div>
      ))}
    </div>
  );
}
