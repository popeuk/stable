"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { cap } from "@/components/bs/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { Hello, Ic, Page, eur, sg } from "@/components/carnet/ui";
import { CLOS } from "@/lib/fonctions";
import { monthBreakdown } from "@/lib/domain/ticket";
import { lignesAMontrer, lignesPrestations, objectifDe, realisePrestations, type LignePrestation, type ObjectifsPrestations } from "@/lib/domain/objectifs-prestations";
import { cleMois, manquePour, moisDuSuivi, palierAtteint, palierVise, paliersValables, paliersVides, type Palier } from "@/lib/domain/paliers";
import { currentPeriod, samePeriod } from "@/lib/utils/period";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePeriodStore } from "@/stores/period-store";
import type { Period } from "@/lib/domain/types";

/**
 * Les paliers du Clos (version interne seulement, lib/fonctions.ts CLOS).
 * Le résultat de chaque mois, celui de Mon bilan, comparé aux quatre paliers :
 * le verdict en tête, puis l'échelle, les pensions, et les quatorze mois.
 */
export default function Page_() {
  return (
    <ClientGate>
      <Paliers />
    </ClientGate>
  );
}

const nomMois = (p: Period, annee = true) =>
  new Date(p.year, p.month - 1, 1).toLocaleDateString("fr-FR", { month: "long", ...(annee ? { year: "numeric" } : {}) });
/** « 1 cheval », « 3 chevaux », « 1 place », « 2 places ». */
const uniteAccordee = (unite: string, n: number) => (n > 1 ? unite : unite === "chevaux" ? "cheval" : unite === "places" ? "place" : unite);
const finEnMots = (fin: string) => nomMois({ year: Number(fin.slice(0, 4)), month: Number(fin.slice(5, 7)) });

