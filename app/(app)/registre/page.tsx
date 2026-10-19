"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Hello, Ic, Page as Ecran, Sec, Seg } from "@/components/carnet/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { PageImprimee, useTitreDocument } from "@/components/bs/impression";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { CARE_META } from "@/lib/domain/care";
import {
  GAP_LABEL,
  HOLDING_GAP_LABEL,
  SEX_LABEL,
  birthLabel,
  buildRegister,
  currentQuarter,
  holdingGaps,
  denomination,
  detenteurDe,
  horseGaps,
  type HorseGap,
  ownerLine,
  type Detenteur,
  registerPeriod,
  type Holding,
  type PeriodKind,
  type Register,
} from "@/lib/domain/registre";
import type { Horse } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";
import { siretDit } from "@/lib/domain/facture";
import "@/app/carnet/registre.css";

/**
 * Le registre d'élevage, prêt à imprimer : le détenteur et le lieu, les
 * équidés présents, leurs mouvements et leurs soins sur la période, selon
 * les rubriques du modèle de l'IFCE. Rien à ressaisir : tout vient des
 * fiches, des réglages et du carnet. Ce qui manque est dit à l'écran,
 * jamais sur la feuille.
 */
/** Les rubriques à compléter, dans l'ordre du registre, dites en une phrase. */
const RUBRIQUES: HorseGap[] = ["sire", "puce", "proprietaire", "provenance", "destination"];
const RUBRIQUE_DIT: Record<HorseGap, string> = {
  sire: "numéro SIRE",
  puce: "numéro de puce",
  proprietaire: "propriétaire noté",
  provenance: "provenance",
  destination: "destination de départ",
};
/** « sans numéro SIRE, numéro de puce ni provenance ». */
const direManque = (ks: HorseGap[]) => {
  const m = ks.map((k) => RUBRIQUE_DIT[k]);
  return `sans ${m.length > 1 ? `${m.slice(0, -1).join(", ")} ni ${m[m.length - 1]}` : m[0]}`;
};
/** Les rubriques qui manquent aux mêmes chevaux se disent ensemble, en une ligne. */
function groupesManquants(list: { h: Horse; g: HorseGap[] }[]) {
  const out: { ks: HorseGap[]; qui: Horse[] }[] = [];
  for (const k of RUBRIQUES) {
    const qui = list.filter((x) => x.g.includes(k)).map((x) => x.h);
    if (!qui.length) continue;
    const meme = out.find((o) => o.qui.length === qui.length && o.qui.every((h, i) => h.id === qui[i].id));
    if (meme) meme.ks.push(k);
    else out.push({ ks: [k], qui });
  }
  return out;
}

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Registre />
      </Suspense>
    </ClientGate>
  );
}

