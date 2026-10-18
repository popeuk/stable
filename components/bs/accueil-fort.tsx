"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic, Ill, sgc, type IllName } from "@/components/carnet/ui";
import { estAMoi } from "@/components/bs/parcours";
import { premiersJours } from "@/components/bs/compte";
import { getSession } from "@/lib/account/session";
import { api } from "@/lib/account/api";
import { ficheRows } from "@/components/bs/account-ui";
import { monthBreakdown } from "@/lib/domain/ticket";
import { estEstimation } from "@/lib/domain/estimation";
import { currentPeriod } from "@/lib/utils/period";
import { useDataStore } from "@/stores/data-store";
import { useUiStore, type AddMode } from "@/stores/ui-store";

/**
 * L'accueil d'une écurie qui démarre (18 octobre 2026, décision de Samuel :
 * « plus fort » quand l'app est vide). Les blocs, dans l'ordre de l'accueil :
 *   - Stories : des ronds en haut, une histoire courte par geste de l'app.
 *     Un rond vu passe au gris ; la rangée part quand tout est vu. Retirées
 *     de l'accueil pour le moment (Samuel, 18 octobre), gardées ici.
 *   - CeQuiManque : sous le chiffre, tant qu'aucune charge n'existe, ce qui
 *     rentre (en vert) et ce qui manque (hachuré), avec de quoi l'ajouter.
 *   - Chemin : cinq pas lus dans les données (prix, chevaux et propriétaires
 *     dans la fiche du cheval, frais, premier soin, fiche mon-ecurie.fr),
 *     un seul à faire maintenant, le fil rouge ne relie que deux pas faits,
 *     un flot gagné au bout (jamais perdu). Les 30 premiers jours d'usage
 *     seulement ; il part une fois le flot vu.
 *   - JourneeMontree : la journée vide montre une journée type, en pointillé
 *     et étiquetée « Exemple », puis le micro et les trois ajouts.
 * Styles : app/carnet/accueil-fort.css.
 */

const sansNomRe = /^cheval\s*\d+$/i;
const lire = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const ecrire = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const demo = () => getSession()?.kind === "demo";
/** Le chemin parle aux écuries qui démarrent : les 30 premiers jours d'usage, hors écurie d'exemple. */
const cheminPossible = () => !demo() && premiersJours(30);

/* ---------- Le chemin ---------- */

type Pas = { id: string; fait: boolean; titre: string; sous: string; gain?: string; ill: IllName; cta: string; href?: string; noter?: AddMode | "grille" };

/** La fiche mon-ecurie.fr est-elle remplie (reprise, tarifs, places, photos, contact) ? Lue une fois, gardée sur l'appareil. */
const FICHE_OK = "be-stable-fiche-remplie";
function useFicheRemplie() {
  const [ok, setOk] = useState(() => lire(FICHE_OK) === "1");
  useEffect(() => {
    const s = getSession();
    if (s?.kind !== "compte" || !s.listing) return;
    let vivant = true;
    api.maFiche().then(
      (f) => {
        const v = ficheRows(f, s.listing?.status === "validee").every((r) => r[1]);
        ecrire(FICHE_OK, v ? "1" : "0");
        if (vivant) setOk(v);
      },
      () => {},
    );
    return () => {
      vivant = false;
    };
  }, []);
  return ok;
}