function Paliers() {
  const router = useRouter();
  const desk = useDesk();
  const data = useDataStore();
  const paliers = useSettingsStore((s) => s.paliers);
  const active = usePeriodStore((s) => s.active);
  const setActive = usePeriodStore((s) => s.setActive);
  const [edition, setEdition] = useState(false);
  const [editionObjectifs, setEditionObjectifs] = useState(false);
  const objectifs = useSettingsStore((s) => s.objectifsPrestations);
  const lignes = useMemo(() => lignesAMontrer(lignesPrestations(data), objectifs), [data, objectifs]);

  const mois = useMemo(() => moisDuSuivi(paliers), [paliers]);
  const maintenant = currentPeriod();
  // Les mois montrés s'arrêtent au mois en cours : le futur n'a pas encore de résultat.
  const ouverts = mois.filter((p) => cleMois(p) <= cleMois(maintenant));
  const ici = ouverts.find((p) => samePeriod(p, active)) ?? ouverts[ouverts.length - 1] ?? mois[0];
  const pos = ouverts.findIndex((p) => samePeriod(p, ici));

  const serie = useMemo(
    () =>
      mois.map((p) => {
        const m = monthBreakdown(data, p);
        return { p, net: Math.round(m.net), pensions: m.pensions, vise: palierVise(paliers, p), futur: cleMois(p) > cleMois(maintenant), vide: m.revenue === 0 && m.direct === 0 && m.sharedTotal === 0 && m.outside === 0 };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, paliers, mois],
  );

  if (!CLOS) {
    return (
      <Page>
        <Hello title="Cette page n’existe pas ici." sub="Les paliers sont propres à la version du Clos de la Motte." />
        <div className="pad" style={{ marginTop: 16 }}>
          <Link href="/argent" className="btn line full">Revenir à Mon bilan</Link>
        </div>
      </Page>
    );
  }

  // Rien de posé : on propose de poser les paliers, une fois pour toutes.
  if (!paliers.length) {
    return (
      <Page>
        <h1 className="ar-sr">Les paliers</h1>
        <Hello title="Pose tes paliers." sub="Pour chacun : son nom, son dernier mois, le résultat à atteindre chaque mois et les pensions visées. Tu le fais une fois : l’app compare ensuite chaque mois tout seul." />
        <div className="pad rise" style={{ animationDelay: ".1s", marginTop: 16 }}>
          <Edition paliers={paliersVides()} fermer={() => router.push("/paliers")} />
        </div>
        <div className="end" />
      </Page>
    );
  }

  const cur = serie.find((x) => samePeriod(x.p, ici)) ?? serie[0];
  const iv = cur?.vise ?? 0;
  const vise = paliers[iv];
  const atteint = cur ? palierAtteint(paliers, cur.net) : -1;
  const suivant = paliers[atteint + 1];
  const enCours = samePeriod(ici, maintenant);
  const M = cap(nomMois(ici));

  let titre: React.ReactNode;
  let sous: React.ReactNode;
  if (!cur || cur.vide) {
    titre = `Rien n’est encore noté pour ${nomMois(ici, false)}.`;
    sous = "Note ce qui rentre et ce qui sort dans Mon bilan : le palier se calcule tout seul.";
  } else if (atteint >= iv) {
    titre = `${M}, palier ${iv + 1} tenu.`;
    sous = `${enCours ? "Pour l’instant, il te reste" : "Il t’est resté"} ${eur(cur.net)}.${suivant ? ` Pour le palier ${atteint + 2}, « ${suivant.nom} », il manque ${eur(manquePour(paliers, atteint + 1, cur.net))} par mois.` : " Les quatre paliers sont franchis."}`;
  } else {
    titre = `Il manque ${eur(manquePour(paliers, iv, cur.net))} pour le palier ${iv + 1}.`;
    sous = `${enCours ? "Pour l’instant, " : `En ${nomMois(ici, false)}, `}le résultat est de ${sg(cur.net)}. Le palier ${iv + 1}, « ${vise?.nom} », demande ${eur(vise?.seuil ?? 0)} par mois jusqu’à ${finEnMots(vise?.fin ?? "")}.`;
  }

  const fait = realisePrestations(data, ici);
  const suivies = lignes.filter((l) => objectifDe(objectifs, l.cle, iv) > 0 || (fait[l.cle]?.nombre ?? 0) > 0);

  // Les quatorze mois : une échelle commune, zéro compris.
  const valeurs = serie.filter((x) => !x.futur).map((x) => x.net);
  const haut = Math.max(1, ...paliers.map((x) => x.seuil), ...valeurs);
  const bas = Math.min(0, ...valeurs);
  const enPct = (v: number) => ((v - bas) / (haut - bas)) * 100;

  return (
    <Page wide={desk}>
      <h1 className="ar-sr">Les paliers du Clos</h1>
      <div className="ar-mnav">
        <button type="button" onClick={() => pos > 0 && setActive(ouverts[pos - 1])} aria-label="Mois précédent" disabled={pos <= 0}>
          <Ic n="chevL" className="ar-ic" />
        </button>
        <b>{cap(nomMois(ici, !enCours))}</b>
        <button type="button" onClick={() => pos < ouverts.length - 1 && setActive(ouverts[pos + 1])} aria-label="Mois suivant" disabled={pos >= ouverts.length - 1}>
          <Ic n="chev" className="ar-ic" />
        </button>
      </div>
      <Hello title={titre} sub={sous} />

      <div className="card pl-carte rise" style={{ animationDelay: ".1s" }}>
        <p className="k">Les {paliers.length} paliers</p>
        <ol className="pl-liste">
          {paliers.map((x, i) => {
            const fait = i <= atteint;
            const pct = x.seuil > 0 ? Math.max(0, Math.min(100, ((cur?.net ?? 0) / x.seuil) * 100)) : cur && cur.net >= 0 ? 100 : 0;
            return (
              <li key={x.nom + i} className={`pl-palier${i === iv ? " vise" : ""}${fait ? " fait" : ""}`}>
                <div className="pl-tete">
                  <b>
                    {i + 1}. {x.nom}
                  </b>
                  <span className="pl-etat">{fait ? "Atteint" : i === iv ? "Visé ce mois-ci" : ""}</span>
                </div>
                <p className="pl-quoi">
                  {x.seuil > 0 ? `${eur(x.seuil)} par mois` : "Ne plus perdre d’argent"} · jusqu’à {finEnMots(x.fin)} · {x.pensions} pensions
                </p>
                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="card pl-carte rise" style={{ animationDelay: ".16s" }}>
        <p className="k">Pensions payantes</p>
        <p className="pl-gros">
          {cur?.pensions ?? 0} <small>sur {vise?.pensions ?? 0} visées</small>
        </p>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, ((cur?.pensions ?? 0) / Math.max(1, vise?.pensions ?? 1)) * 100)}%` }} />
        </div>
        <p className="note">Les chevaux en pension ce mois-là, sans les tiens.</p>
      </div>

      <div className="card pl-carte rise" style={{ animationDelay: ".19s" }}>
        <p className="k">Prestation par prestation · palier {iv + 1}</p>
        {suivies.length === 0 ? (
          <p className="note pl-vide">Aucun objectif par prestation pour l’instant. Fixe-les plus bas : pour chaque palier, combien de pensions de chaque formule, de cours, de demi-pensions, de stages…</p>
        ) : (
          <ul className="pl-prest">
            {suivies.map((l) => {
              const obj = objectifDe(objectifs, l.cle, iv);
              const r = fait[l.cle] ?? { nombre: 0, montant: 0 };
              const echelle = Math.max(obj, r.nombre, 1);
              const tenu = r.nombre >= obj;
              return (
                <li key={l.cle} className={`pl-ligne${tenu ? "" : " manque"}`}>
                  <div className="pl-tete">
                    <b>{l.nom}</b>
                    <span className="pl-chiffre">
                      {r.nombre} <small>{obj > 0 ? `sur ${obj}` : uniteAccordee(l.unite, r.nombre)}</small>
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${(r.nombre / echelle) * 100}%` }} />
                    {obj > 0 && <b className="pl-obj" style={{ left: `${(obj / echelle) * 100}%` }} />}
                  </div>
                  <p className="pl-quoi">
                    {obj === 0 ? "Pas d’objectif à ce palier" : tenu ? "Objectif tenu" : `Il en manque ${obj - r.nombre}`}
                    {r.montant > 0 ? ` · ${eur(r.montant)} ce mois-ci` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="note">Pensions : les chevaux du mois par formule. Cours : les places de cavalier des séances. Autres : chaque recette notée.</p>
      </div>

      <div className="card pl-carte rise" style={{ animationDelay: ".22s" }}>
        <p className="k">Le résultat, mois par mois</p>
        <div className="pl-graphe" role="list" aria-label="Résultat de chaque mois et palier visé">
          {serie.map((x) => {
            const seuil = paliers[x.vise]?.seuil ?? 0;
            const choisi = samePeriod(x.p, ici);
            const haut0 = enPct(Math.max(0, x.net));
            const bas0 = enPct(Math.min(0, x.net));
            return (
              <button
                key={cleMois(x.p)}
                type="button"
                role="listitem"
                className={`pl-col${choisi ? " choisi" : ""}${x.futur ? " futur" : ""}${x.net < 0 ? " neg" : ""}`}
                disabled={x.futur}
                onClick={() => setActive(x.p)}
                aria-label={`${cap(nomMois(x.p))} : ${x.futur ? "à venir" : sg(x.net)}, palier visé ${eur(seuil)}`}
              >
                {!x.futur && <i className="pl-baton" style={{ bottom: `${bas0}%`, height: `${Math.max(0.8, haut0 - bas0)}%` }} />}
                <span className="pl-seuil" style={{ bottom: `${enPct(seuil)}%` }} />
              </button>
            );
          })}
          <span className="pl-zero" style={{ bottom: `${enPct(0)}%` }} aria-hidden="true" />
        </div>
        <div className="pl-axe" aria-hidden="true">
          {serie.map((x) => (
            <span key={cleMois(x.p)} className={samePeriod(x.p, ici) ? "choisi" : ""}>
              {nomMois(x.p, false).charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
        <p className="note">Bâton : ce qui t’est resté. Trait : le palier visé ce mois-là. Les mois à venir restent vides.</p>
      </div>

      <details className="ar-how rise" style={{ animationDelay: ".28s" }}>
        <summary>
          Comment on compte ?
          <Ic n="chev" className="ar-ic" />
        </summary>
        <p className="ar-calc">
          Le résultat du mois, c’est celui de Mon bilan : tout ce qui rentre, moins tout ce qui sort. Chaque palier fixe ce résultat à atteindre jusqu’à son dernier mois. Pense à poser les montants comme tu notes tes dépenses : si le remboursement des crédits ou ce que se versent les associés n’y sont pas, les paliers doivent les inclure.
        </p>
      </details>

      <div className="pad rise" style={{ animationDelay: ".32s", marginTop: 16 }}>
        {editionObjectifs ? (
          <EditionObjectifs paliers={paliers} lignes={lignes} objectifs={objectifs} fermer={() => setEditionObjectifs(false)} />
        ) : (
          <button type="button" className="btn line full" onClick={() => setEditionObjectifs(true)}>
            Fixer les objectifs par prestation
          </button>
        )}
        {edition ? (
          <Edition paliers={paliers} fermer={() => setEdition(false)} />
        ) : (
          <button type="button" className="btn line full" style={{ marginTop: 10 }} onClick={() => setEdition(true)}>
            Changer les paliers
          </button>
        )}
        <button type="button" className="btn full" style={{ marginTop: 10 }} onClick={() => router.push("/argent")}>
          Voir Mon bilan
        </button>
      </div>
      <div className="end" />
    </Page>
  );
}

function Edition({ paliers, fermer }: { paliers: Palier[]; fermer: () => void }) {
  const setPaliers = useSettingsStore((s) => s.setPaliers);
  const [brouillon, setBrouillon] = useState<Palier[]>(() => paliers.map((x) => ({ ...x })));
  const [erreur, setErreur] = useState("");
  const maj = (i: number, k: keyof Palier, v: string) =>
    setBrouillon((b) => b.map((x, j) => (j !== i ? x : { ...x, [k]: k === "nom" || k === "fin" ? v : Number(v.replace(",", ".").replace(/\s/g, "")) })));
  return (
    <form
      className="card pl-edition"
      onSubmit={(e) => {
        e.preventDefault();
        if (!paliersValables(brouillon)) {
          setErreur("Chaque palier a besoin d’un nom, d’un dernier mois (dans l’ordre), d’un montant et d’un nombre de pensions.");
          return;
        }
        setPaliers(brouillon);
        fermer();
      }}
    >
      <p className="k">Les paliers</p>
      {brouillon.map((x, i) => (
        <fieldset key={i} className="pl-champs">
          <legend>Palier {i + 1}</legend>
          <label className="field">
            <span>Nom</span>
            <span className="input">
              <input value={x.nom} onChange={(e) => maj(i, "nom", e.target.value)} maxLength={60} />
            </span>
          </label>
          <label className="field">
            <span>Dernier mois</span>
            <span className="input">
              <input type="month" value={x.fin} onChange={(e) => maj(i, "fin", e.target.value)} />
            </span>
          </label>
          <label className="field">
            <span>Résultat visé par mois</span>
            <span className="input">
              <input inputMode="decimal" value={String(x.seuil)} onChange={(e) => maj(i, "seuil", e.target.value)} />
              <span className="u">€</span>
            </span>
          </label>
          <label className="field">
            <span>Pensions visées</span>
            <span className="input">
              <input inputMode="numeric" value={String(x.pensions)} onChange={(e) => maj(i, "pensions", e.target.value)} />
            </span>
          </label>
        </fieldset>
      ))}
      {erreur && (
        <p className="note pl-erreur" role="alert">
          {erreur}
        </p>
      )}
      <button type="submit" className="btn full">
        Enregistrer les paliers
      </button>
      <button type="button" className="btn line full" style={{ marginTop: 8 }} onClick={fermer}>
        Annuler
      </button>
    </form>
  );
}

function EditionObjectifs({ paliers, lignes, objectifs, fermer }: { paliers: Palier[]; lignes: LignePrestation[]; objectifs: ObjectifsPrestations; fermer: () => void }) {
  const setObjectifs = useSettingsStore((s) => s.setObjectifsPrestations);
  const [brouillon, setBrouillon] = useState<ObjectifsPrestations>(() =>
    Object.fromEntries(lignes.map((l) => [l.cle, paliers.map((_, i) => objectifDe(objectifs, l.cle, i))])),
  );
  const maj = (cle: string, i: number, v: string) =>
    setBrouillon((b) => ({ ...b, [cle]: paliers.map((_, j) => (j === i ? Math.max(0, Math.round(Number(v.replace(",", ".")) || 0)) : (b[cle]?.[j] ?? 0))) }));
  const groupes: [string, LignePrestation[]][] = [
    ["Pensions (chevaux)", lignes.filter((l) => l.groupe === "pension")],
    ["Cours et séances (places)", lignes.filter((l) => l.groupe === "seance")],
    ["Autres recettes (fois)", lignes.filter((l) => l.groupe === "recette")],
  ];
  return (
    <form
      className="card pl-edition"
      onSubmit={(e) => {
        e.preventDefault();
        // On garde aussi les objectifs des prestations qui ne sont pas montrées ici.
        setObjectifs({ ...objectifs, ...brouillon });
        fermer();
      }}
    >
      <p className="k">Objectifs par prestation, chaque mois</p>
      {lignes.length === 0 && <p className="note">Aucune prestation encore : ajoute tes chevaux, tes cours ou tes recettes dans Mon argent, elles apparaîtront ici.</p>}
      <div className="pl-defile">
        <table className="pl-table">
          <thead>
            <tr>
              <th scope="col">Prestation</th>
              {paliers.map((x, i) => (
                <th key={i} scope="col" title={x.nom}>
                  P{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          {groupes
            .filter(([, ls]) => ls.length)
            .map(([titre, ls]) => (
              <tbody key={titre}>
                <tr className="pl-groupe">
                  <th colSpan={paliers.length + 1} scope="colgroup">
                    {titre}
                  </th>
                </tr>
                {ls.map((l) => (
                  <tr key={l.cle}>
                    <th scope="row">{l.nom}</th>
                    {paliers.map((_, i) => (
                      <td key={i}>
                        <input
                          inputMode="numeric"
                          aria-label={`${l.nom}, palier ${i + 1}`}
                          value={String(brouillon[l.cle]?.[i] ?? 0)}
                          onChange={(e) => maj(l.cle, i, e.target.value)}
                          onFocus={(e) => e.target.select()}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
        </table>
      </div>
      <p className="note">Le nombre visé chaque mois pendant le palier. 0 : pas d’objectif.</p>
      <button type="submit" className="btn full">
        Enregistrer les objectifs
      </button>
      <button type="button" className="btn line full" style={{ marginTop: 8 }} onClick={fermer}>
        Annuler
      </button>
    </form>
  );
}
