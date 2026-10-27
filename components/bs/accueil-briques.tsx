"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { useBriques } from "@/components/bs/briques";
import { Alerte } from "@/components/bs/porte-brique";
import { Ic, Ill } from "@/components/carnet/ui";
import { nonVues, useDemandes } from "@/lib/account/demandes";
import { useMaFiche } from "@/lib/account/ma-fiche";
import { estOuverte } from "@/lib/briques";
import { direManque, jaugeFiche } from "@/lib/fiche-jauge";
import type { Question } from "@/components/bs/feuille-question";
import "@/app/carnet/livret-croissance.css";
import "@/app/carnet/briques.css";

/** La feuille d'une question ne se charge qu'à l'ouverture. */
const FeuilleQuestion = dynamic(() => import("@/components/bs/feuille-question").then((m) => m.FeuilleQuestion), { ssr: false });

/**
 * L'accueil en blocs (27 octobre 2026), pour un compte : toujours dans le même
 * ordre, un bloc n'apparaît que si sa brique est ouverte ou s'il a quelque chose
 * à dire. 1. Les nouvelles demandes ; 2. le chemin des premiers pas (ses pas
 * dépendent des briques) ; 3. ton mois ; 4. ta journée ; 5. ta fiche ; 6. une
 * seule invitation. Les blocs d'argent et de journée viennent de l'accueil
 * d'avant (passés en `mois` et `journee`).
 */
export function AccueilBriques({ mois, chemin, journee }: { mois: ReactNode; chemin: ReactNode; journee: ReactNode }) {
  const { etat, alertes, essaiPossible } = useBriques();
  const argent = estOuverte(etat.argent);
  const fiche = useMaFiche((s) => s.fiche);
  const etatFiche = useMaFiche((s) => s.etat);
  const charger = useMaFiche((s) => s.charger);
  const [q, setQ] = useState<Question | null>(null);
  useEffect(() => {
    void charger();
  }, [charger]);
  const j = fiche ? jaugeFiche(fiche) : null;

  return (
    <>
      {fiche?.en_attente && (
        <div className="bq-verif rise">
          <span className="ic">
            <Ic n="clock" className="" />
          </span>
          <span>
            <b>Ta fiche est en vérification</b>
            <small>On vérifie chaque fiche à la main. Tu reçois un e-mail dès qu’elle est à ton nom : tes réponses partent alors sur bestable.fr.</small>
          </span>
        </div>
      )}
      <NouvellesDemandes />
      {argent ? chemin : etatFiche === "aucune" ? <SansFiche /> : <CheminFiche onQuestion={setQ} />}
      {argent && mois}
      {estOuverte(etat.planning) ? journee : argent ? <JourneeVerrou /> : null}
      {j && (argent || j.n >= j.total ? (
        <Link href="/ma-fiche" className="bq-fl rise">
          <span className="n">{j.n}</span>
          <span>
            <b>{j.n >= j.total ? "Ta fiche est complète" : `Ta fiche : ${j.n} sur ${j.total}`}</b>
            <small>{j.n >= j.total ? "Pense à tenir tes places à jour, d’un geste." : `Il manque ${direManque(j.manque)}.`}</small>
          </span>
          <Ic n="chev" className="chev" />
        </Link>
      ) : (
        <Link href="/ma-fiche" className="bq-fiche rise">
          <span className="bq-hd">
            <b>Ta fiche sur bestable.fr</b>
            <span className="bq-lnk">Ouvrir ma vitrine</span>
          </span>
          <Jauge n={j.n} total={j.total} />
          <span className="bq-fiche-t">
            <b>{j.n}</b> sur {j.total}. Il manque {direManque(j.manque)}.
          </span>
        </Link>
      ))}
      <Invitation argent={etat.argent} site={etat.site} alerte={!!alertes.argent} essai={essaiPossible} complete={!!j && j.n >= j.total - 2} />
      {q && <FeuilleQuestion q={q} onClose={() => setQ(null)} />}
    </>
  );
}

