"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { Empty, Ic, Money, Page as Ecran, Sec, ini } from "@/components/carnet/ui";
import { useDesk } from "@/components/bs/desk-hook";
import { useDataStore } from "@/stores/data-store";
import { derivePeople, type Person } from "@/lib/domain/people";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * Les personnes de l'écurie, dérivées du graphe : propriétaires (cités par
 * les chevaux) et prestataires (cités par le carnet). Rien à saisir ici :
 * chaque acte noté ailleurs enrichit ce répertoire tout seul.
 */
export default function ContactsPage() {
  return (
    <ClientGate>
      <Contacts />
    </ClientGate>
  );
}

function Contacts() {
  const data = useDataStore();
  const desk = useDesk();
  const people = useMemo(() => derivePeople(data), [data]);
  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  const pros = people.filter((p) => p.roles.includes("prestataire"));
  const owners = people.filter((p) => p.roles.includes("proprietaire"));

  const row = (p: Person, pro: boolean) => (
    <div key={p.name} className="li ct-row">
      {pro ? (
        <span className="ch-ico">
          <Ic n="syringe" className="" />
        </span>
      ) : (
        <span className="ini">{ini(p.name)}</span>
      )}
      <span style={{ minWidth: 0 }}>
        <b>{p.name}</b>
        <small>
          {p.roles.map((r) => (r === "proprietaire" ? "Propriétaire" : "Pro (soins)")).join(" · ")}
          {p.actCount > 0 && ` · ${p.actCount} soin${p.actCount > 1 ? "s" : ""}`}
          {!pro && p.totalBilled > 0 && ` · ${formatEur(p.totalBilled)}`}
        </small>
        {p.horseIds.length > 0 && (
          <span className="ch-tags">
            {p.horseIds.map((id) => (
              <Link key={id} href={`/ticket?id=${id}`}>
                {horseName(id)}
              </Link>
            ))}
          </span>
        )}
      </span>
      {pro && p.totalBilled > 0 ? <Money v={-p.totalBilled} /> : <span />}
    </div>
  );

  return (
    <Ecran wide={desk} className={desk ? "ch-desk ch-narrow" : undefined}>
      <div className="hello rise" style={{ animationDelay: ".04s" }}>
        {people.length > 0 && <p className="ch-over0">{people.length} personne{people.length > 1 ? "s" : ""}</p>}
        <h2>Contacts</h2>
        {people.length > 0 && <p>Les propriétaires de tes chevaux et les pros qui s’en occupent, comme le maréchal ou le véto. La liste se remplit au fur et à mesure.</p>}
      </div>

      {people.length === 0 ? (
        <Empty ill="vide-contacts">Personne pour l’instant. Note le propriétaire d’un cheval, ou un soin fait par un pro : son nom arrivera ici.</Empty>
      ) : (
        <>
          {pros.length > 0 && (
            <Sec ill="piste" title="Les pros" delay={0.12}>
              <div className="rows">{pros.map((p) => row(p, true))}</div>
              <p className="note">Chaque soin noté avec un pro apparaît ici, avec son coût.</p>
            </Sec>
          )}
          {owners.length > 0 && (
            <Sec ill="carnet-buste" title="Les propriétaires" action={<Link href="/clients">Tes clients</Link>} delay={0.2}>
              <div className="rows">{owners.map((p) => row(p, false))}</div>
            </Sec>
          )}
        </>
      )}
      <div className="end" />
    </Ecran>
  );
}