/** Les cinq pas, lus dans les données. Le premier est fait dès la sortie du parcours. */
export function usePas(): Pas[] {
  const data = useDataStore();
  const fiche = useFicheRemplie();
  return useMemo(() => {
    const actifs = data.horses.filter((h) => !h.isArchived);
    // Un cheval est complet avec son vrai nom et, s'il est en pension, son propriétaire : les deux se notent dans sa fiche.
    const aFinir = actifs.filter((h) => sansNomRe.test(h.name.trim()) || (!estAMoi(h) && !h.ownerName?.trim()));
    const b = monthBreakdown(data, currentPeriod());
    const charges = b.sharedTotal + b.direct + b.outside > 0 || data.sharedExpenses.length > 0 || (data.recurringExpenses ?? []).length > 0;
    // « Ton premier soin » : un soin ou un frais d’un cheval, pas une séance (le titre dit « soin »).
    const soin = (data.careEvents ?? []).length > 0 || data.directExpenses.length > 0;
    const h = aFinir[0];
    return [
      // Sans cheval (questions passées, ou écurie vidée), ce pas est à faire : il mène aux trois questions.
      { id: "prix", fait: actifs.length > 0, titre: "Tes prix et ton mois", sous: actifs.length ? "Faits pendant les questions." : "Tes chevaux, tes prix, tes frais : trois questions, et tu vois ton mois.", ill: "tete", cta: "Répondre aux trois questions", href: "/parcours" },
      {
        id: "chevaux",
        fait: actifs.length > 0 && !aFinir.length,
        titre: "Tes chevaux et leurs propriétaires",
        sous: h
          ? `Dans la fiche de chaque cheval : son vrai nom et qui paie sa pension. ${aFinir.length > 1 ? `Encore ${aFinir.length} chevaux, en commençant par ${h.name}.` : `Il reste ${h.name}.`}`
          : "",
        gain: "pour un chiffre juste",
        ill: "tete",
        cta: h ? `Compléter ${h.name}` : "",
        href: h ? `/saisie/cheval?edit=${h.id}&retour=accueil` : "/chevaux?vue=chevaux",
      },
      {
        id: "frais",
        fait: charges,
        titre: "Tes frais de l’écurie",
        sous: "Foin, paille, loyer : à peu près, ça suffit. L’app les partage entre tes chevaux.",
        gain: "pour un chiffre juste",
        ill: "foin",
        cta: "Ajouter mes frais",
        href: "/parcours/factures?retour=accueil",
      },
      {
        id: "soin",
        fait: soin,
        titre: "Ton premier soin, à la voix",
        sous: "« Vermifuge pour Cheval 3, 12 € » : le soin, le cheval et le coût, rangés.",
        gain: "30 secondes",
        ill: "carnet-buste",
        cta: "Dire mon premier soin",
        noter: "grille",
      },
      {
        id: "fiche",
        fait: fiche,
        titre: "Ta fiche sur mon-ecurie.fr",
        sous: "Les cavaliers y cherchent leur pension. Tes photos, tes places libres et tes tarifs : c’est ce qu’ils regardent avant d’écrire.",
        gain: "gratuit",
        ill: "cavaliere",
        cta: "Remplir ma fiche",
        href: "/ma-fiche",
      },
    ] satisfies Pas[];
  }, [data, fiche]);
}

const FLOT_VU = "be-stable-flot-lancee";

