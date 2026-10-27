"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic, Ill } from "@/components/carnet/ui";
import { quandDemande, useDemandes } from "@/lib/account/demandes";
import type { DemandeCavalier } from "@/lib/account/api";
import { useSettingsStore } from "@/stores/settings-store";
import "@/app/carnet/briques.css";

/**
 * Demandes (27 octobre 2026) : son propre onglet, gratuit ; c'est ce qui fait
 * revenir un gérant gratuit. À répondre puis Répondues. Répondre en deux gestes :
 * une réponse toute prête, que le gérant relit dans son e-mail avant d'envoyer
 * (l'app n'envoie rien elle-même). Le site ne sait pas encore qu'une demande a eu
 * sa réponse : l'appareil s'en souvient.
 */
export default function Page() {
  return (
    <ClientGate>
      <Demandes />
    </ClientGate>
  );
}

function Demandes() {
  const etat = useDemandes((s) => s.etat);
  const fiche = useDemandes((s) => s.fiche);
  const demandes = useDemandes((s) => s.demandes);
  const charger = useDemandes((s) => s.charger);
  const toutVoir = useDemandes((s) => s.toutVoir);
  const repondues = useSettingsStore((s) => s.repondues);
  const [vue, setVue] = useState<"a" | "r">("a");
  const [nouvelles, setNouvelles] = useState<Set<number> | null>(null);
  // Si le site ne répond pas, l'état vide s'affiche après un court instant plutôt qu'un écran blanc.
  const [patience, setPatience] = useState(true);
  useEffect(() => {
    void charger();
    const t = setTimeout(() => setPatience(false), 1500);
    return () => clearTimeout(t);
  }, [charger]);
  useEffect(() => {
    if (etat !== "pret" || nouvelles) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNouvelles(new Set(demandes.filter((d) => !d.vue).map((d) => d.id)));
    void toutVoir();
  }, [etat, demandes, nouvelles, toutVoir]);
  const aRepondre = demandes.filter((d) => !repondues.includes(d.id));
  const faites = demandes.filter((d) => repondues.includes(d.id));
  const liste = vue === "a" ? aRepondre : faites;

  return (
    <div className="cn-page rise" style={{ paddingBottom: 24 }}>
      <header className="ce-hd">
        <h1>Demandes</h1>
        <p>Les cavaliers qui t’écrivent depuis ta fiche sur bestable.fr.</p>
      </header>
      {etat === "inconnu" && patience ? null : etat !== "pret" || !fiche ? (
        <Vide titre="Les demandes des cavaliers arriveront ici" texte="Quand un cavalier t’écrit depuis ta fiche, sa demande arrive ici et par e-mail. Il faut pour cela que ta fiche soit à ton nom." bouton="Voir ma fiche" />
      ) : demandes.length === 0 ? (
        <Vide titre={`Pas encore de demande pour ${fiche.title}`} texte="Quand un cavalier t’écrit depuis ta fiche, sa demande arrive ici, sur l’accueil et par e-mail. Une fiche avec ses prix, ses places et des photos reçoit plus de demandes." bouton="Compléter ma fiche" />
      ) : (
        <>
          <div className="dm-seg" role="tablist" aria-label="Demandes">
            <button type="button" role="tab" aria-selected={vue === "a"} onClick={() => setVue("a")}>
              À répondre · {aRepondre.length}
            </button>
            <button type="button" role="tab" aria-selected={vue === "r"} onClick={() => setVue("r")}>
              Répondues · {faites.length}
            </button>
          </div>
          {liste.length === 0 ? (
            <p className="note" style={{ margin: "14px var(--gut) 0" }}>
              {vue === "a" ? "Tout le monde a sa réponse. Les nouvelles demandes arrivent ici et sur l’accueil." : "Tes réponses s’affichent ici."}
            </p>
          ) : (
            liste.map((d) => <Carte key={d.id} d={d} nouvelle={!!nouvelles?.has(d.id)} ecurie={fiche.title} repondue={repondues.includes(d.id)} />)
          )}
        </>
      )}
    </div>
  );
}

