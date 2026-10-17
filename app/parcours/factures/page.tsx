"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic, Seg, Tip, eur } from "@/components/carnet/ui";
import { pictoForLabel } from "@/components/bs/picto";
import { MontantMois, ObHead } from "@/components/bs/ob-head";
import { FRAIS_CAT, fraisDuMois, fraisEnUnTotal, posteTape, retirerPostes, retirerTotal, useParcours } from "@/components/bs/parcours";
import { ChoixConnu, ChoixFois, SoitParMois, ligneConnu, uniteConnu } from "@/components/bs/montant-connu";
import { useDataStore } from "@/stores/data-store";
import { currentPeriod } from "@/lib/utils/period";
import { montantEnTexte, montantOuZero, saisieMontant } from "@/lib/utils/montant";
import { parMois, saisiDe, type Connu } from "@/lib/domain/montant-saisi";
import type { Category } from "@/lib/domain/types";

/** Les pictos des catégories, dans le jeu d'icônes du carnet. */
const IC: Record<string, string> = { box: "home", fer: "shoe", veto: "syringe", pot: "syringe", main: "user", dent: "syringe", cours: "clock", trophee: "flag", foin: "hay", personne: "user", cle: "home", camion: "arrow", euro: "doc" };

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Factures />
      </Suspense>
    </ClientGate>
  );
}

type Mode = "total" | "postes";
type Per = { year: number; month: number };

/** Le total tel que tapé : par mois, par an ou en plusieurs fois. */
function totalTape(period: Per) {
  const d = useDataStore.getState();
  const cat = d.expenseCategories.find((c) => c.name === FRAIS_CAT && !c.isDirect);
  return cat ? posteTape(d, cat.id, period) : { mode: "mois" as Connu, montant: 0, fois: 2 };
}

/**
 * Un poste : son nom, son montant, et, en touchant le nom, comment le
 * gérant le connaît (par mois, par an, en plusieurs fois). Enregistré, il
 * compte toujours son équivalent par mois.
 */
function Poste({ c, period }: { c: Category; period: Per }) {
  const setMonthlyCharge = useDataStore((s) => s.setMonthlyCharge);
  const [init] = useState(() => posteTape(useDataStore.getState(), c.id, period));
  const [connu, setConnu] = useState<Connu>(init.mode);
  const [fois, setFois] = useState(init.fois);
  const [txt, setTxt] = useState(() => montantEnTexte(init.montant));
  const [open, setOpen] = useState(false);
  const enregistrer = (t: string, m: Connu, n: number) => {
    const v = montantOuZero(t);
    setMonthlyCharge(c.id, c.name, parMois(m, v, n), period, saisiDe(m, v, n));
  };
  const montant = montantOuZero(txt);
  return (
    <div className="ar-ln">
      <span className="pic">
        <Ic n={IC[pictoForLabel(c.name)] ?? "doc"} className="ar-ico" />
      </span>
      <button type="button" className="ar-ln-nm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <b>{c.name}</b>
        <small>
          {ligneConnu(connu, fois)} · <u>changer</u>
        </small>
      </button>
      <input
        className="inl"
        inputMode="decimal"
        value={txt}
        placeholder="0"
        aria-label={`${c.name}, en euros, ${ligneConnu(connu, fois)}`}
        onChange={(e) => {
          const t = saisieMontant(e.target.value);
          setTxt(t);
          enregistrer(t, connu, fois);
        }}
      />
      <i>€</i>
      {open && (
        <div className="ar-ln-mc">
          <ChoixConnu
            value={connu}
            onChange={(m) => {
              setConnu(m);
              enregistrer(txt, m, fois);
            }}
          />
          {connu === "fois" && (
            <ChoixFois
              fois={fois}
              onChange={(n) => {
                setFois(n);
                enregistrer(txt, connu, n);
              }}
            />
          )}
          <SoitParMois mode={connu} montant={montant} fois={fois} />
        </div>
      )}
      {!open && connu !== "mois" && montant > 0 && (
        <div className="ar-ln-mc">
          <SoitParMois mode={connu} montant={montant} fois={fois} />
        </div>
      )}
    </div>
  );
}

/**
 * L'obstacle « frais communs ». Un total (un seul montant, une charge
 * « Frais fixes ») ou poste par poste (catégorie par catégorie). Passer de
 * l'un à l'autre propose de retirer l'autre : rien n'est compté deux fois.
 */