export function Chemin({ delay = 0.1 }: { delay?: number }) {
  const hydrated = useDataStore((s) => s.hydrated);
  const pas = usePas();
  const openNoter = useUiStore((s) => s.openNoter);
  const [etat] = useState(() => ({ vu: lire(FLOT_VU) === "1", ok: cheminPossible() }));
  const [ferme, setFerme] = useState(etat.vu);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 60);
    return () => clearTimeout(t);
  }, []);
  if (!hydrated || !etat.ok || ferme) return null;

  const faits = pas.filter((p) => p.fait).length;
  const now = pas.find((p) => !p.fait);
  const total = pas.length;

  // Tout est fait : le flot, une fois, puis le chapitre s'en va.
  if (!now)
    return (
      <section className="af-chemin af-gagne rise" style={{ animationDelay: `${delay}s` }} aria-label="Ton écurie est lancée">
        <Ill n="rosette" className="af-rosette" />
        <h2>Ton écurie est lancée.</h2>
        <p>Tes chevaux ont leur nom, tes frais sont comptés, ta fiche attend les cavaliers.</p>
        <button
          type="button"
          className="af-btn rose"
          onClick={() => {
            ecrire(FLOT_VU, "1");
            setFerme(true);
          }}
        >
          Merci
        </button>
      </section>
    );

  const action = now.noter ? (
    <button type="button" className="af-btn" onClick={() => openNoter(now.noter === "grille" ? {} : { mode: now.noter as AddMode })}>
      {now.cta}
    </button>
  ) : (
    <Link href={now.href!} className="af-btn">
      {now.cta}
    </Link>
  );

  return (
    <section className="af-chemin rise" style={{ animationDelay: `${delay}s` }} aria-label={`Pour bien démarrer : ${faits} choses faites sur ${total}`}>
      <h2>Pour bien démarrer</h2>
      <p className="af-sub">{!pas[0].fait ? "Tout commence par les trois questions. Le reste se fait dans la cour, à ton rythme." : faits <= 1 ? "Le premier est fait. Le reste se fait dans la cour, à ton rythme." : "Le reste se fait dans la cour, à ton rythme."}</p>
      {/* Le fil rouge ne relie que deux pas faits qui se suivent : un pas fait en avance reste seul, sans fil. */}
      <div className={`af-rail${go ? " go" : ""}`} aria-hidden="true">
        {pas.map((p, k) => {
          const suivant = pas[k + 1];
          const fil = p.fait && (suivant ? suivant.fait : false);
          return (
            <span key={p.id} className="af-cell">
              <i className={`af-seg${fil ? " on" : ""}${suivant ? "" : " fin"}`} style={{ transitionDelay: `${0.25 + k * 0.18}s` }} />
              <span className={`af-st${p.fait ? " ok" : p === now ? " now" : ""}`}>{p.fait && <Ic n="ck" className="" />}</span>
            </span>
          );
        })}
        <Ill n="rosette" className="af-flot" />
      </div>
      <div className="af-step">
        <div>
          <span className="af-k">Maintenant{now.gain && !now.gain.includes("chiffre") ? ` · ${now.gain}` : ""}</span>
          <b>{now.titre}</b>
          <p>{now.sous}</p>
        </div>
        <Ill n={now.ill} className="af-step-ill" />
        {action}
      </div>
      <ol className="af-next">
        {pas
          .filter((p) => p !== now)
          .map((p) => (
            <li key={p.id} className={p.fait ? "done" : ""}>
              <span className={`af-n${p.fait ? " ok" : ""}`}>{p.fait ? <Ic n="ck" className="" /> : pas.indexOf(p) + 1}</span>
              <span>
                <b>{p.titre}</b>
              </span>
              {!p.fait && p.gain && <span className="af-gain">{p.gain}</span>}
            </li>
          ))}
      </ol>
      <p className="af-flotline">
        <Ill n="rosette" />
        <span>
          <b>Au bout : le flot « Écurie lancée ».</b>
        </span>
      </p>
    </section>
  );
}

/** Le chemin est-il encore là ? Les autres invites de l'accueil se taisent tant qu'il parle. */
export function useCheminActif() {
  const pas = usePas();
  const [etat] = useState(() => ({ vu: lire(FLOT_VU) === "1", ok: cheminPossible() }));
  return !etat.vu && etat.ok && pas.some((p) => !p.fait);
}

/* ---------- Sous le chiffre : ce qui manque ---------- */

export function CeQuiManque() {
  const data = useDataStore();
  const hydrated = useDataStore((s) => s.hydrated);
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGo(true), 300);
    return () => clearTimeout(t);
  }, []);
  const v = useMemo(() => {
    const p = currentPeriod();
    const b = monthBreakdown(data, p);
    const charges = b.sharedTotal + b.direct + b.outside;
    const n = data.horses.filter((h) => !h.isArchived && !estAMoi(h)).length;
    return { revenu: b.revenue, charges, n, estime: estEstimation(data, p) };
  }, [data]);
  if (!hydrated || v.charges > 0 || v.revenu <= 0) return null;
  return (
    <div className={`af-manque rise${go ? " go" : ""}`} style={{ animationDelay: "0.08s" }}>
      <div className="af-bars" aria-hidden="true">
        <span className="af-bar">
          <span>Pensions{v.n ? ` · ${v.n} cheva${v.n > 1 ? "ux" : "l"}` : ""}</span>
          <b className="af-in">{sgc(v.revenu)}</b>
          <i className="tr">
            <i />
          </i>
        </span>
        <span className="af-bar">
          <span>Foin, paille, maréchal…</span>
          <b className="af-q">à ajouter</b>
          <i className="tr">
            <i className="vide" />
          </i>
        </span>
      </div>
      <Link href="/parcours/factures?retour=accueil" className="af-alerte">
        <Ill n="foin" />
        <span>
          Sans tes frais, ce chiffre est trop beau. Ajoute ce que coûte l’écurie chaque mois : l’app le partage entre tes chevaux.
          <b>Ajouter mes frais</b>
        </span>
      </Link>
    </div>
  );
}

