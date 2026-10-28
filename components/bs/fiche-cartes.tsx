"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Ic } from "@/components/carnet/ui";
import type {
  Choix,
  CoursFiche,
  Fiche,
  Formule,
  StageFiche,
} from "@/lib/account/api";
import "@/app/carnet/fiche-cartes.css";

/**
 * Le formulaire de la fiche en grandes cartes (29 octobre 2026), comme le
 * formulaire de demande de bestable.fr : une carte par choix, sur toute la
 * largeur, avec son nom en gras et une ligne d'explication.
 */

/** Une carte à cocher (plusieurs choix possibles). */
export function CarteCoche({
  on,
  onClick,
  t,
  s,
}: {
  on: boolean;
  onClick: () => void;
  t: string;
  s?: string;
}) {
  return (
    <button
      type="button"
      className="fc-carte"
      aria-pressed={on}
      onClick={onClick}
    >
      <span className="fc-case">
        <Ic n="ck" className="" />
      </span>
      <span>
        <b>{t}</b>
        {s && <small>{s}</small>}
      </span>
    </button>
  );
}

/** Une carte à rond (un seul choix possible), qui peut s'ouvrir sur un réglage. */
function CarteRond({
  on,
  onClick,
  t,
  s,
  children,
}: {
  on: boolean;
  onClick: () => void;
  t: string;
  s?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`fc-carte${children ? " avec" : ""}`}
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) =>
        (e.key === " " || e.key === "Enter") &&
        e.target === e.currentTarget &&
        (e.preventDefault(), onClick())
      }
    >
      <span className="fc-rond" />
      <span>
        <b>{t}</b>
        {s && <small>{s}</small>}
      </span>
      {on && children}
    </div>
  );
}