function Factures() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const data = useDataStore();
  const { pass } = useParcours();
  const period = useMemo(() => currentPeriod(), []);
  const f = fraisDuMois(data, period);
  const [mode, setMode] = useState<Mode>(() => (fraisDuMois(useDataStore.getState(), period).postes > 0 ? "postes" : "total"));
  const [t0] = useState(() => totalTape(period));
  const [txt, setTxt] = useState(() => montantEnTexte(t0.montant));
  const [connu, setConnu] = useState<Connu>(t0.mode);
  const [fois, setFois] = useState(t0.fois);
  // Les champs poste par poste se remontent quand un total les vide.
  const [rev, setRev] = useState(0);

  // Toujours compté par mois : un total connu à l'année est réparti sur les douze mois.
  const enregistrerTotal = (v: string, m: Connu, n: number) => {
    const x = montantOuZero(v);
    fraisEnUnTotal(parMois(m, x, n), period, saisiDe(m, x, n));
  };
  const changerTotal = (v: string) => {
    setTxt(v);
    enregistrerTotal(v, connu, fois);
  };

  return (
    <>
      <ObHead retour={retour} n={3} title="Tes frais communs" sub="Les dépenses qui servent à toute l’écurie : foin, paille, loyer, salaires… Elles sont comptées chaque mois et partagées entre tes chevaux." />
      <div className="ar-seg">
        <Seg<Mode>
          label="Comment noter tes frais"
          value={mode}
          onChange={setMode}
          options={[
            ["total", "Un total"],
            ["postes", "Poste par poste"],
          ]}
        />
      </div>

      {mode === "total" ? (
        <>
          <div className="ar-mc">
            <ChoixConnu
              value={connu}
              onChange={(m) => {
                setConnu(m);
                enregistrerTotal(txt, m, fois);
              }}
            />
            {connu === "fois" && (
              <ChoixFois
                fois={fois}
                onChange={(n) => {
                  setFois(n);
                  enregistrerTotal(txt, connu, n);
                }}
              />
            )}
          </div>
          <MontantMois
            id="f-total"
            label={connu === "an" ? "Foin, loyer, salaires… ce que tu paies par an" : connu === "fois" ? "Foin, loyer, salaires… ce que tu paies à chaque fois" : "Foin, loyer, salaires… par mois"}
            unit={uniteConnu(connu)}
            value={txt}
            onChange={changerTotal}
            help="Un ordre d’idée suffit. Tu affineras plus tard."
          />
          {connu !== "mois" && montantOuZero(txt) > 0 && (
            <div className="ar-mc">
              <SoitParMois mode={connu} montant={montantOuZero(txt)} fois={fois} />
            </div>
          )}
          {f.postes > 0 && (
            <div className="ar-warn" role="status">
              <span>
                Tu as aussi noté <b>{eur(f.postes)}</b> poste par poste. Ils s’ajoutent à ce total.
              </span>
              <button
                type="button"
                className="btn line"
                onClick={() => {
                  retirerPostes(period);
                  setRev((r) => r + 1);
                }}
              >
                Ne garder que le total
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {f.total > 0 && (
            <div className="ar-warn" role="status">
              <span>
                Tu as déjà noté un total de <b>{eur(f.total)}</b>. Avec tes postes, il compterait deux fois.
              </span>
              <button
                type="button"
                className="btn line"
                onClick={() => {
                  retirerTotal(period);
                  setTxt("");
                }}
              >
                Retirer le total
              </button>
            </div>
          )}
          <div className="ar-lines" key={rev}>
            {f.cats.map((c) => (
              <Poste key={c.id} c={c} period={period} />
            ))}
          </div>
        </>
      )}

      <div className="ar-total">
        <span>Total par mois</span>
        <b>{eur(f.total + f.postes)}</b>
      </div>
      {mode === "postes" && (
        <Tip ill="carnet-buste">
          <b>Un ordre d’idée suffit.</b> Tu pourras corriger ces montants quand tu veux, depuis « Mon écurie et mes réglages ».
        </Tip>
      )}
      <button
        type="button"
        className="btn ar-go"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          if (!retour) pass("factures");
          router.push(retour ? `/${retour}` : "/parcours/arrivee");
        }}
      >
        {retour ? "Enregistrer" : "Voir ce qu’il me reste"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
