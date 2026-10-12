"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { ObHead } from "@/components/bs/ob-head";
import { HorseFace, COATS, COAT_KEYS, type Coat } from "@/components/bs/horse-face";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";

const FORMULES: { name: string; picto: string }[] = [
  { name: "Box seul", picto: "box" },
  { name: "Box + paddock", picto: "box" },
  { name: "Pension travail", picto: "cours" },
  { name: "Retraite", picto: "foin" },
  { name: "Pré", picto: "foin" },
];

export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Chevaux />
      </Suspense>
    </ClientGate>
  );
}

function Chevaux() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const allHorses = useDataStore((s) => s.horses);
  const horses = allHorses.filter((h) => !h.isArchived);
  const addHorse = useDataStore((s) => s.addHorse);
  const tariffs = useDataStore((s) => s.tariffs);
  const say = useUiStore((s) => s.say);
  const { pass } = useParcours();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [coat, setCoat] = useState<Coat>("alezan");
  const [blaze, setBlaze] = useState(true);
  const [formule, setFormule] = useState("Box + paddock");

  function add() {
    const n = name.trim();
    if (!n) return;
    addHorse({ name: n, ownerName: owner.trim() || undefined, coat, blaze, pensionType: formule, pension: tariffs?.pension, entryDate: localToday() });
    say(`<strong>${n.replace(/</g, "")}</strong> rejoint l’écurie.`);
    setName("");
    setOwner("");
  }

  return (
    <Screen>
      <ObHead retour={retour} n={1} title={retour ? "Ajouter un cheval" : "Tes chevaux"} sub="Commence par les chevaux en pension chez toi. Tu pourras ajouter les tiens plus tard." />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
        <HorseFace coat={coat} blaze={blaze} size={76} />
      </div>
      <label className="bs-sec" htmlFor="h-name" style={{ display: "flex" }}>
        Son nom
      </label>
      <div className="bs-field">
        <input id="h-name" placeholder="Ex. Pacha" value={name} autoComplete="off" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      </div>
      <label className="bs-sec" htmlFor="h-owner" style={{ display: "flex" }}>
        Son propriétaire <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>facultatif</span>
      </label>
      <div className="bs-field">
        <input id="h-owner" placeholder="Ex. Julie P." value={owner} autoComplete="off" onChange={(e) => setOwner(e.target.value)} />
      </div>
      <Sec>Sa robe</Sec>
      <div className="bs-swatches">
        {COAT_KEYS.map((c) => (
          <button key={c} type="button" className="bs-sw" aria-pressed={coat === c} aria-label={`Robe ${COATS[c].label}`} onClick={() => setCoat(c)}>
            <i style={{ background: COATS[c].swatch }} />
          </button>
        ))}
        <button type="button" className="bs-chip" aria-pressed={blaze} onClick={() => setBlaze(!blaze)} style={{ marginLeft: 4 }}>
          Liste en tête
        </button>
      </div>
      <Sec>Sa formule de pension</Sec>
      <div className="bs-chips">
        {FORMULES.map((f) => (
          <button key={f.name} type="button" className="bs-chip" aria-pressed={formule === f.name} onClick={() => setFormule(f.name)}>
            <Picto name={f.picto} />
            {f.name}
          </button>
        ))}
      </div>
      <button type="button" className="bs-btn line" style={{ marginTop: 14 }} disabled={!name.trim()} onClick={add}>
        <Picto name="plus" />
        Ajouter {name.trim() || "ce cheval"}
      </button>

      <Sec>Dans ton écurie · {horses.length}</Sec>
      {horses.length ? (
        <div className="bs-faces">
          {horses.map((h) => (
            <div key={h.id} className="bs-fpick">
              <span className="ring">
                <HorseFace horse={h} size={40} />
              </span>
              {h.name}
            </div>
          ))}
        </div>
      ) : (
        <p className="bs-p">Aucun cheval pour l’instant. Ajoute le premier au-dessus.</p>
      )}
      <button
        type="button"
        className="bs-btn"
        style={{ marginTop: 22 }}
        disabled={horses.length === 0}
        onClick={() => {
          if (!retour) pass("chevaux");
          router.push(retour ? `/${retour}` : "/parcours/tarifs");
        }}
      >
        {retour ? "Terminé" : "Passer à l’étape suivante"} <Picto name="check" />
      </button>
    </Screen>
  );
}