/** Les places libres : des places (avec le compteur), complet, ou rien de dit. */
export function Places({
  v,
  onChange,
}: {
  v: string;
  onChange: (v: string) => void;
}) {
  const n = Number(v || 0);
  const libres = v !== "" && v !== "0";
  return (
    <div
      className="fc-cartes"
      role="radiogroup"
      aria-label="Places libres en pension"
    >
      <CarteRond
        on={libres}
        onClick={() => !libres && onChange("1")}
        t="J’ai des places libres"
        s="Dis combien, la fiche l’affiche"
      >
        <div
          className="fc-compteur"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Une place de moins"
            onClick={() => onChange(String(Math.max(0, n - 1)))}
          >
            −
          </button>
          <span>
            <input
              inputMode="numeric"
              aria-label="Places libres"
              value={v}
              onChange={(e) =>
                onChange(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
            />
            {n > 1 ? "places libres" : "place libre"}
          </span>
          <button
            type="button"
            aria-label="Une place de plus"
            onClick={() => onChange(String(n + 1))}
          >
            +
          </button>
        </div>
      </CarteRond>
      <CarteRond
        on={v === "0"}
        onClick={() => onChange("0")}
        t="Complet"
        s="Plus de place pour l’instant"
      />
      <CarteRond
        on={v === ""}
        onClick={() => onChange("")}
        t="Je préfère ne pas le dire"
        s="La fiche n’affiche rien sur les places"
      />
    </div>
  );
}

/** Des boutons côte à côte, un seul choisi (le type d'une formule, l'unité d'un cours, les vacances d'un stage). */
function Seg({
  label,
  options,
  value,
  onChange,
  vide,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
  vide?: boolean;
}) {
  return (
    <div className="fc-seg" role="radiogroup" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(vide && value === k ? "" : k)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Case({
  label,
  unit,
  value,
  onChange,
  numeric,
  placeholder,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="fc-champ">
      <span>{label}</span>
      <span className="fc-boite">
        <input
          inputMode={numeric ? "numeric" : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) =>
            onChange(
              numeric
                ? e.target.value.replace(/\D/g, "").slice(0, 5)
                : e.target.value,
            )
          }
        />
        {unit && <span className="u">{unit}</span>}
      </span>
    </label>
  );
}

type Sorte = "pension" | "cours" | "stage";

/** L'ordre des unités de cours, de la plus courte à la plus longue. */
const ORDRE_UNITES = ["seance", "carte", "mois", "trimestre", "an"];
const maj = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Les formules : chacune dit si c'est une pension, un cours ou un stage.
 * Le site les range dans trois listes (formules, cours, stages, pc-bestable 1.9.0) :
 * changer le type d'une formule la fait passer d'une liste à l'autre.
 * Sans cours ni stages côté site, seules les pensions sont proposées.
 */
export function Offres({
  f,
  set,
}: {
  f: Fiche;
  set: (p: Partial<Fiche>) => void;
}) {
  const avecTypes = Array.isArray(f.cours) && Array.isArray(f.stages);
  // Une formule qui change de type (ou qui arrive) peut changer de place : on la garde sous les yeux.
  const suivre = useRef<string | null>(null);
  useEffect(() => {
    if (!suivre.current) return;
    document.querySelector(`[data-k="${suivre.current}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    suivre.current = null;
  });
  const setSuivre = (k: string) => {
    suivre.current = k;
  };
  const cours = f.cours ?? [];
  const stages = f.stages ?? [];
  const unites = f.choix_cours?.unites ?? {
    seance: "séance",
    carte: "carte",
    mois: "mois",
    trimestre: "trimestre",
    an: "an",
  };
  const vacances = f.choix_cours?.vacances ?? {
    toussaint: "Toussaint",
    noel: "Noël",
    hiver: "Hiver",
    printemps: "Printemps",
    ete: "Été",
  };
  const optUnites = [
    ...ORDRE_UNITES.filter((k) => k in unites),
    ...Object.keys(unites).filter((k) => !ORDRE_UNITES.includes(k)),
  ].map((k) => [k, maj(unites[k])] as [string, string]);
  const items: { sorte: Sorte; i: number }[] = [
    ...f.formules.map((_, i) => ({ sorte: "pension" as const, i })),
    ...cours.map((_, i) => ({ sorte: "cours" as const, i })),
    ...stages.map((_, i) => ({ sorte: "stage" as const, i })),
  ];

  const lire = (x: { sorte: Sorte; i: number }) =>
    x.sorte === "pension"
      ? f.formules[x.i]
      : x.sorte === "cours"
        ? cours[x.i]
        : stages[x.i];
  const majFormule = (i: number, p: Partial<Formule>) =>
    set({ formules: f.formules.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const majCours = (i: number, p: Partial<CoursFiche>) =>
    set({ cours: cours.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const majStage = (i: number, p: Partial<StageFiche>) =>
    set({ stages: stages.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const retirer = (x: { sorte: Sorte; i: number }) =>
    set(
      x.sorte === "pension"
        ? { formules: f.formules.filter((_, j) => j !== x.i) }
        : x.sorte === "cours"
          ? { cours: cours.filter((_, j) => j !== x.i) }
          : { stages: stages.filter((_, j) => j !== x.i) },
    );
  /** Changer le type : la formule quitte sa liste et rejoint l'autre, avec son nom, sa description et son prix. */
  const changer = (x: { sorte: Sorte; i: number }, vers: Sorte) => {
    if (vers === x.sorte) return;
    const o = lire(x);
    const garde = { nom: o.nom, description: o.description, prix: o.prix };
    const p: Partial<Fiche> =
      x.sorte === "pension"
        ? { formules: f.formules.filter((_, j) => j !== x.i) }
        : x.sorte === "cours"
          ? { cours: cours.filter((_, j) => j !== x.i) }
          : { stages: stages.filter((_, j) => j !== x.i) };
    if (vers === "pension")
      p.formules = [...(p.formules ?? f.formules), { ...garde, places: "" }];
    if (vers === "cours")
      p.cours = [...(p.cours ?? cours), { ...garde, unite: "" }];
    if (vers === "stage")
      p.stages = [
        ...(p.stages ?? stages),
        { ...garde, vacances: "", places: "" },
      ];
    const n = (vers === "pension" ? p.formules : vers === "cours" ? p.cours : p.stages)!.length - 1;
    set(p);
    setSuivre(`${vers}-${n}`);
  };

  return (
    <>
      {items.map((x, n) => {
        const o = lire(x);
        const unite =
          x.sorte === "cours"
            ? cours[x.i].unite
              ? unites[cours[x.i].unite]
              : ""
            : "";
        return (
          <div key={`${x.sorte}-${x.i}`} data-k={`${x.sorte}-${x.i}`} className="fc-formule">
            <div className="fc-formule-h">
              <b>Formule {n + 1}</b>
              <button
                type="button"
                className="fc-retirer"
                onClick={() => retirer(x)}
              >
                Retirer
              </button>
            </div>
            {avecTypes && (
              <div className="fc-champ">
                <span>C’est</span>
                <Seg
                  label="Type de formule"
                  options={[
                    ["pension", "Pension"],
                    ["cours", "Cours"],
                    ["stage", "Stage"],
                  ]}
                  value={x.sorte}
                  onChange={(v) => changer(x, v as Sorte)}
                />
              </div>
            )}
            <Case
              label="Nom"
              value={o.nom}
              placeholder={
                x.sorte === "pension"
                  ? "Ex. : Box + paddock"
                  : x.sorte === "cours"
                    ? "Ex. : Cours collectif"
                    : "Ex. : Stage poney"
              }
              onChange={(v) =>
                x.sorte === "pension"
                  ? majFormule(x.i, { nom: v })
                  : x.sorte === "cours"
                    ? majCours(x.i, { nom: v })
                    : majStage(x.i, { nom: v })
              }
            />
            {x.sorte === "cours" && (
              <div className="fc-champ">
                <span>Le prix est pour</span>
                <Seg
                  label="Unité du prix"
                  options={optUnites}
                  value={cours[x.i].unite}
                  onChange={(v) => majCours(x.i, { unite: v })}
                />
              </div>
            )}
            {x.sorte === "stage" && (
              <div className="fc-champ">
                <span>
                  Pendant les vacances <em>facultatif</em>
                </span>
                <Seg
                  label="Vacances du stage"
                  options={Object.entries(vacances)}
                  value={stages[x.i].vacances}
                  onChange={(v) => majStage(x.i, { vacances: v })}
                  vide
                />
              </div>
            )}
            <Case
              label="Prix"
              numeric
              value={o.prix}
              unit={
                x.sorte === "pension"
                  ? "€ / mois"
                  : x.sorte === "stage"
                    ? "€ / stage"
                    : unite
                      ? `€ / ${unite}`
                      : "€"
              }
              onChange={(v) =>
                x.sorte === "pension"
                  ? majFormule(x.i, { prix: v })
                  : x.sorte === "cours"
                    ? majCours(x.i, { prix: v })
                    : majStage(x.i, { prix: v })
              }
            />
          </div>
        );
      })}
      <button
        type="button"
        className="fc-ajout"
        onClick={() => {
          set({
            formules: [
              ...f.formules,
              { nom: "", description: "", prix: "", places: "" },
            ],
          });
          setSuivre(`pension-${f.formules.length}`);
        }}
      >
        <Ic n="plus" className="" />
        <span>
          <b>Ajouter une formule</b>
          <small>
            {avecTypes
              ? "Une pension, un cours ou un stage, avec son prix"
              : "Box, pré, demi-pension… avec son prix"}
          </small>
        </span>
      </button>
    </>
  );
}

/** Une ligne d'explication sous les choix qui en ont besoin (par leur nom, celui du site). */
const SOUS: Record<string, string> = {
  Pension: "Des chevaux de propriétaires chez toi",
  Cours: "À l’année ou un cours d’essai",
  Stages: "Pendant les vacances scolaires",
  "Demi-pension": "Un cavalier monte un cheval de l’écurie",
  Box: "Le cheval vit au box",
  "Pré + box": "Au pré le jour, au box la nuit",
  "Pré intégral": "Dehors toute l’année, avec un abri",
  Stabulation: "Un abri ouvert, en troupeau",
  "Écurie active": "En troupeau, foin et eau en libre-service",
};

const GROUPES = [
  ["offres", "Activités", true],
  ["hebergement", "Hébergement", true],
  ["installations", "Installations", false],
  ["services", "Services compris ou proposés", false],
] as const;

/** « Ce que tu proposes » : quatre groupes de cartes à cocher. */
export function Coches({
  choix,
  f,
  toggle,
}: {
  choix: Choix;
  f: Fiche;
  toggle: (k: (typeof GROUPES)[number][0], v: string) => void;
}) {
  return (
    <>
      {GROUPES.map(([k, l, large], gi) => {
        const n = Object.keys(choix[k]).filter((v) => f[k].includes(v)).length;
        return (
          <div
            key={k}
            className={`fc-grp${gi === 0 ? " premier" : ""}`}
            role="group"
            aria-label={l}
          >
            <div className="fc-grp-h">
              <h3>{l}</h3>
              <span className={n ? "on" : undefined}>
                {n ? `${n} coché${n > 1 ? "s" : ""}` : "Rien de coché"}
              </span>
            </div>
            <div className={`fc-cartes${large ? "" : " deux"}`}>
              {Object.entries(choix[k]).map(([v, lab]) => (
                <CarteCoche
                  key={v}
                  on={f[k].includes(v)}
                  onClick={() => toggle(k, v)}
                  t={lab}
                  s={large ? SOUS[lab] : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Un groupe titré à l'intérieur d'une partie (« Places libres en pension », « Tes formules »…). */
export function Groupe({
  titre,
  meta,
  premier,
  children,
}: {
  titre: string;
  meta?: ReactNode;
  premier?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`fc-grp${premier ? " premier" : ""}`}>
      <div className="fc-grp-h">
        <h3>{titre}</h3>
        {meta && <span>{meta}</span>}
      </div>
      {children}
    </div>
  );
}
