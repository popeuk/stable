"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Chips, Face, Ic, Portrait } from "@/components/carnet/ui";
import { MontantMois, ObHead } from "@/components/bs/ob-head";
import { COATS, COAT_KEYS, type Coat } from "@/components/bs/horse-face";
import { ajouterChevaux, useParcours } from "@/components/bs/parcours";
import { ChoisirProprio } from "@/components/bs/choisir-proprio";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";
import { montantEnTexte, montantOuZero } from "@/lib/utils/montant";
import { esc } from "@/components/bs/ui";
import { useSettingsStore } from "@/stores/settings-store";

const FORMULES = ["Box seul", "Box + paddock", "Pension travail", "Retraite", "Pré"] as const;

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Chevaux />
      </Suspense>
    </ClientGate>
  );
}

/**
 * L'obstacle « chevaux ». Par défaut, un nombre et une pension moyenne :
 * « Cheval 1 » … « Cheval N » sont créés d'un coup (les noms viendront plus
 * tard, l'accueil le rappelle). Le formulaire cheval par cheval reste là
 * pour qui préfère les nommer tout de suite.
 */
function Chevaux() {
  const router = useRouter();
  const sp = useSearchParams();
  const retour = sp.get("retour");
  // ?proprietaire=Nom : les chevaux ajoutés un par un sont à lui ; « Terminé » ramène à sa fiche (?retour=client).
  const proprietaire = sp.get("proprietaire")?.trim() ?? "";
  const allHorses = useDataStore((s) => s.horses);
  const horses = allHorses.filter((h) => !h.isArchived);
  const addHorse = useDataStore((s) => s.addHorse);
  const tariffs = useDataStore((s) => s.tariffs);
  const say = useUiStore((s) => s.say);
  const { pass } = useParcours();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState(proprietaire);
  const [coat, setCoat] = useState<Coat>("alezan");
  const [blaze, setBlaze] = useState(true);
  const [formule, setFormule] = useState<string>("Box + paddock");
  // Ouvert depuis l'app (« Ajouter un cheval »), on garde le formulaire nommé.
  const [noms, setNoms] = useState(!!retour || !!proprietaire);
  const [nombre, setNombre] = useState(horses.length ? 1 : 9);
  const [tick, setTick] = useState(0);
  const [pension, setPension] = useState(montantEnTexte(tariffs?.pension));
  const p = montantOuZero(pension);
  // Le nombre de boxes, facultatif : sans lui, aucune estimation de boxes vides.
  const capacity = useSettingsStore((s) => s.capacity);
  const setCapacity = useSettingsStore((s) => s.setCapacity);
  const [boxes, setBoxes] = useState(capacity ? String(capacity) : "");

  const suite = () => {
    if (!retour) pass("chevaux");
    if (retour === "client" && proprietaire) return router.push(`/client?nom=${encodeURIComponent(proprietaire)}`);
    router.push(retour ? `/${retour}` : "/parcours/tarifs");
  };

  function add() {
    const n = name.trim();
    if (!n) return;
    addHorse({ name: n, ownerName: owner.trim() || undefined, coat, blaze, pensionType: formule, pension: tariffs?.pension, entryDate: localToday() });
    say(`<strong>${esc(n)}</strong> rejoint l’écurie.`);
    setName("");
    setOwner(proprietaire);
  }

  function parNombre() {
    if (!p) return;
    const b = Number(boxes);
    if (b > 0) setCapacity(Math.max(b, horses.length + nombre));
    const vide = horses.length === 0;
    const n = ajouterChevaux(nombre, p);
    if (vide) return suite();
    say(n > 1 ? `<strong>${n} chevaux</strong> rejoignent l’écurie.` : "<strong>Un cheval</strong> rejoint l’écurie.");
    setNombre(1);
  }

  const troupeau = (
    <>
      <p className="ar-h5">
        Dans ton écurie <em>{horses.length}</em>
      </p>
      {horses.length ? (
        <div className="ar-herd">
          {horses.map((h) => (
            <span key={h.id}>
              <Face horse={h} />
              {h.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="ar-sub">Aucun cheval pour l’instant. Ajoute le premier au-dessus.</p>
      )}
    </>
  );

  if (!noms) {
    const deja = horses.length;
    return (
      <>
        <ObHead
          retour={retour}
          n={1}
          title={deja ? "Tes chevaux" : "Combien de chevaux chez toi ?"}
          sub={deja ? `${deja > 1 ? `${deja} chevaux sont` : "Un cheval est"} déjà dans ton écurie. Tu peux en ajouter, ou passer.` : "Ceux qui sont dans ton écurie aujourd’hui. Tu leur donneras un nom plus tard."}
        />
        {deja > 0 && troupeau}
        {deja > 0 && <p className="ar-h5">En ajouter</p>}
        <div className="es-count">
          <button type="button" aria-label="Un cheval de moins" disabled={nombre <= 1} onClick={() => (setNombre((v) => Math.max(1, v - 1)), setTick((t) => t + 1))}>
            −
          </button>
          <b key={tick} className={tick ? "tick" : ""} aria-live="polite">
            {nombre}
          </b>
          <button type="button" aria-label="Un cheval de plus" disabled={nombre >= 60} onClick={() => (setNombre((v) => Math.min(60, v + 1)), setTick((t) => t + 1))}>
            +
          </button>
        </div>
        <p className="es-count-lab">{deja ? (nombre > 1 ? "chevaux de plus" : "cheval de plus") : nombre > 1 ? "chevaux" : "cheval"}</p>
        <MontantMois id="h-pension" label="Une pension, c’est combien par mois ?" value={pension} onChange={setPension} help="En moyenne, toutes formules confondues." />
        {!deja && (
          <div className="ar-mm">
            <label htmlFor="h-boxes">Combien de boxes en tout ?</label>
            <span className="ar-mm-f">
              <input id="h-boxes" inputMode="numeric" autoComplete="off" placeholder="?" value={boxes} onChange={(e) => setBoxes(e.target.value.replace(/\D/g, "").slice(0, 2))} aria-describedby="h-boxes-aide" />
              <span className="u">boxes</span>
            </span>
            <p id="h-boxes-aide" className="es-help">
              Facultatif. Avec, l’app te dit ce que rapporteraient tes boxes vides.
            </p>
          </div>
        )}
        {deja ? (
          <>
            <button type="button" className="btn line ar-go" disabled={!p} onClick={parNombre}>
              <Ic n="plus" className="" />
              Ajouter {nombre > 1 ? `${nombre} chevaux` : "un cheval"}
            </button>
            <button type="button" className="btn ar-go" onClick={suite}>
              Continuer
              <Ic n="ck" className="" />
            </button>
          </>
        ) : (
          <button type="button" className="btn ar-go" style={{ marginTop: 22 }} disabled={!p} onClick={parNombre}>
            Continuer
            <Ic n="ck" className="" />
          </button>
        )}
        <button type="button" className="ar-alt" onClick={() => setNoms(true)}>
          Je préfère les nommer un par un
        </button>
      </>
    );
  }

  return (
    <>
      <ObHead retour={retour} n={1} title={retour ? "Ajouter un cheval" : "Tes chevaux"} sub="Commence par les chevaux en pension chez toi. Tu pourras ajouter les tiens plus tard." />
      <Portrait horse={{ id: "apercu", name: name.trim() || "Ton cheval", coat }} />
      <div className="ar-form">
        <label className="field" htmlFor="h-name">
          <span>Son nom</span>
          <input id="h-name" className="input" placeholder="Ex. Pacha" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        </label>
        <ChoisirProprio value={owner} onChange={setOwner} />
        <div className="field">
          <span>Sa robe</span>
          <div className="ar-robes">
            {COAT_KEYS.map((c) => (
              <button key={c} type="button" className="ar-robe" aria-pressed={coat === c} aria-label={`Robe ${COATS[c].label}`} onClick={() => setCoat(c)}>
                <Face horse={{ id: c, name: "", coat: c }} />
                {COATS[c].label}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={blaze} onClick={() => setBlaze(!blaze)}>
              Liste en tête
            </button>
          </div>
        </div>
        <div className="field">
          <span>Sa formule de pension</span>
          <Chips value={formule} onChange={setFormule} options={FORMULES.map((f) => [f, f] as [string, string])} />
        </div>
        <button type="button" className="btn line full" disabled={!name.trim()} onClick={add}>
          <Ic n="plus" className="" />
          Ajouter {name.trim() || "ce cheval"}
        </button>
      </div>

      {troupeau}
      <button type="button" className="btn ar-go" style={{ marginTop: 22 }} disabled={horses.length === 0} onClick={suite}>
        {retour ? "Terminé" : "Continuer"}
        <Ic n="ck" className="" />
      </button>
      {!retour && (
        <button type="button" className="ar-alt" onClick={() => setNoms(false)}>
          Donner juste un nombre
        </button>
      )}
    </>
  );
}