function Vide({ titre, texte, bouton }: { titre: string; texte: string; bouton: string }) {
  return (
    <section className="ce-case dm-vide">
      <Ill n="vide-contacts" />
      <h2>{titre}</h2>
      <p className="note">{texte}</p>
      <Link href="/ma-fiche" className="btn full">
        {bouton}
      </Link>
    </section>
  );
}

type Reponse = "place" | "visite" | "non";
const REPONSES: { k: Reponse; t: string }[] = [
  { k: "place", t: "Oui, une place" },
  { k: "visite", t: "Venez visiter" },
  { k: "non", t: "Pas de place" },
];

function texteReponse(k: Reponse, prenom: string, gerant: string): string {
  const bonjour = `Bonjour${prenom ? ` ${prenom}` : ""},`;
  const fin = gerant ? `\n\n${gerant}` : "";
  if (k === "place") return `${bonjour}\n\nOui, j’ai une place. Voulez-vous venir visiter l’écurie ? Dites-moi quel jour vous arrangerait.${fin}`;
  if (k === "visite") return `${bonjour}\n\nLe plus simple est de venir voir l’écurie. Quel jour vous arrangerait ?${fin}`;
  return `${bonjour}\n\nJe n’ai plus de place pour le moment. Je peux vous prévenir dès qu’une place se libère.${fin}`;
}

function Carte({ d, nouvelle, ecurie, repondue }: { d: DemandeCavalier; nouvelle: boolean; ecurie: string; repondue: boolean }) {
  const gerant = useSettingsStore((s) => s.gerant);
  const marquer = useSettingsStore((s) => s.marquerRepondue);
  const [k, setK] = useState<Reponse>("place");
  const prenom = (d.nom || "").split(" ")[0];
  const [texte, setTexte] = useState(() => texteReponse("place", prenom, gerant));
  const choisir = (r: Reponse) => {
    setK(r);
    setTexte(texteReponse(r, prenom, gerant));
  };
  const mail = d.email ? `mailto:${d.email}?subject=${encodeURIComponent(`Votre demande à ${ecurie}`)}&body=${encodeURIComponent(texte)}` : "";
  return (
    <article className="dm-carte">
      <div className="dm-hd">
        <b>
          {d.nom || "Un cavalier"}
          {nouvelle && <span className="dm-new">nouvelle</span>}
        </b>
        <small>{quandDemande(d.date)}</small>
      </div>
      {d.cherche && <p className="dm-ch">{d.cherche}</p>}
      {d.message && <p className="dm-msg">{d.message}</p>}
      {repondue ? (
        <p className="dm-ok">
          <Ic n="ck" className="" />
          <span>
            Réponse faite.{" "}
            <button type="button" className="lnk" onClick={() => marquer(d.id, false)}>
              Remettre à répondre
            </button>
          </span>
        </p>
      ) : (
        <div className="dm-rep">
          {d.email && (
            <>
              <div className="chips" role="group" aria-label="Ta réponse">
                {REPONSES.map((r) => (
                  <button key={r.k} type="button" className="chip" aria-pressed={k === r.k} onClick={() => choisir(r.k)}>
                    {r.t}
                  </button>
                ))}
              </div>
              <textarea rows={5} value={texte} onChange={(e) => setTexte(e.target.value)} aria-label="Ta réponse, à relire" />
            </>
          )}
          <div className="dm-act">
            {mail && (
              <a className="btn" href={mail} onClick={() => marquer(d.id, true)}>
                Répondre par e-mail
              </a>
            )}
            {d.telephone && (
              <a className="btn line" href={`tel:${d.telephone}`} onClick={() => marquer(d.id, true)}>
                Appeler
              </a>
            )}
          </div>
          <small className="dm-aide">Ta messagerie s’ouvre avec la réponse : tu la relis et tu l’envoies toi-même.</small>
        </div>
      )}
    </article>
  );
}
