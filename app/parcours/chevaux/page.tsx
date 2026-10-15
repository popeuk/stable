"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Chips, Face, Ic, Portrait } from "@/components/carnet/ui";
import { ObHead } from "@/components/bs/ob-head";
import { COATS, COAT_KEYS, type Coat } from "@/components/bs/horse-face";
import { useParcours } from "@/components/bs/parcours";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { localToday } from "@/lib/utils/local-date";

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
  const [formule, setFormule] = useState<string>("Box + paddock");

  function add() {
    const n = name.trim();
    if (!n) return;
    addHorse({ name: n, ownerName: owner.trim() || undefined, coat, blaze, pensionType: formule, pension: tariffs?.pension, entryDate: localToday() });
    say(`<strong>${n.replace(/</g, "")}</strong> rejoint l’écurie.`);
    setName("");
    setOwner("");
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
        <label className="field" htmlFor="h-owner">
          <span>Son propriétaire</span>
          <input id="h-owner" className="input" placeholder="Ex. Julie P." value={owner} autoComplete="off" onChange={(e) => setOwner(e.target.value)} />
          <em>Facultatif.</em>
        </label>
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
      <button
        type="button"
        className="btn ar-go"
        style={{ marginTop: 22 }}
        disabled={horses.length === 0}
        onClick={() => {
          if (!retour) pass("chevaux");
          router.push(retour ? `/${retour}` : "/parcours/tarifs");
        }}
      >
        {retour ? "Terminé" : "Passer à l’étape suivante"}
        <Ic n="ck" className="" />
      </button>
    </>
  );
}
