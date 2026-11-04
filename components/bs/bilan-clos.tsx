"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cap } from "@/components/bs/ui";
import { plannedRest } from "@/components/bs/goal-card";
import { eur } from "@/components/carnet/ui";
import { monthBreakdown } from "@/lib/domain/ticket";
import { cleMois, type Palier } from "@/lib/domain/paliers";
import { lignesAMontrer, lignesPrestations, objectifDe, realisePrestations } from "@/lib/domain/objectifs-prestations";
import {
  anneeDuBilan,
  avancePrise,
  avecHypotheses,
  etatPalier,
  gainHypotheses,
  objectifDuMois,
  objectifTenu,
  type Hypotheses,
  type MoisBilan,
} from "@/lib/domain/prevision";
import type { Period } from "@/lib/domain/types";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Mon bilan, version du Clos : tourné vers l'année qui vient.
 * En haut, le mois choisi en grand (le mois en cours d'abord) face à son
 * objectif, avec le flot quand il est dépassé ; l'avance prise ; les quatorze
 * mois à toucher ; « Et si… » ; les paliers et les prestations.
 * Le prévisionnel vient de lib/domain/prevision.ts.
 */

const nomMois = (p: Period, annee = false) => new Date(p.year, p.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", ...(annee ? { year: "numeric" } : {}) });
const initiale = (p: Period) => nomMois(p).charAt(0).toUpperCase();
const signe = (n: number) => `${n >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(n)))}`;
const MAX_PENSIONS = 6;
const MAX_COURS = 8;

/** Le flot : gagné (vert et rose), ou en creux tant qu'il reste à gagner. */
function Flot({ gagne, l1, l2 }: { gagne: boolean; l1: string; l2: string }) {
  const sc = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return <circle key={i} cx={(60 + 41 * Math.cos(a)).toFixed(2)} cy={(52 + 41 * Math.sin(a)).toFixed(2)} r="9.5" />;
  });
  return (
    <svg viewBox="0 0 120 150" aria-hidden="true" className={gagne ? "bc-flot-g" : "bc-flot-c"}>
      <path className="bc-q1" d="M40 82 L26 146 L43 135 L53 148 L60 90Z" />
      <path className="bc-q2" d="M80 82 L94 146 L77 135 L67 148 L60 90Z" />
      <g className="bc-disc">{sc}</g>
      <circle className="bc-disc" cx="60" cy="52" r="42" />
      <circle className="bc-centre" cx="60" cy="52" r="35" />
      <circle className="bc-anneau" cx="60" cy="52" r="29.5" fill="none" strokeWidth=".8" strokeDasharray="1.6 2.4" />
      <text className="bc-lettre" x="60" y="49" textAnchor="middle">
        {l1}
      </text>
      <text className="bc-lettre" x="60" y="64" textAnchor="middle">
        {l2}
      </text>
    </svg>
  );
}