const dmy = (d?: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR") : "");

function Registre() {
  const cheval = useSearchParams().get("cheval");
  const desk = useDesk();
  const horses = useDataStore((s) => s.horses);
  const careEvents = useDataStore((s) => s.careEvents);
  const people = useDataStore((s) => s.people);
  const lieu = useDataStore((s) => s.holding);
  const siretFactures = useDataStore((s) => s.billing?.siret);
  // Le SIRET est celui des factures quand il n'a été noté que là.
  const holding = useMemo(() => (lieu?.siret || !siretFactures ? lieu : { ...(lieu ?? {}), siret: siretFactures }), [lieu, siretFactures]);
  const stableName = useSettingsStore((s) => s.stableName);
  const gerant = useSettingsStore((s) => s.gerant);
  const billing = useDataStore((s) => s.billing);
  // Le nom de facturation plutôt que « Mon écurie » ; le gérant, propriétaire de ses chevaux à lui.
  const nomLieu = denomination(holding, billing, stableName);
  const moi = useMemo(() => detenteurDe(holding, billing, gerant), [holding, billing, gerant]);
  const today = localToday();
  const cur = currentQuarter(today);
  const [kind, setKind] = useState<PeriodKind>("trimestre");
  const [year, setYear] = useState(cur.year);
  const [quarter, setQuarter] = useState(cur.quarter ?? 1);
  const [printing, setPrinting] = useState(false);
  const period = useMemo(() => registerPeriod(kind, year, quarter), [kind, year, quarter]);
  const reg = useMemo(() => buildRegister({ horses, careEvents }, period, today), [horses, careEvents, period, today]);
  const isNow = kind === "trimestre" ? year === cur.year && quarter === cur.quarter : year === cur.year;
  useTitreDocument(kind === "annee" ? `Registre d’élevage ${year}` : `Registre d’élevage ${year} T${quarter}`);

  // La feuille imprimée vit à part, sous body : la navigation n'y est pas.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPrinting(true), []);

  const step = (d: -1 | 1) => {
    if (kind === "annee") return setYear(year + d);
    const q = quarter + d;
    if (q < 1) {
      setQuarter(4);
      setYear(year - 1);
    } else if (q > 4) {
      setQuarter(1);
      setYear(year + 1);
    } else setQuarter(q);
  };

  const hGaps = holdingGaps({ ...(holding ?? {}), holderName: moi.name || undefined }, reg.horses.length);
  const gapsByHorse = reg.horses
    .map((h) => ({ h, g: horseGaps(h) }))
    .filter((x) => x.g.length > 0)
    .sort((a, b) => (a.h.id === cheval ? -1 : b.h.id === cheval ? 1 : 0));
  const focus = cheval ? horses.find((h) => h.id === cheval) : undefined;

  const sheet = <Feuille reg={reg} holding={holding} nomLieu={nomLieu} moi={moi} people={people} today={today} />;

  return (
    <Ecran wide={desk} className="rg-pg">
      <Hello title="Registre d’élevage" sub="À imprimer et garder chaque trimestre." />
      <div className="rg-tools rise" style={{ animationDelay: ".1s" }}>
        <p className="note">
          Obligatoire dès que tu as un cheval chez toi, même un seul. Imprime-le à chaque visite du véto et garde les feuilles 5 ans avec les ordonnances.
        </p>
        <div className="rg-seg">
          <Seg<PeriodKind>
            value={kind}
            onChange={setKind}
            label="Période du registre"
            options={[
              ["trimestre", "Un trimestre"],
              ["annee", "Une année"],
            ]}
          />
        </div>
        <div className="rg-nav">
          <button type="button" onClick={() => step(-1)} aria-label={kind === "annee" ? "Année précédente" : "Trimestre précédent"}>
            <Ic n="back" className="" />
          </button>
          <span>
            <b>{period.label}</b>
            <small>
              du {dmy(period.start)} au {dmy(period.end)}
              {isNow ? " · en cours" : ""}
            </small>
          </span>
          <button type="button" onClick={() => step(1)} aria-label={kind === "annee" ? "Année suivante" : "Trimestre suivant"}>
            <Ic n="chev" className="" />
          </button>
        </div>
        {!isNow && (
          <button
            type="button"
            className="lnk rg-now"
            onClick={() => {
              setYear(cur.year);
              setQuarter(cur.quarter ?? 1);
            }}
          >
            Revenir {kind === "annee" ? "à cette année" : "au trimestre en cours"}
          </button>
        )}
        <button type="button" className="btn full" onClick={() => window.print()}>
          <Ic n="download" className="" />
          Imprimer ou enregistrer en PDF
        </button>
      </div>

      {(hGaps.length > 0 || gapsByHorse.length > 0) && (
        <Sec title="À compléter quand tu peux" delay={0.16} className="rg-gaps">
          <p className="note">Tu peux déjà l’imprimer. Ces cases resteront vides : à remplir à la main ou ici.</p>
          <div className="rows">
            {hGaps.length > 0 && (
              <Link href="/moi?s=papiers" className="li np">
                <span>
                  <b>Ton lieu de détention</b>
                  <small>{hGaps.map((g) => HOLDING_GAP_LABEL[g]).join(" · ")}</small>
                </span>
                <Ic n="chev" className="chev" />
              </Link>
            )}
            {/* Une ligne par rubrique, pas une par cheval : « 9 chevaux sans numéro SIRE » ouvre le premier. */}
            {groupesManquants(gapsByHorse).map(({ ks, qui }) => (
              <Link key={ks.join("-")} href={`/ticket?id=${qui[0].id}#identite`} className="li np">
                <span>
                  <b>
                    {qui.length > 1 ? `${qui.length} chevaux` : qui[0].name} {direManque(ks)}
                  </b>
                  <small>{qui.length > 1 ? `${qui.slice(0, 4).map((h) => h.name).join(", ")}${qui.length > 4 ? "…" : ""} · commencer par ${qui[0].name}` : "ouvrir sa fiche"}</small>
                </span>
                <Ic n="chev" className="chev" />
              </Link>
            ))}
          </div>
          {gapsByHorse.length > 1 && (
            <details className="rg-det">
              <summary>Voir cheval par cheval ({gapsByHorse.length})</summary>
              <div className="rows">
                {gapsByHorse.map(({ h, g }) => (
                  <Link key={h.id} href={`/ticket?id=${h.id}#identite`} className="li np">
                    <span>
                      <b>{h.name}</b>
                      <small>{g.map((x) => GAP_LABEL[x]).join(" · ")}</small>
                    </span>
                    <Ic n="chev" className="chev" />
                  </Link>
                ))}
              </div>
            </details>
          )}
        </Sec>
      )}
      {focus && !reg.horses.some((h) => h.id === focus.id) && (
        <p className="note rg-pad">{focus.name} n’était pas à l’écurie pendant cette période, donc pas sur cette feuille.</p>
      )}

      <Sec title="La feuille" delay={0.2}>
        <p className="note">Voici ce qui sera imprimé, en noir sur blanc, au format A4.</p>
        <div className="rg-paper">{sheet}</div>
      </Sec>
      <div className="end" />
      <PageImprimee page={`size: A4 landscape; margin: 12mm 12mm 14mm; @bottom-right { content: "Page " counter(page) " sur " counter(pages); font-size: 9pt; } @bottom-left { content: "Registre d’élevage"; font-size: 9pt; }`} />
      {printing && createPortal(<div className="rg-print" aria-hidden="true">{sheet}</div>, document.body)}
    </Ecran>
  );
}

/* ---------- La feuille imprimée ---------- */

function Feuille({ reg, holding, nomLieu, moi, people, today }: { reg: Register; holding?: Holding; nomLieu: string; moi: Detenteur; people: Parameters<typeof ownerLine>[1]; today: string }) {
  const h = holding ?? {};
  const byId = new Map(reg.horses.map((x) => [x.id, x]));
  const nom = (id: string) => byId.get(id)?.name ?? "";
  const du = `du ${dmy(reg.period.start)} au ${dmy(reg.period.end)}`;
  return (
    <article className="rg-sheet" aria-label={`Registre d’élevage, ${reg.period.label}`}>
      <header className="rg-head">
        <h1>Registre d’élevage</h1>
        <p>
          Détenteur d’équidés · {nomLieu ? `${nomLieu} · ` : ""}
          {reg.period.label}, {du}
        </p>
        <p>Imprimé le {dmy(today)}</p>
      </header>

      <section>
        <h2>1. Caractéristiques du lieu de détention</h2>
        <dl className="rg-kv">
          <Kv k="Dénomination" v={nomLieu} />
          <Kv k="Adresse du lieu" v={h.placeAddress} />
          <Kv k="Type d’activité" v={h.activity} />
          <Kv k="Numéro de détenteur (SIRE)" v={h.holderNumber} />
          <Kv k="Détenteur" v={moi.name} />
          <Kv k="Adresse du détenteur" v={h.holderAddress || (h.placeAddress ? undefined : moi.address)} />
          <Kv k="Téléphone, courriel" v={[h.holderPhone, h.holderEmail].filter(Boolean).join(", ")} />
          <Kv k="SIRET" v={h.siret ? siretDit(h.siret) : undefined} />
        </dl>
      </section>

      <section>
        <h2>2. Encadrement zootechnique, sanitaire et médical</h2>
        <dl className="rg-kv">
          <Kv k="Espèce et type de production" v={`Équidés${h.activity ? `, ${h.activity}` : ""}`} />
          <Kv k="Vétérinaire traitant" v={h.vetTraitant} />
          <Kv k="Vétérinaire sanitaire" v={h.vetSanitaire} />
        </dl>
      </section>

      <section>
        <h2>3. Présence et caractéristiques des animaux</h2>
        <p className="rg-sub">Équidés présents {du} : {reg.horses.length}</p>
        <Table
          cols={["N°", "Nom", "N° SIRE ou UELN", "N° transpondeur", "Sexe", "Naissance", "Propriétaire et coordonnées", "Première entrée", "Provenance", "Sortie définitive", "Destination"]}
          rows={reg.horses.map((x: Horse, i) => [String(i + 1), x.name, x.sireNumber, x.chipNumber, x.sex ? SEX_LABEL[x.sex] : "", birthLabel(x), ownerLine(x, people, moi), dmy(x.entryDate), x.origin, dmy(x.exitDate), x.destination])}
          empty="Aucun équidé présent sur la période."
        />
      </section>

      <section>
        <h2>4. Entrées et sorties définitives</h2>
        <Table
          cols={["Date", "Équidé", "Mouvement", "Motif", "Provenance ou destination"]}
          rows={reg.movements.map((m) => [dmy(m.date), m.horseName, m.kind === "entree" ? "Entrée" : "Sortie", m.reason, m.place])}
          empty="Aucune entrée ni sortie sur la période."
        />
      </section>

      <section>
        <h2>5. Mouvements temporaires</h2>
        <Table
          cols={["Date de sortie", "Équidé", "Motif", "Lieu de destination (adresse)", "Date de retour"]}
          rows={[...reg.temporary.map((e) => [dmy(e.date), nom(e.horseId), [CARE_META[e.kind].label, e.label].filter(Boolean).join(", "), e.provider, ""]), ...blank(3, 5)]}
        />
      </section>

      <section>
        <h2>6. Interventions et soins courants</h2>
        <p className="rg-sub">Dans l’ordre chronologique, tous les équidés ensemble.</p>
        <Table
          cols={["Date", "Équidé", "Type d’intervention", "Intervenant", "Traitement ou produit", "N° d’ordonnance", "Délai d’attente"]}
          rows={reg.care.map((e) => [dmy(e.date), nom(e.horseId), CARE_META[e.kind].label, e.provider, e.label, "", ""])}
          empty="Aucun soin noté dans l’app sur la période."
        />
      </section>

      <section>
        <h2>7. Contrôles du registre</h2>
        <Table cols={["Date", "Organisme de contrôle", "Motif du contrôle", "Nom du contrôleur", "Cachet et signature"]} rows={blank(2, 5)} />
      </section>

      <footer className="rg-foot">
        <p>Ordonnances, bilans sanitaires, résultats d’analyses et bons d’enlèvement sont classés avec ce registre et gardés 5 ans.</p>
      </footer>
    </article>
  );
}

const blank = (n: number, cols: number) => Array.from({ length: n }, () => Array.from({ length: cols }, () => ""));

function Kv({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v || " "}</dd>
    </div>
  );
}

function Table({ cols, rows, empty }: { cols: string[]; rows: (string | undefined)[][]; empty?: string }) {
  return (
    <div className="rg-scroll">
      <table className="rg-t">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="rg-none">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c || " "}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
