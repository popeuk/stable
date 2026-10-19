"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Face, Ic, Page as Ecran, Portrait, Sec } from "@/components/carnet/ui";
import { COATS, COAT_KEYS, type Coat } from "@/components/bs/horse-face";
import { useDesk } from "@/components/bs/desk-hook";
import { ChoisirProprio } from "@/components/bs/choisir-proprio";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { debutCompte, dernierSejour } from "@/lib/domain/sejours";
import type { Horse } from "@/lib/domain/types";
import { montantEnTexte, montantOuZero, saisieMontant } from "@/lib/utils/montant";
import { useUiStore } from "@/stores/ui-store";
import { esc } from "@/lib/utils/esc";
import { useParentIci } from "@/components/bs/nav";
import { adresseClient, nomDeLAdresse } from "@/lib/adresse-client";

const FORMULES = ["Box seul", "Box + paddock", "Pension travail", "Retraite", "Pré"];

/**
 * La règle d'une arrivée datée, dite à la saisie (lib/domain/sejours) : la
 * date va au registre d'élevage ; dans l'argent, il compte à partir de ce
 * mois-ci, les mois d'avant sont déjà comptés et ne bougent pas.
 */
function arriveeEnMots(entry: string, editing?: Horse): string {
  const today = localToday();
  const nom = new Date(today + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" });
  const mois = /^[aeiouy]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
  if (editing && debutCompte(dernierSejour(editing)) < `${today.slice(0, 7)}-01`) return "Cette date va au registre d’élevage. Les mois passés ne changent pas.";
  if (entry && entry.slice(0, 7) < today.slice(0, 7)) return `Cette date va au registre d’élevage. Sa pension et sa part des frais comptent à partir ${mois}.`;
  return "Sa pension et sa part des frais comptent à partir de ce jour-là.";
}

export default function SaisieChevalPage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <SaisieCheval />
      </Suspense>
    </ClientGate>
  );
}