function Jauge({ n, total }: { n: number; total: number }) {
  return (
    <span className="bq-jg" role="img" aria-label={`${n} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < n ? "on" : undefined} />
      ))}
    </span>
  );
}

/** 1. Les nouvelles demandes : elles passent devant tout le reste. */
function NouvellesDemandes() {
  const demandes = useDemandes((s) => s.demandes);
  const vuesIci = useDemandes((s) => s.vuesIci);
  const pret = useDemandes((s) => s.etat === "pret");
  const n = pret ? nonVues(demandes, vuesIci) : 0;
  if (!n) return null;
  const d = demandes.find((x) => !x.vue && !vuesIci.includes(x.id)) ?? demandes[0];
  return (
    <section className="bq-dem rise">
      <span className="bq-hd">
        <b>{n > 1 ? `${n} nouvelles demandes` : "Une nouvelle demande"}</b>
        <Link href="/demandes" className="bq-lnk">
          Tout voir
        </Link>
      </span>
      <Link href="/demandes" className="bq-dem-c">
        <span className="bq-av">{(d.nom || "?").slice(0, 2).toUpperCase()}</span>
        <span>
          <b>{d.nom || "Un cavalier"}</b>
          <small>{d.cherche || d.message}</small>
        </span>
      </Link>
      <Link href="/demandes" className="btn full">
        Voir la demande
      </Link>
    </section>
  );
}

/** Un flot : la rosette gagnée, vert anglais et rose casaque. */
function Flot() {
  return (
    <svg viewBox="0 0 64 64" className="lv2-svg" aria-hidden="true">
      <path d="M22 38 15 61l9-4 5 7 6-22z" fill="var(--vert-deep)" />
      <path d="M42 38l7 23-9-4-5 7-6-22z" fill="#1A5E47" />
      <circle cx="32" cy="27" r="21" fill="var(--acc)" stroke="var(--acc)" strokeWidth="4" strokeDasharray="3.2 3" />
      <circle cx="32" cy="27" r="14.5" fill="#FCFBF9" />
      <circle cx="32" cy="27" r="11" fill="none" stroke="var(--rose)" strokeWidth="2.5" />
      <path d="m26.5 27.2 3.8 3.8 7.3-7.6" fill="none" stroke="var(--acc)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 2. Le chemin des premiers pas, pour une fiche : le livret rose et ses flots. */
function CheminFiche({ onQuestion }: { onQuestion: (q: Question) => void }) {
  const fiche = useMaFiche((s) => s.fiche);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 250);
    return () => clearTimeout(t);
  }, []);
  if (!fiche) return null;
  const ok = (k: string) => jaugeFiche(fiche).manque.every((i) => i.k !== k);
  const pas: { t: string; ok: boolean; ic: string; q?: Question; titre: string; texte: string; bouton: string; ill: "accueil-premier" | "cavaliere" | "brouette" }[] = [
    { t: "Ta fiche", ok: true, ic: "flag", titre: "", texte: "", bouton: "", ill: "accueil-premier" },
    { t: "Prix et places", ok: ok("places") && ok("prix"), ic: "euro", q: "places", titre: "Tes places et ton prix", texte: "Deux questions. Ce sont les premières choses que regardent les cavaliers.", bouton: "Répondre aux deux questions", ill: "accueil-premier" },
    { t: "Tes photos", ok: ok("photos"), ic: "camera", titre: "Tes photos", texte: "Trois photos au moins. Une photo prise avec ton téléphone, c’est parfait.", bouton: "Ajouter mes photos", ill: "cavaliere" },
    { t: "Ce que tu proposes", ok: ok("hebergement") && ok("installations") && ok("services") && ok("activites"), ic: "list", q: "propose", titre: "Ce que tu proposes", texte: "Activités, hébergement, installations, services : coche ce qui est vrai chez toi.", bouton: "Cocher ce que je propose", ill: "brouette" },
  ];
  const gagnes = pas.filter((p) => p.ok).length;
  if (gagnes === pas.length) return null;
  const maintenant = pas.find((p) => !p.ok)!;
  return (
    <section className={`lv2 rise${go ? " go" : ""}`} aria-label={`Ta fiche, pour bien démarrer : ${gagnes} flots gagnés sur ${pas.length}`}>
      <div className="lv2-hd">
        <h2>Ta fiche, pour bien démarrer</h2>
        <span className="lv2-compte">
          <b>{gagnes}</b> {gagnes > 1 ? "flots" : "flot"} sur {pas.length}
        </span>
      </div>
      <p className="lv2-sub">{fiche.en_attente ? "Prépare-la pendant qu’on vérifie : tout est gardé. " : "Ce que les cavaliers regardent avant d’écrire. "}Chaque pas te rapporte un flot.</p>
      <ol className="lv2-rail" style={{ ["--fait" as string]: `${((gagnes - 1) / (pas.length - 1)) * 75}%` }}>
        {pas.map((p, k) => {
          const e = p.ok ? "ok" : p === maintenant ? "now" : "apres";
          return (
            <li key={p.t} className={e} style={{ ["--k" as string]: k }}>
              <span className="lv2-flot" aria-hidden="true">
                {p.ok ? <Flot /> : <Ic n={p.ic} className="" />}
              </span>
              <b>{p.t}</b>
              <small>{p.ok ? "Gagné" : e === "now" ? "Maintenant" : "Ensuite"}</small>
            </li>
          );
        })}
      </ol>
      <div className="af-step lv2-step">
        <div>
          <b>{maintenant.titre}</b>
          <p>{maintenant.texte}</p>
        </div>
        <Ill n={maintenant.ill} className="af-step-ill" />
        {maintenant.q ? (
          <button type="button" className="af-btn" onClick={() => onQuestion(maintenant.q!)}>
            {maintenant.bouton}
          </button>
        ) : (
          <Link href="/ma-fiche" className="af-btn">
            {maintenant.bouton}
          </Link>
        )}
      </div>
    </section>
  );
}

/** Sans fiche : la retrouver dans l'annuaire, ou l'ajouter. */
function SansFiche() {
  return (
    <section className="bq-fiche rise">
      <span className="bq-hd">
        <b>Ton écurie sur bestable.fr</b>
      </span>
      <span className="bq-fiche-t">Retrouve ta fiche parmi les écuries de l’annuaire, ou ajoute-la. C’est gratuit, et c’est elle qui reçoit les demandes des cavaliers.</span>
      <Link href="/compte/inscription?retrouver=1" className="btn full" style={{ marginTop: 12 }}>
        Trouver mon écurie
      </Link>
    </section>
  );
}

/** 4. Ta journée, sous cadenas pendant l'essai : un aperçu, et l'offre qui l'ouvre. */
function JourneeVerrou() {
  return (
    <Link href="/planning" className="bq-jour bq-lock rise">
      <span className="bq-hd">
        <b>
          Ta journée <Ic n="lock" className="bq-hlk" />
        </b>
        <span className="bq-ex">Exemple</span>
      </span>
      <span className="bq-jl">
        <span className="h">10 h</span>
        <span>
          <b>Cours débutants</b>
          <small>4 cavaliers · carrière</small>
        </span>
      </span>
      <span className="bq-lk-tx">
        Le planning vient avec le site à 49 €. Voir ce qu’il fait <Ic n="arrow" className="" />
      </span>
    </Link>
  );
}

/** 6. Une seule invitation, la plus utile au moment, jamais en tête. */
function Invitation({ argent, site, alerte, essai, complete }: { argent: string; site: string; alerte: boolean; essai: boolean; complete: boolean }) {
  if (argent === "bientot" && complete)
    return alerte ? (
      <Link href="/chevaux" className="bq-al-mini rise">
        <Ic n="bell" className="" />
        <span>
          <b>Mon argent arrive bientôt</b>
          <small>Tu seras prévenu à l’ouverture.</small>
        </span>
      </Link>
    ) : (
      <Alerte id="argent" />
    );
  if (argent === "cadenas" && essai && complete)
    return (
      <Link href="/chevaux" className="bq-inv rise">
        <span>
          <span className="k">30 jours pour essayer</span>
          <b>Ce que te rapporte chaque cheval</b>
          <small>Mon argent : ton bilan, tes clients, tes chevaux. Sans carte bancaire.</small>
          <em>Voir</em>
        </span>
        <Ill n="sacoche" />
      </Link>
    );
  if ((argent === "ouverte" || argent === "essai") && site !== "ouverte")
    return (
      <Link href="/mon-site" className="bq-inv r rise">
        <span>
          <span className="k">Déjà fait</span>
          <b>Ton site, à ton nom</b>
          <small>Fait à partir de ta fiche, pour qu’on te trouve sur Google. À partir de 19 € par mois.</small>
          <em>Voir mon site</em>
        </span>
        <Ill n="promo" />
      </Link>
    );
  return null;
}
