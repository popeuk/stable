"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Face, Ic, Tip } from "@/components/carnet/ui";
import { ObHead } from "@/components/bs/ob-head";
import { ForfaitOffre } from "@/components/bs/formule";
import { changerPensionCommune, estAMoi, pensionCommune, useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { lireMontant, montantEnTexte, montantOuZero } from "@/lib/utils/montant";

/** Les trois cours de base, déjà dans la grille : on ne les redemande pas en prestation. */
const BASE = /^(cours d.equitation|cours particulier|cours collectif|travail du cheval)$/;
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Tarifs />
      </Suspense>
    </ClientGate>
  );
}

function Tarifs() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const allHorses = useDataStore((s) => s.horses);
  // Tes chevaux à toi n'ont pas de pension : ils ne sont ni listés ici, ni comptés comme une pension qui manque.
  const horses = allHorses.filter((h) => !h.isArchived && !estAMoi(h));
  const setPension = useDataStore((s) => s.setPension);
  const tariffs = useDataStore((s) => s.tariffs) ?? {};
  const setTariff = useDataStore((s) => s.setTariff);
  const { pass } = useParcours();
  const month = localToday().slice(0, 7);
  const missing = horses.filter((h) => !h.pension).length;
  const prestations = useDataStore((s) => s.prestations) ?? [];
  const addPrestation = useDataStore((s) => s.addPrestation);
  const updatePrestation = useDataStore((s) => s.updatePrestation);
  const removePrestation = useDataStore((s) => s.removePrestation);
  // Les prestations en plus des trois cours : celles qui ont un prix, et celles ajoutées ici.
  const [ajoutees, setAjoutees] = useState<string[]>([]);
  const autres = prestations.filter((x) => x.active && !BASE.test(norm(x.label)) && (x.price > 0 || ajoutees.includes(x.id)));
  const [nouvelle, setNouvelle] = useState<{ nom: string; prix: string } | null>(null);
  const ajouter = () => {
    if (!nouvelle?.nom.trim()) return;
    const nom = nouvelle.nom.trim();
    const prix = lireMontant(nouvelle.prix) || 0;
    // Déjà dans la liste sans prix (« Balade encadrée » pour « balade ») : on la reprend plutôt que d'en faire une deuxième.
    const deja = prestations.find((x) => x.active && !BASE.test(norm(x.label)) && norm(x.label).startsWith(norm(nom)));
    const id = deja ? (updatePrestation(deja.id, { label: nom, price: prix }), deja.id) : addPrestation({ label: nom, price: prix });
    setAjoutees((a) => [...a, id]);
    setNouvelle(null);
  };
  // Des chevaux venus d'un nombre partagent une pension : elle est déjà fixée.
  const [commune, setCommune] = useState(() => pensionCommune(useDataStore.getState()));

  return (
    <>
      <ObHead
        retour={retour}
        n={2}
        title={retour ? "Mes prix" : "Tes prix"}
        sub={commune !== null ? "Ta pension est fixée. Ajoute le prix de tes cours si tu en donnes." : "Ce que chaque propriétaire te paie par mois. Ensuite, elle est comptée chaque mois, sans que tu la notes."}
      />
      {commune !== null ? (
        <>
          <div className="ar-lines">
            <div className="ar-ln">
              <span className="pic">
                <Ic n="horse" className="ar-ico" />
              </span>
              <span>
                <b>La pension</b>
                <small className="ar-set">Prix fixé pour {horses.length > 1 ? `tes ${horses.length} chevaux en pension` : "ton cheval en pension"}</small>
              </span>
              <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(commune)} placeholder="0" aria-label="Pension de chaque cheval, euros par mois" onChange={(e) => changerPensionCommune(montantOuZero(e.target.value))} />
              <i>€</i>
            </div>
          </div>
          <button type="button" className="ar-alt" onClick={() => setCommune(null)}>
            Fixer la pension pour chaque cheval
          </button>
        </>
      ) : (
        <div className="ar-lines">
          {horses.map((h) => (
            <div key={h.id} className="ar-ln">
              <Face horse={h} />
              <span>
                <b>{h.name}</b>
                <small>{h.pensionType ?? "Pension"}</small>
              </span>
              <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(h.pension)} placeholder="0" aria-label={`Pension de ${h.name}, euros par mois`} onChange={(e) => setPension(h.id, montantOuZero(e.target.value), month)} />
              <i>€</i>
            </div>
          ))}
        </div>
      )}
      <p className="ar-h5">{commune !== null ? "Tes cours" : "Tes autres prix"}</p>
      <div className="ar-lines" style={{ marginTop: 0 }}>
        {(
          [
            ["cours_collectif", "Cours collectif", "par cavalier"],
            ["cours_individuel", "Cours particulier", "la séance"],
            ["entrainement", "Travail du cheval", "la séance"],
          ] as const
        ).map(([k, l, s]) => (
          <div key={k} className="ar-ln-g">
            <div className="ar-ln">
            <span className="pic">
              <Ic n="clock" className="ar-ico" />
            </span>
            <span>
              <b>{l}</b>
              <small>{s}</small>
            </span>
            <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(tariffs[k])} placeholder="0" aria-label={`${l}, euros`} onChange={(e) => setTariff(k, lireMontant(e.target.value) || undefined)} />
            <i>€</i>
            </div>
            <ForfaitOffre tarif={k} />
          </div>
        ))}
      </div>
      {autres.length > 0 && (
        <div className="ar-lines" style={{ marginTop: 0 }}>
          {autres.map((x) => (
            <div key={x.id} className="ar-ln-g">
              <div className="ar-ln">
              <span className="pic">
                <Ic n="clock" className="ar-ico" />
              </span>
              <span>
                <b>{x.label}</b>
                <small>par cavalier ou la séance</small>
              </span>
              <input className="inl" inputMode="decimal" defaultValue={montantEnTexte(x.price || undefined)} placeholder="0" aria-label={`${x.label}, euros`} onChange={(e) => updatePrestation(x.id, { price: lireMontant(e.target.value) || 0 })} />
              <button type="button" className="ar-ln-x" aria-label={`Retirer ${x.label}`} onClick={() => (removePrestation(x.id), setAjoutees((a) => a.filter((i) => i !== x.id)))}>
                <Ic n="x" className="" />
              </button>
              </div>
              <ForfaitOffre prestationId={x.id} />
            </div>
          ))}
        </div>
      )}
      {nouvelle ? (
        <div className="ar-new">
          <label className="field" htmlFor="pr-nom">
            <span>Ce que tu proposes</span>
            <input id="pr-nom" className="input" autoFocus placeholder="Ex. Balade, longe, débourrage" value={nouvelle.nom} autoComplete="off" onChange={(e) => setNouvelle({ ...nouvelle, nom: e.target.value })} onKeyDown={(e) => e.key === "Enter" && ajouter()} />
          </label>
          <label className="field" htmlFor="pr-prix">
            <span>Son prix, par cavalier ou la séance</span>
            <span className="ar-mm-f">
              <input id="pr-prix" inputMode="decimal" autoComplete="off" placeholder="0" value={nouvelle.prix} onChange={(e) => setNouvelle({ ...nouvelle, prix: e.target.value })} onKeyDown={(e) => e.key === "Enter" && ajouter()} />
              <span className="u">€</span>
            </span>
          </label>
          <div className="ar-new-go">
            <button type="button" className="btn" disabled={!nouvelle.nom.trim()} onClick={ajouter}>
              <Ic n="plus" className="" />
              Ajouter
            </button>
            <button type="button" className="btn ghost" onClick={() => setNouvelle(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="ar-add" onClick={() => setNouvelle({ nom: "", prix: "" })}>
          <Ic n="plus" className="" />
          Ajouter une prestation
        </button>
      )}
      <Tip ill="carnet-buste">
        <b>Ces prix se remplissent tout seuls</b> quand tu notes un cours. Tu peux toujours les changer juste pour une fois.
      </Tip>
      <button
        type="button"
        className="btn ar-go"
        onClick={() => {
          (document.activeElement as HTMLElement | null)?.blur();
          // Rien de rempli : l'étape est passée, pas franchie (le message ne félicite pas).
          if (!retour) pass("tarifs", !Object.values(useDataStore.getState().tariffs ?? {}).some(Boolean));
          router.push(retour ? `/${retour}` : "/parcours/factures");
        }}
      >
        {retour ? "Enregistrer" : missing && commune === null ? `Continuer avec ${missing} pension${missing > 1 ? "s" : ""} à 0 €` : "Continuer"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