function SaisieCheval() {
  const router = useRouter();
  const search = useSearchParams();
  const desk = useDesk();
  const horses = useDataStore((s) => s.horses);
  const addHorse = useDataStore((s) => s.addHorse);
  const updateHorse = useDataStore((s) => s.updateHorse);
  const tariffs = useDataStore((s) => s.tariffs);

  // ?edit=<id> passe le formulaire en modification, prérempli.
  // ?proprietaire=Nom le préremplit ; ?retour=client ramène à sa fiche après.
  const editId = search.get("edit");
  const editing = editId ? horses.find((h) => h.id === editId) : undefined;
  const proprietaire = useDataStore((s) => nomDeLAdresse(search, s, "proprietaire")).trim();
  const retour = search.get("retour");
  // La flèche du haut : la fiche du cheval qu'on modifie, sinon la liste des chevaux.
  const poserParent = useParentIci((s) => s.poser);
  useEffect(() => {
    poserParent(editId ? `/ticket?id=${editId}` : retour === "client" && proprietaire ? adresseClient(proprietaire) : "/chevaux?vue=chevaux");
    return () => poserParent(null);
  }, [editId, retour, proprietaire, poserParent]);

  const [name, setName] = useState(editing?.name ?? "");
  const [breed, setBreed] = useState(editing?.breed ?? "");
  const [ownerName, setOwnerName] = useState(editing?.ownerName ?? proprietaire);
  // Le nom tapé sans toucher « + Nouveau » : il devient le propriétaire à l'enregistrement.
  const [tape, setTape] = useState("");
  const [coat, setCoat] = useState<Coat | undefined>(editing ? (editing.coat && editing.coat in COATS ? (editing.coat as Coat) : undefined) : "alezan");
  const [blaze, setBlaze] = useState<boolean | undefined>(editing?.blaze);
  const [formule, setFormule] = useState<string | undefined>(editing?.pensionType);
  // Un nouveau cheval arrive avec le tarif de la grille, modifiable ici.
  const [pension, setPension] = useState(montantEnTexte(editing ? editing.pension : tariffs?.pension));
  const [entryDate, setEntryDate] = useState(editing?.entryDate ?? localToday());
  const pensionNum = montantOuZero(pension);
  const others = horses.filter((h) => !h.isArchived && h.id !== editing?.id);

  function save() {
    if (!name.trim()) return;
    const say = useUiStore.getState().say;
    const common = {
      name: name.trim(),
      breed: breed.trim() || undefined,
      ownerName: ownerName.trim() || tape.trim() || undefined,
      pension: pensionNum > 0 ? pensionNum : undefined,
      pensionType: formule,
      coat,
      blaze,
      entryDate,
    };
    // Retour à la fiche du client, sous le nom tel qu'il est noté dans le carnet.
    const versClient = (hid: string) => {
      const nom = retour === "client" ? useDataStore.getState().horses.find((h) => h.id === hid)?.ownerName : undefined;
      return nom ? adresseClient(nom) : null;
    };
    if (editing) {
      updateHorse(editing.id, common);
      say("C’est enregistré.");
      // Depuis le chemin de l'accueil (?retour=accueil), on y revient pour le pas suivant.
      router.push(retour === "accueil" ? "/accueil" : (versClient(editing.id) ?? `/ticket?id=${editing.id}`));
      return;
    }
    // Le premier cheval ramène à l'accueil, pour que les premiers pas continuent.
    const isFirst = !horses.some((h) => !h.isArchived);
    const hid = addHorse({ ...common, exitDate: null });
    say(`<strong>${esc(common.name)}</strong> est dans ton écurie.`);
    router.push(versClient(hid) ?? (isFirst ? "/accueil" : "/chevaux"));
  }

  return (
    <Ecran wide={desk} className={desk ? "ch-desk ch-narrow" : undefined}>
      {editing && (
        <div className="hello rise" style={{ animationDelay: ".02s" }}>
          <h2>Modifier {editing.name}</h2>
        </div>
      )}
      <div className="ch-preview rise" style={{ animationDelay: ".04s" }}>
        <Portrait horse={{ id: editing?.id ?? "nouveau", name: name ? `Aperçu : ${name}, dans la robe choisie.` : "Aperçu : la tête du cheval dans la robe choisie.", coat }} />
      </div>
      <form
        className="form ch-form rise"
        style={{ animationDelay: ".12s" }}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span>Son nom</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Pacha" autoComplete="off" />
          {!editing && <em>Son nom suffit pour commencer. Tu pourras compléter le reste plus tard.</em>}
        </label>
        <ChoisirProprio value={ownerName} onChange={setOwnerName} onTape={setTape} />
        <div className="field" role="group" aria-label="Sa robe">
          <span>Sa robe</span>
          <div className="ch-sws">
            {COAT_KEYS.map((c) => (
              <button key={c} type="button" className="ch-sw" style={{ background: COATS[c].swatch }} aria-label={`Robe ${COATS[c].label.toLowerCase()}`} aria-pressed={coat === c} onClick={() => setCoat(c)} />
            ))}
            <span className="chips">
              <button type="button" className={`chip${blaze ? " on" : ""}`} aria-pressed={!!blaze} onClick={() => setBlaze(!blaze)}>
                Liste en tête
              </button>
            </span>
          </div>
        </div>
        <div className="field" role="group" aria-label="Sa formule de pension">
          <span>Sa formule de pension</span>
          <div className="chips">
            {FORMULES.map((f) => (
              <button key={f} type="button" className={`chip${formule === f ? " on" : ""}`} aria-pressed={formule === f} onClick={() => setFormule(formule === f ? undefined : f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Pension</span>
          <span className="input">
            <input
              type="text"
              inputMode="decimal"
              value={pension}
              onChange={(e) => setPension(saisieMontant(e.target.value))}
              placeholder="450"
              style={{ border: 0, background: "none", outline: "none", font: "inherit", flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" }}
            />
            <span className="u">€ / mois</span>
          </span>
          <em>{editing && montantOuZero(pension) !== (editing.pension ?? 0) ? "Le nouveau prix compte dès ce mois-ci. Les mois passés ne changent pas." : "Comptée chaque mois dans ce qui rentre. Tu ne la notes qu’une fois."}</em>
        </label>
        <label className="field">
          <span>
            Race <span className="ch-opt">facultatif</span>
          </span>
          <input className="input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Ex. Connemara" autoComplete="off" />
        </label>
        <label className="field">
          <span>Date d’arrivée</span>
          <input className="input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <em>{arriveeEnMots(entryDate, editing)}</em>
        </label>
        <button type="submit" className="btn full" disabled={!name.trim()}>
          <Ic n="ck" className="" />
          {editing ? "Enregistrer" : "Ajouter ce cheval"}
        </button>
      </form>
      {!editing && others.length > 0 && (
        <Sec nomarge title={`Dans ton écurie · ${others.length}`} delay={0.2}>
          <div className="ch-fpick">
            {others.map((h) => (
              <span key={h.id}>
                <Face horse={h} />
                {h.name}
              </span>
            ))}
          </div>
        </Sec>
      )}
      <div className="ch-after">
        <button type="button" className="btn line full" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
      <div className="end" />
    </Ecran>
  );
}