/* ---------- La journée montrée ---------- */

const TYPE: { t: string; b: string; s: string }[] = [
  { t: "7 h 30", b: "Foin et eau", s: "toutes les places" },
  { t: "10 h", b: "Cours collectif", s: "la présence compte toute seule" },
  { t: "17 h 30", b: "Maréchal", s: "son coût va sur la fiche du cheval" },
];

/** Rien n'a jamais été noté : la journée vide se montre, au lieu d'une phrase. */
export function useJamaisNote() {
  const d = useDataStore();
  return !(d.careEvents ?? []).length && !(d.seances ?? []).length && !(d.tasks ?? []).length;
}

export function JourneeMontree() {
  const openNoter = useUiStore((s) => s.openNoter);
  const ajouts: { mode: AddMode; n: string; t: string }[] = [
    { mode: "seance", n: "cal", t: "Séance" },
    { mode: "soin", n: "syringe", t: "Soin" },
    { mode: "tache", n: "list", t: "Tâche" },
  ];
  return (
    <div className="af-jour">
      <span className="af-lbl">
        <Ic n="clock" className="" />
        Exemple · une journée type
      </span>
      <div className="af-ghost" aria-label="Exemple de journée : foin et eau à 7 h 30, cours collectif à 10 h, maréchal à 17 h 30">
        {TYPE.map((r, i) => (
          <div key={r.t} className="af-gr" style={{ animationDelay: `${0.2 + i * 0.12}s` }} aria-hidden="true">
            <time>{r.t}</time>
            <span>
              <b>{r.b}</b>
              <small>{r.s}</small>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="af-mic" onClick={() => openNoter({})}>
        <span className="dot">
          <Ic n="mic" className="" />
        </span>
        <span>
          <b>Dis-le, c’est noté</b>
          <small>« Demain 10 h, cours avec Jade et Lou »</small>
        </span>
      </button>
      <div className="af-quick">
        {ajouts.map((a) => (
          <button key={a.mode} type="button" onClick={() => openNoter({ mode: a.mode })}>
            <Ic n={a.n} className="" />
            {a.t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Les stories ---------- */

type Story = { id: string; nom: string; rond: ReactNode; ill: IllName; titre: string; texte: string; cta: string; href?: string; noter?: boolean };

const STORIES: Story[] = [
  {
    id: "journee",
    nom: "Ta journée",
    rond: <Ill n="matin" />,
    ill: "matin",
    titre: "Le matin, ta journée est là.",
    texte: "Les séances, les soins, les tâches de l’équipe. Coche ce qui est fait : ça compte tout seul dans tes chiffres.",
    cta: "Voir le planning",
    href: "/planning",
  },
  {
    id: "micro",
    nom: "Au micro",
    rond: <Ic n="mic" className="" />,
    ill: "carnet",
    titre: "Tu parles, c’est rangé.",
    texte: "« Vermifuge pour Cheval 3, 12 € » : l’app range le soin, le cheval et le prix.",
    cta: "Essayer le micro",
    noter: true,
  },
  {
    id: "bilan",
    nom: "Ton bilan",
    rond: <Ill n="sacoche" />,
    ill: "sacoche",
    titre: "Chaque cheval a son chiffre.",
    texte: "Ce qu’il rapporte, ce qu’il coûte. Tu vois tout de suite lequel te coûte.",
    cta: "Voir mon bilan",
    href: "/argent",
  },
  {
    id: "pension",
    nom: "Le 1er du mois",
    rond: <Ill n="sereine" />,
    ill: "sereine",
    titre: "Les pensions se comptent toutes seules.",
    texte: "Le 1er du mois, chaque pension est comptée. Toi, tu regardes qui a payé.",
    cta: "Voir mes clients",
    href: "/chevaux?vue=clients",
  },
];
const VUES = "be-stable-stories-vues";
const DUREE = 6500;

export function Stories() {
  const [vues, setVues] = useState<string[]>(() => {
    try {
      return JSON.parse(lire(VUES) ?? "[]");
    } catch {
      return [];
    }
  });
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [garder] = useState(() => STORIES.some((s) => !vues.includes(s.id)));
  if (!garder || demo()) return null;

  const voir = (id: string) =>
    setVues((v) => {
      if (v.includes(id)) return v;
      const n = [...v, id];
      ecrire(VUES, JSON.stringify(n));
      return n;
    });

  return (
    <>
      <div className="af-stories rise" role="list" aria-label="Découvrir l’app">
        {STORIES.map((s, i) => (
          <button key={s.id} type="button" role="listitem" className={`af-story${vues.includes(s.id) ? " vu" : ""}`} onClick={() => setOuvert(i)}>
            <span className="ring">
              <span className={`in ${s.id}`}>{s.rond}</span>
            </span>
            {s.nom}
          </button>
        ))}
      </div>
      {ouvert !== null && <Lecteur depart={ouvert} onVoir={voir} onClose={() => setOuvert(null)} />}
    </>
  );
}

function Lecteur({ depart, onVoir, onClose }: { depart: number; onVoir: (id: string) => void; onClose: () => void }) {
  const [i, setI] = useState(depart);
  const [pause, setPause] = useState(false);
  const openNoter = useUiStore((s) => s.openNoter);
  const s = STORIES[i];
  const reste = useRef(DUREE);
  const debut = useRef(0);

  useEffect(() => onVoir(s.id), [s.id, onVoir]);
  // L'avance automatique, qui s'arrête quand on garde le doigt posé.
  useEffect(() => {
    reste.current = DUREE;
  }, [i]);
  useEffect(() => {
    if (pause || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    debut.current = performance.now();
    const t = setTimeout(() => (i < STORIES.length - 1 ? setI(i + 1) : onClose()), reste.current);
    return () => {
      clearTimeout(t);
      reste.current = Math.max(0, reste.current - (performance.now() - debut.current));
    };
  }, [i, pause, onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => (x < STORIES.length - 1 ? x + 1 : x));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = o;
    };
  }, [onClose]);

  const suivant = () => (i < STORIES.length - 1 ? setI(i + 1) : onClose());
  const precedent = () => setI(Math.max(0, i - 1));

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="af-lecteur" role="dialog" aria-modal="true" aria-label={s.nom}>
        <div className="af-prog" aria-hidden="true">
          {STORIES.map((x, k) => (
            <i key={x.id} className={k < i ? "fait" : k === i ? `ici${pause ? " pause" : ""}` : ""} style={k === i ? { animationDuration: `${DUREE}ms` } : undefined} />
          ))}
        </div>
        <button type="button" className="af-x" onClick={onClose} aria-label="Fermer">
          <Ic n="x" className="" />
        </button>
        <div
          className="af-scene"
          key={s.id}
          onPointerDown={() => setPause(true)}
          onPointerUp={() => setPause(false)}
          onPointerLeave={() => setPause(false)}
        >
          <Ill n={s.ill} className="af-scene-ill" prio />
          <button type="button" className="af-zone g" onClick={precedent} aria-label="Histoire précédente" />
          <button type="button" className="af-zone d" onClick={suivant} aria-label="Histoire suivante" />
        </div>
        <div className="af-texte" key={`t-${s.id}`}>
          <h2>{s.titre}</h2>
          <p>{s.texte}</p>
          {s.noter ? (
            <button
              type="button"
              className="af-btn rose"
              onClick={() => {
                onClose();
                openNoter({});
              }}
            >
              {s.cta}
            </button>
          ) : (
            <Link href={s.href!} className="af-btn rose" onClick={onClose}>
              {s.cta}
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