export function BilanClos() {
  const data = useDataStore();
  const paliers = useSettingsStore((s) => s.paliers);
  const objectifs = useSettingsStore((s) => s.objectifsPrestations);
  const now = useMemo(() => currentPeriod(), []);
  const today = localToday();
  const reste = useMemo(() => plannedRest(data, today), [data, today]);
  const base = useMemo(() => anneeDuBilan(data, now, reste), [data, now, reste]);
  const iNow = base.findIndex((m) => m.etat === "encours");
  const [sel, setSel] = useState(iNow);
  const [lire, setLire] = useState(false);
  const [plusP, setPlusP] = useState(0);
  const [plusC, setPlusC] = useState(0);

  // Ce que rapporte une pension de plus : ce que laisse une pension en moyenne, une fois ses soins payés.
  const parPension = useMemo(() => {
    const c = monthBreakdown(data, now).contribution;
    if (c > 0) return Math.round(c);
    const prix = data.horses.filter((h) => !h.isArchived && (h.pension ?? 0) > 0).map((h) => h.pension ?? 0);
    return prix.length ? Math.round(prix.reduce((t, x) => t + x, 0) / prix.length) : 0;
  }, [data, now]);
  // Le prix d'un cours particulier, s'il existe.
  const parCours = useMemo(() => {
    const p = (data.prestations ?? []).find((x) => x.active && /particuli/i.test(x.label)) ?? (data.prestations ?? []).find((x) => x.active && x.hasFormat);
    return p?.price ?? 0;
  }, [data.prestations]);
  const hyp: Hypotheses = { pensions: plusP, coursParSemaine: plusC, parPension, parCours };
  const mois = useMemo(() => avecHypotheses(base, hyp), [base, plusP, plusC, parPension, parCours]); // eslint-disable-line react-hooks/exhaustive-deps
  const gain = gainHypotheses(hyp);

  const m = mois[sel] ?? mois[iNow];
  const obj = objectifDuMois(paliers, m.periode);
  const avance = avancePrise(mois, paliers);

  return (
    <div className="bc">
      <div className="bc-tete">
        <h2>Mon bilan</h2>
        <button type="button" className={`bc-aide${lire ? " on" : ""}`} aria-expanded={lire} aria-controls="bc-lire" onClick={() => setLire((x) => !x)}>
          {lire ? "Compris" : "Comment lire ?"}
        </button>
      </div>
      {lire && (
        <div className="bc-lire" id="bc-lire">
          <p>
            <i className="bc-k-reel" />
            <span>
              <b>Vert plein</b> : l’argent qui t’est vraiment resté (ce qui est rentré, moins ce qui est sorti).
            </span>
          </p>
          <p>
            <i className="bc-k-prevu bc-hachure" />
            <span>
              <b>Hachuré</b> : ce qui est prévu, d’après tes pensions, tes cours au planning et tes frais habituels.
            </span>
          </p>
          <p>
            <i className="bc-k-obj" />
            <span>
              <b>Trait noir</b> : l’objectif du mois, le palier que tu vises.
            </span>
          </p>
        </div>
      )}

      <Carte m={m} obj={obj} paliers={paliers} parPension={parPension} plusP={plusP} setPlusP={setPlusP} />

      {paliers.length > 0 && avance.comptes > 0 && (
        <div className="bc-avance">
          <span className="bc-avance-v">{signe(avance.montant)}</span>
          <p>{avance.montant >= 0 ? "d’avance" : "de retard"} sur tes objectifs, depuis {avance.depuis ? nomMois(avance.depuis) : "le début"}.</p>
          <small>
            {avance.tenus} mois sur {avance.comptes} au-dessus de l’objectif.{avance.montant > 0 ? " C’est ta marge pour les mois calmes." : ""}
          </small>
        </div>
      )}
      {!paliers.length && (
        <div className="bc-vide">
          <p>
            <b>Pose tes paliers</b> pour voir l’objectif de chaque mois, l’avance prise et quand tu passes chaque cap.
          </p>
          <Link href="/paliers" className="btn full">
            Poser mes paliers
          </Link>
        </div>
      )}

      <h3 className="bc-h">Ton année, mois par mois</h3>
      <p className="bc-sub">Touche un mois pour le voir en grand.</p>
      <Frise mois={mois} paliers={paliers} sel={sel} setSel={setSel} />

      {(parPension > 0 || parCours > 0) && (
        <>
          <h3 className="bc-h">Et si…</h3>
          <p className="bc-sub">Ajoute des clients pour voir ce qui change. Rien n’est enregistré.</p>
          <div className="bc-sim">
            {parPension > 0 && (
              <Pas
                titre="Pensions en plus"
                aide={`dès ${nomMois(mois[iNow + 1]?.periode ?? now)} · environ ${eur(parPension)} de reste chacune`}
                v={plusP}
                set={setPlusP}
                max={MAX_PENSIONS}
                moins="Une pension de moins"
                plus="Une pension de plus"
              />
            )}
            {parCours > 0 && (
              <Pas titre="Cours particuliers en plus" aide={`par semaine · ${eur(parCours)} le cours`} v={plusC} set={setPlusC} max={MAX_COURS} moins="Un cours de moins par semaine" plus="Un cours de plus par semaine" />
            )}
            <Effet base={base} mois={mois} paliers={paliers} gain={gain} />
            {(plusP > 0 || plusC > 0) && (
              <button
                type="button"
                className="bc-reset"
                onClick={() => {
                  setPlusP(0);
                  setPlusC(0);
                }}
              >
                Revenir au prévu
              </button>
            )}
          </div>
        </>
      )}

      {paliers.length > 0 && (
        <>
          <h3 className="bc-h">Tes paliers</h3>
          <p className="bc-sub">Quand tu passes chacun, au rythme prévu.</p>
          <ul className="bc-paliers">
            {paliers.map((p, i) => (
              <LignePalier key={p.nom + i} p={p} i={i} mois={mois} />
            ))}
          </ul>
        </>
      )}

      {paliers.length > 0 && obj && <Prestations periode={m.periode} iPalier={obj.i} palier={paliers[obj.i]} now={now} objectifs={objectifs} />}

      <div className="bc-liens">
        <Link href="/argent?vue=mouvements" className="bc-lien">
          Ce qui rentre et ce qui sort <i>{nomMois(now)}</i>
        </Link>
        <Link href="/argent?vue=leviers" className="bc-lien">
          Des idées pour gagner plus <i>›</i>
        </Link>
        <Link href="/paliers" className="bc-lien">
          Régler les paliers et les objectifs <i>›</i>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Le mois en grand ---------- */
function Carte({
  m,
  obj,
  paliers,
  parPension,
  plusP,
  setPlusP,
}: {
  m: MoisBilan;
  obj: { i: number; seuil: number } | null;
  paliers: Palier[];
  parPension: number;
  plusP: number;
  setPlusP: (n: number) => void;
}) {
  const cur = m.etat === "encours";
  const fut = m.etat === "avenir";
  const val = m.valeur;
  const titre = cap(nomMois(m.periode, m.periode.year !== currentPeriod().year || m.etat === "passe"));
  if (val === null) {
    return (
      <div className="bc-carte">
        <div className="bc-haut">
          <span className="bc-mo">{titre}</span>
          <span className="bc-chip">passé</span>
        </div>
        <p className="bc-dit">Rien n’est noté pour ce mois-là.</p>
      </div>
    );
  }
  const t = obj?.seuil ?? null;
  const gagne = t !== null && objectifTenu(val, t);
  const suivant = obj ? paliers[obj.i + 1] : undefined;
  const grand = cur ? (m.reel ?? 0) : val;
  const unite = cur ? "déjà là" : fut ? "prévus" : "restés";
  // La jauge : de zéro au palier suivant (ou au-delà).
  const haut = Math.max(suivant?.seuil ?? 0, t ?? 0, val, m.reel ?? 0, 1) * 1.1;
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / haut) * 100)).toFixed(1)}%`;
  const bord = (x: number) => {
    const q = (x / haut) * 100;
    return q > 70 ? " bc-d" : q < 14 ? " bc-g" : "";
  };
  const reelBarre = cur ? (m.reel ?? 0) : fut ? 0 : val;
  const prevuBarre = cur ? (m.prevu ?? 0) : fut ? val : 0;
  const manque = t !== null && !gagne ? Math.max(0, Math.round((t > 0 ? t : 1) - val)) : 0;
  const besoin = parPension > 0 && manque > 0 ? Math.ceil(manque / parPension) : 0;
  return (
    <div className={`bc-carte${gagne ? " gagne" : ""}`} aria-live="polite">
      <div className="bc-haut">
        <span className="bc-mo">{titre}</span>
        {cur ? <span className="bc-chip live">en cours</span> : <span className="bc-chip">{fut ? "prévu" : "passé"}</span>}
      </div>
      {t !== null && (
        // Le flot tombe à chaque mois gagné qu'on ouvre : la clé le remonte.
        <div key={`${m.cle}:${gagne}`} className={`bc-flot${gagne ? " pop" : ""}`}>
          <Flot gagne={gagne} l1={gagne ? "Objectif" : "À"} l2={gagne ? "dépassé" : "gagner"} />
        </div>
      )}
      <p className={`bc-fig${fut ? "" : grand < 0 ? " neg" : " pos"}`}>
        {fut ? "≈ " : grand >= 0 ? "+" : "−"}
        {eur(Math.abs(grand)).replace(/\s?€$/, "")}
        <span>€ {unite}</span>
      </p>
      <p className="bc-dit">
        {cur ? (
          <>
            Encore <b>{signe((m.prevu ?? 0) - (m.reel ?? 0))}</b> prévus d’ici la fin du mois : environ <b>{eur(m.prevu ?? 0)}</b> au total.
          </>
        ) : fut ? (
          "Ce qui devrait te rester ce mois-là."
        ) : (
          "Ce qui est rentré, moins ce qui est sorti."
        )}
      </p>
      <div className="bc-jauge" aria-hidden="true">
        <div className="bc-piste">
          {prevuBarre > 0 && <span className="bc-p bc-hachure" style={{ width: pct(prevuBarre) }} />}
          {reelBarre > 0 && <span className="bc-r" style={{ width: pct(reelBarre) }} />}
        </div>
        {t !== null && (
          <span className={`bc-mk${bord(t)}`} style={{ left: pct(t) }}>
            <span>objectif {eur(t)}</span>
          </span>
        )}
        {suivant && suivant.seuil > (t ?? 0) && (
          <span className={`bc-mk bc-next${bord(suivant.seuil)}`} style={{ left: pct(suivant.seuil) }}>
            <span>
              palier {(obj?.i ?? 0) + 2} · {eur(suivant.seuil)}
            </span>
          </span>
        )}
      </div>
      <div className="bc-leg">
        {reelBarre > 0 && (
          <span>
            <i className="bc-k-reel" />
            {cur ? "déjà là" : "réel"}
          </span>
        )}
        {prevuBarre > 0 && (
          <span>
            <i className="bc-k-prevu bc-hachure" />
            prévu
          </span>
        )}
      </div>
      {obj && t !== null && (
        <p className="bc-verdict">
          Objectif du mois : <b>{paliers[obj.i].nom}</b>
          {t > 0 ? `, ${eur(t)}.` : ", ne plus perdre d’argent."}{" "}
          {gagne ? (
            <span className="bc-ok">
              Dépassé de <b>{eur(val - t)}</b>
              {cur ? " (prévu)" : ""}.
            </span>
          ) : (
            <>
              Il manque <b>{eur(manque)}</b>.
            </>
          )}
          {gagne && suivant && val < suivant.seuil && (
            <>
              <br />
              Vers <b>{suivant.nom}</b> : {Math.max(0, Math.round((val / suivant.seuil) * 100))}&#8239;% du chemin.
            </>
          )}
        </p>
      )}
      {fut && besoin > 0 && plusP + besoin <= MAX_PENSIONS && (
        <button type="button" className="bc-cta" onClick={() => setPlusP(plusP + besoin)}>
          Et si tu prenais {besoin > 1 ? `${besoin} pensions` : "une pension"} de plus ?
        </button>
      )}
    </div>
  );
}

/* ---------- La frise des mois ---------- */
function Frise({ mois, paliers, sel, setSel }: { mois: MoisBilan[]; paliers: Palier[]; sel: number; setSel: (i: number) => void }) {
  const H = 140;
  const max = Math.max(1, ...mois.map((m) => Math.max(m.valeur ?? 0, objectifDuMois(paliers, m.periode)?.seuil ?? 0))) * 1.22;
  const aller = (i: number) => setSel(Math.max(0, Math.min(mois.length - 1, i)));
  return (
    <>
      <div className="bc-frise" role="group" aria-label="Les mois, à toucher">
        {mois.map((m, i) => {
          const o = objectifDuMois(paliers, m.periode);
          const v = m.valeur;
          const h = v === null ? 0 : Math.max(4, (Math.max(0, v) / max) * H);
          const tenu = v !== null && o !== null && objectifTenu(v, o.seuil);
          const cls = m.etat === "passe" ? "reel" : m.etat === "encours" ? "cur" : "prev bc-hachure";
          const r = m.etat === "encours" && v ? Math.max(0, Math.min(100, ((m.reel ?? 0) / v) * 100)) : 0;
          return (
            <button
              key={m.cle}
              type="button"
              aria-pressed={sel === i}
              aria-label={`${cap(nomMois(m.periode, true))}, ${v === null ? "rien de noté" : `${m.etat === "passe" ? "réel" : "prévu"} ${signe(v)}`}${o ? `, objectif ${eur(o.seuil)}` : ""}${tenu ? ", dépassé" : ""}`}
              onClick={() => setSel(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const n = sel + (e.key === "ArrowRight" ? 1 : -1);
                  aller(n);
                  (e.currentTarget.parentElement?.children[Math.max(0, Math.min(mois.length - 1, n))] as HTMLElement | undefined)?.focus();
                }
              }}
            >
              {v === null ? <span className="bc-col vide" /> : <span className={`bc-col ${cls}${v < 0 ? " neg" : ""}`} style={{ height: `${h.toFixed(1)}px`, ...(m.etat === "encours" ? ({ "--r": `${r.toFixed(1)}%` } as React.CSSProperties) : {}) }} />}
              {o && <span className="bc-but" style={{ bottom: `${(20 + (Math.max(0, o.seuil) / max) * H).toFixed(1)}px` }} />}
              {tenu && (
                <svg className="bc-pastille" viewBox="0 0 14 14" style={{ bottom: `${(24 + h).toFixed(1)}px` }} aria-hidden="true">
                  <circle cx="7" cy="7" r="6" />
                </svg>
              )}
              <span className="bc-lab">{initiale(m.periode)}</span>
            </button>
          );
        })}
      </div>
      <div className="bc-leg bc-leg-f">
        <span>
          <i className="bc-k-reel" />
          Réel
        </span>
        <span>
          <i className="bc-k-prevu bc-hachure" />
          Prévu
        </span>
        {paliers.length > 0 && (
          <>
            <span>
              <i className="bc-k-obj" />
              Objectif
            </span>
            <span>
              <svg className="bc-k-past" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6" />
              </svg>
              Dépassé
            </span>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Et si ---------- */
function Pas({ titre, aide, v, set, max, moins, plus }: { titre: string; aide: string; v: number; set: React.Dispatch<React.SetStateAction<number>>; max: number; moins: string; plus: string }) {
  return (
    <div className="bc-pas">
      <b>{titre}</b>
      <small>{aide}</small>
      <div className="bc-stepper">
        <button type="button" aria-label={moins} disabled={v <= 0} onClick={() => set((x) => Math.max(0, x - 1))}>
          −
        </button>
        <output aria-live="polite">{v}</output>
        <button type="button" aria-label={plus} disabled={v >= max} onClick={() => set((x) => Math.min(max, x + 1))}>
          +
        </button>
      </div>
    </div>
  );
}

function Effet({ base, mois, paliers, gain }: { base: MoisBilan[]; mois: MoisBilan[]; paliers: Palier[]; gain: number }) {
  const quand = (e: ReturnType<typeof etatPalier>) => (e.etat === "tenu" ? "tenu" : e.etat === "loin" ? "pas sur 12 mois" : nomMois({ year: Number(e.mois.slice(0, 4)), month: Number(e.mois.slice(5, 7)) }, true));
  const lignes = paliers
    .map((p, i) => ({ p, a: etatPalier(base, paliers, i), b: etatPalier(mois, paliers, i) }))
    .filter((x) => x.a.etat !== "tenu" && quand(x.a) !== quand(x.b))
    .map((x) => (
      <span key={x.p.nom}>
        <b>{x.p.nom}</b> : {quand(x.a)} → {quand(x.b)}.{" "}
      </span>
    ));
  if (!gain) {
    const prochain = paliers.map((p, i) => ({ p, e: etatPalier(base, paliers, i) })).find((x) => x.e.etat !== "tenu");
    return (
      <p className="bc-effet" aria-live="polite">
        {prochain ? (
          <>
            Au rythme prévu, <b>{prochain.p.nom}</b> {prochain.e.etat === "loin" ? "n’arrive pas dans les 12 mois." : `arrive en ${quand(prochain.e)}.`}
          </>
        ) : (
          "Touche + pour voir ce qu’un client de plus change."
        )}
      </p>
    );
  }
  return (
    <p className={`bc-effet${lignes.length ? " bon" : ""}`} aria-live="polite">
      <b>{signe(gain)}</b> par mois. {lignes.length ? lignes : "Les dates de tes paliers ne bougent pas encore."}
    </p>
  );
}

/* ---------- Les paliers ---------- */
function LignePalier({ p, i, mois }: { p: Palier; i: number; mois: MoisBilan[] }) {
  const paliers = useSettingsStore((s) => s.paliers);
  const e = etatPalier(mois, paliers, i);
  const enMots = (cle: string) => nomMois({ year: Number(cle.slice(0, 4)), month: Number(cle.slice(5, 7)) }, cle.slice(0, 4) !== String(currentPeriod().year));
  const cur = mois.find((m) => m.etat === "encours");
  const prog = p.seuil > 0 ? Math.max(0, Math.min(100, ((cur?.prevu ?? 0) / p.seuil) * 100)) : 100;
  let q: string;
  let tag: React.ReactNode;
  if (e.etat === "tenu") {
    q = `Tenu depuis ${enMots(e.depuis)}.`;
    tag = <span className="bc-tag ok">Tenu</span>;
  } else if (e.etat === "loin") {
    q = `${eur(p.seuil)} par mois. Au mieux ${eur(e.meilleur)} prévus : il manque ${eur(e.manque)}.`;
    tag = <span className="bc-tag loin">Pas sur 12 mois</span>;
  } else {
    q = `Prévu en ${enMots(e.mois)}, attendu en ${enMots(p.fin)}.`;
    tag = e.etat === "avance" ? <span className="bc-tag go">{e.ecart} mois d’avance</span> : e.etat === "heure" ? <span className="bc-tag go">À l’heure</span> : <span className="bc-tag tard">{e.ecart} mois de retard</span>;
  }
  return (
    <li className="bc-palier">
      <span className={`bc-num${e.etat === "tenu" ? " ok" : ""}`}>{e.etat === "tenu" ? "✓" : i + 1}</span>
      <div>
        <b>{p.nom}</b>
        <span className="bc-q">{q}</span>
      </div>
      {tag}
      {e.etat !== "tenu" && (
        <>
          <div className="bc-barre" aria-hidden="true">
            <span style={{ width: `${prog.toFixed(1)}%` }} />
          </div>
          <span className="bc-pc">{cap(nomMois(currentPeriod()))} en est à {Math.round(prog)}&#8239;%</span>
        </>
      )}
    </li>
  );
}

/* ---------- Prestations ---------- */
function Prestations({ periode, iPalier, palier, now, objectifs }: { periode: Period; iPalier: number; palier: Palier; now: Period; objectifs: ReturnType<typeof useSettingsStore.getState>["objectifsPrestations"] }) {
  const data = useDataStore();
  const lignes = useMemo(() => lignesAMontrer(lignesPrestations(data), objectifs), [data, objectifs]);
  // Le réel du mois choisi s'il est passé ou en cours ; pour un mois à venir, ce que tu as aujourd'hui.
  const quand = cleMois(periode) <= cleMois(now) ? periode : now;
  const fait = useMemo(() => realisePrestations(data, quand), [data, quand]);
  const suivies = lignes.filter((l) => objectifDe(objectifs, l.cle, iPalier) > 0);
  if (!suivies.length) return null;
  return (
    <>
      <h3 className="bc-h">Prestation par prestation</h3>
      <p className="bc-sub">
        Pour le palier {iPalier + 1}, {palier.nom}
        {cleMois(periode) > cleMois(now) ? " : ce que tu as aujourd’hui." : `, en ${nomMois(periode)}.`}
      </p>
      <ul className="bc-prest">
        {suivies.map((l) => {
          const o = objectifDe(objectifs, l.cle, iPalier);
          const r = fait[l.cle]?.nombre ?? 0;
          const ok = r >= o;
          return (
            <li key={l.cle}>
              <b>{l.nom}</b>
              <span className={`bc-v${ok ? " ok" : ""}`}>
                {r} sur {o}
              </span>
              <div className="bc-barre" aria-hidden="true">
                <span className={ok ? "ok" : ""} style={{ width: `${Math.min(100, (r / Math.max(1, o)) * 100).toFixed(1)}%` }} />
              </div>
              <span className="bc-w">{ok ? (r > o ? `Objectif dépassé de ${r - o}` : "Objectif tenu") : `Encore ${o - r} pour l’objectif`}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

