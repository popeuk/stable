"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { useDesk } from "@/components/bs/desk-hook";
import { Hello, Ic, Page, eur } from "@/components/carnet/ui";
import { CLOS } from "@/lib/fonctions";
import { lireTableau, type LigneCheval } from "@/lib/domain/import-chevaux";
import { localToday } from "@/lib/utils/local-date";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Importer des chevaux depuis un tableau (version du Clos) : coller des lignes
 * d'Excel ou choisir un fichier CSV, voir ce qui sera ajouté, puis ajouter. Un
 * cheval déjà là (même nom) n'est pas ajouté une deuxième fois. Les
 * propriétaires deviennent des clients, comme avec « Ajouter un cheval ».
 */
export default function Page_() {
  return (
    <ClientGate>
      <Importer />
    </ClientGate>
  );
}

const dateCourte = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function Importer() {
  const router = useRouter();
  const desk = useDesk();
  const horses = useDataStore((s) => s.horses);
  const addHorse = useDataStore((s) => s.addHorse);
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState("");
  const lu = useMemo(() => (texte.trim() ? lireTableau(texte, horses) : null), [texte, horses]);
  const aAjouter = (lu?.lignes ?? []).filter((l) => !l.existe);

  if (!CLOS) {
    return (
      <Page>
        <Hello title="Cette page n’existe pas ici." />
      </Page>
    );
  }

  function importer() {
    const today = localToday();
    for (const l of aAjouter) {
      addHorse({
        name: l.name,
        ownerName: l.ownerName,
        pensionType: l.pensionType,
        pension: l.pension,
        breed: l.breed,
        entryDate: l.entryDate ?? today,
        exitDate: null,
      });
    }
    useUiStore.getState().say(`${aAjouter.length} cheva${aAjouter.length > 1 ? "ux ajoutés" : "l ajouté"} à ton écurie.`);
    router.push("/chevaux?vue=chevaux");
  }

  return (
    <Page wide={desk}>
      <h1 className="ar-sr">Importer des chevaux</h1>
      <Hello
        title="Importer tes chevaux depuis un tableau."
        sub="Copie les lignes dans Excel ou Numbers, en-têtes compris, et colle-les ici. Ou choisis un fichier CSV. Rien n’est ajouté avant que tu valides."
      />

      <div className="card im-carte rise" style={{ animationDelay: ".08s" }}>
        <p className="k">Les colonnes reconnues</p>
        <p className="im-cols">
          <b>Nom</b> (ou Cheval), <b>Propriétaire</b> (ou Client), <b>Formule</b>, <b>Pension</b> (ou Prix), <b>Arrivée</b>, <b>Race</b>. Seul le nom est obligatoire.
        </p>
        <p className="note">Formule « À moi » ou « À nous » : un cheval de l’écurie, sans pension. Sans date d’arrivée, il arrive aujourd’hui.</p>
      </div>

      <div className="card im-carte rise" style={{ animationDelay: ".12s" }}>
        <label className="field">
          <span>Colle ton tableau</span>
          <textarea
            className="input im-texte"
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              setFichier("");
            }}
            placeholder={"Cheval\tPropriétaire\tFormule\tPension\tArrivée\nPacha\tJulie P.\tPension travail\t590\t01/09/2024"}
            rows={6}
            spellCheck={false}
          />
        </label>
        <label className="btn line full im-fichier">
          <Ic n="doc" className="" />
          {fichier ? `Fichier : ${fichier}` : "Ou choisir un fichier CSV"}
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="ar-sr"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2_000_000) {
                setFichier("trop gros (2 Mo au plus)");
                return;
              }
              setFichier(f.name);
              setTexte(await f.text());
            }}
          />
        </label>
        <p className="note">Excel : Fichier, Enregistrer sous, format « CSV UTF-8 ».</p>
      </div>

      {lu && (
        <div className="card im-carte rise" style={{ animationDelay: ".04s" }}>
          <p className="k">
            {aAjouter.length} cheva{aAjouter.length > 1 ? "ux" : "l"} à ajouter
            {lu.lignes.length - aAjouter.length > 0 ? ` · ${lu.lignes.length - aAjouter.length} déjà là` : ""}
          </p>
          {lu.erreurs.length > 0 && (
            <ul className="im-erreurs" role="alert">
              {lu.erreurs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <ul className="im-liste">
            {lu.lignes.map((l) => (
              <Ligne key={l.ligne} l={l} />
            ))}
          </ul>
          <button type="button" className="btn full" style={{ marginTop: 14 }} disabled={!aAjouter.length} onClick={importer}>
            <Ic n="ck" className="" />
            {aAjouter.length ? `Ajouter ${aAjouter.length} cheva${aAjouter.length > 1 ? "ux" : "l"}` : "Rien de nouveau à ajouter"}
          </button>
        </div>
      )}

      <div className="pad rise" style={{ animationDelay: ".16s", marginTop: 16 }}>
        <Link href="/chevaux?vue=chevaux" className="btn line full">
          Revenir aux chevaux
        </Link>
      </div>
      <div className="end" />
    </Page>
  );
}

function Ligne({ l }: { l: LigneCheval }) {
  const details = [l.ownerName, l.pensionType, l.pension ? `${eur(l.pension)} par mois` : "", l.entryDate ? `arrivé le ${dateCourte(l.entryDate)}` : "", l.breed].filter(Boolean).join(" · ");
  return (
    <li className={`im-ligne${l.existe ? " existe" : ""}`}>
      <b>{l.name}</b>
      <span>{l.existe ? "déjà dans ton écurie : pas ajouté" : details || "le nom seul"}</span>
    </li>
  );
}
