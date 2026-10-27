"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Demande } from "@/components/bs/demandes-feuille";
import { Ill } from "@/components/carnet/ui";
import { useDemandes } from "@/lib/account/demandes";

/**
 * Demandes (27 octobre 2026) : son propre onglet, gratuit. Les cavaliers qui
 * écrivent depuis la fiche bestable.fr ; c'est ce qui fait revenir un gérant
 * gratuit. Les nouvelles restent marquées le temps de la lecture.
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
  return (
    <div className="cn-page rise" style={{ paddingBottom: 24 }}>
      <header className="ce-hd">
        <h1>Demandes</h1>
        <p>Les cavaliers qui t’écrivent depuis ta fiche sur bestable.fr.</p>
      </header>
      {etat === "inconnu" && patience ? null : etat !== "pret" || !fiche ? (
        <section className="ce-case" style={{ textAlign: "center", paddingTop: 18 }}>
          <Ill n="vide-contacts" style={{ width: 120, margin: "0 auto" }} />
          <h2 style={{ marginTop: 8 }}>Les demandes des cavaliers arriveront ici</h2>
          <p className="note">Quand un cavalier t’écrit depuis ta fiche, sa demande arrive ici et par e-mail. Il faut pour cela que ta fiche soit à ton nom.</p>
          <Link href="/ma-fiche" className="btn full">
            Voir ma fiche
          </Link>
        </section>
      ) : demandes.length === 0 ? (
        <section className="ce-case" style={{ textAlign: "center", paddingTop: 18 }}>
          <Ill n="vide-contacts" style={{ width: 120, margin: "0 auto" }} />
          <h2 style={{ marginTop: 8 }}>Pas encore de demande pour {fiche.title}</h2>
          <p className="note">Quand un cavalier t’écrit depuis ta fiche, sa demande arrive ici, sur l’accueil et par e-mail. Une fiche avec ses prix, ses places et des photos reçoit plus de demandes.</p>
          <Link href="/ma-fiche" className="btn full">
            Compléter ma fiche
          </Link>
        </section>
      ) : (
        <section className="ce-case">
          {demandes.map((d) => (
            <Demande key={d.id} d={d} nouvelle={!!nouvelles?.has(d.id)} ecurie={fiche.title} />
          ))}
        </section>
      )}
    </div>
  );
}
