"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDesk } from "@/components/bs/desk";
import { ClientGate } from "@/components/ui/client-gate";
import { Face, Ic, Money, Page as Ecran, Pill, Sec, Seg, eur, ini } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { billsFor } from "@/lib/domain/billing";
import { derivePeople } from "@/lib/domain/people";
import type { CareKind } from "@/lib/domain/care";
import type { PersonRole, StableData } from "@/lib/domain/types";

/**
 * Les clients : propriétaires et cavaliers. Pour chacun, ses chevaux, ses
 * séances du mois et ce qu'il doit. Un nom saisi dans une séance devient
 * un client tout seul. En dessous, les pros qui s'occupent des chevaux.
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Clients />
      </Suspense>
    </ClientGate>
  );
}

function Clients() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const say = useUiStore((s) => s.say);
  const q0 = useSearchParams().get("q") ?? "";
  const role0 = (data.people ?? []).find((p) => p.name === q0)?.role ?? "proprietaire";
  const [role, setRole] = useState<PersonRole>(role0);
  const [q, setQ] = useState(q0);
  const desk = useDesk();
  const [adding, setAdding] = useState("");
  const bills = useMemo(() => billsFor(data, active), [data, active]);
  const people = (data.people ?? []).filter((p) => p.active && p.role === role && (!q || p.name.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const mm = `${active.year}-${String(active.month).padStart(2, "0")}`;
  const total = (data.people ?? []).filter((p) => p.active).length;

  function add() {
    const n = adding.trim();
    if (!n) return;
    useDataStore.getState().ensurePerson(n, role);
    setAdding("");
    say(`${role === "proprietaire" ? "Propriétaire" : "Cavalier"} ajouté : <strong>${n.replace(/</g, "&lt;")}</strong>.`);
  }

  const details = (p: (typeof people)[number]) => {
    const horses = data.horses.filter((h) => !h.isArchived && h.ownerName === p.name);
    const ss = (data.seances ?? []).filter((x) => x.date.startsWith(mm) && x.status !== "cancelled" && x.participants.some((y) => y.personId === p.id));
    const rides = [...new Set(ss.flatMap((x) => x.participants.filter((y) => y.personId === p.id).map((y) => y.horseId)).filter(Boolean))]
      .map((id) => data.horses.find((h) => h.id === id))
      .filter((h): h is NonNullable<typeof h> => !!h);
    const bill = bills.find((b) => b.payer === p.name);
    return { horses, ss, rides, bill };
  };
  const tel = (p: (typeof people)[number]) => (
    <input
      className="ch-tel"
      defaultValue={p.phone ?? ""}
      placeholder="ajouter un numéro"
      aria-label={`Téléphone de ${p.name}`}
      inputMode="tel"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => useDataStore.getState().updatePerson(p.id, { phone: e.target.value.trim() || undefined })}
    />
  );

  const seg = (
    <Seg<PersonRole>
      value={role}
      onChange={setRole}
      label="Voir"
      options={[
        ["proprietaire", "Propriétaires"],
        ["cavalier", "Cavaliers"],
      ]}
    />
  );
  const search = (
    <label className="input ch-search">
      <Ic n="search" className="" />
      <input placeholder="Chercher un nom" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un client" />
    </label>
  );
  const titre = role === "proprietaire" ? "Ils ont un cheval chez toi" : "Ils montent en cours";
  const vide = <p className="note">Personne ici pour l’instant. Ajoute un nom en bas de la page.</p>;

  const ajout = (
    <Sec nomarge title={role === "proprietaire" ? "Ajouter un propriétaire" : "Ajouter un cavalier"}>
      <div className="ch-addrow">
        <input
          className="input"
          placeholder={role === "proprietaire" ? "Nom du propriétaire" : "Nom du cavalier"}
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Nom"
        />
        <button type="button" className="btn" onClick={add} aria-label={role === "proprietaire" ? "Ajouter ce propriétaire" : "Ajouter ce cavalier"}>
          <Ic n="plus" className="" />
        </button>
      </div>
    </Sec>
  );
  const facturer = (
    <div className="ch-after">
      <Link href="/argent?vue=facturer" className="btn line full">
        Voir ce que chacun doit payer
        <Ic n="arrow" className="" />
      </Link>
    </div>
  );

  if (desk) {
    return (
      <Ecran wide className="ch-desk">
        <div className="dhead rise">
          <div>
            <p className="k">{total} personnes</p>
            <h3>Mes clients</h3>
            <p>Les gens qui te paient : propriétaires et cavaliers. Pour chacun, ses chevaux et ce qu’il te doit ce mois.</p>
          </div>
          <Link href="/argent?vue=facturer" className="btn line">
            Voir ce que chacun doit payer
            <Ic n="arrow" className="" />
          </Link>
        </div>
        <div className="ch-bar2 rise" style={{ animationDelay: ".08s" }}>
          {seg}
          {search}
        </div>
        <div className="cols2 ch-cols">
          <div>
            <Sec nomarge title={titre} delay={0.14}>
              {people.length === 0 && vide}
            </Sec>
            {people.length > 0 && (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>{role === "proprietaire" ? "Chevaux" : "Monte"}</th>
                    <th className="n">Séances</th>
                    <th>Téléphone</th>
                    <th className="n">Ce mois</th>
                    <th className="n">Encore à payer</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const { horses, ss, rides, bill } = details(p);
                    const shown = role === "proprietaire" ? horses : rides;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="who">
                            <span className="ini">{ini(p.name)}</span>
                            {p.name}
                          </span>
                        </td>
                        <td>
                          <span className="ch-mini-heads">
                            {shown.map((h) => (
                              <Link key={h.id} href={`/ticket?id=${h.id}`} title={`Ticket de ${h.name}`}>
                                <Face horse={h} />
                                {h.name}
                              </Link>
                            ))}
                          </span>
                        </td>
                        <td className="n">{ss.length || ""}</td>
                        <td>{tel(p)}</td>
                        <td className="n">{bill ? eur(bill.total) : ""}</td>
                        <td className="n">{bill ? <Pill tone={bill.due <= 0 ? undefined : "ink"}>{bill.due <= 0 ? "payé" : eur(bill.due)}</Pill> : <span className="m">rien à payer</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {ajout}
          </div>
          <div className="ch-stick">
            <Pros data={data} />
          </div>
        </div>
        <div className="end" />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <div className="hello rise" style={{ animationDelay: ".04s" }}>
        <p className="ch-over0">{total} personnes</p>
        <h3>Mes clients</h3>
        <p>Les gens qui te paient. Pour chacun, ses chevaux et ce qu’il te doit ce mois.</p>
      </div>
      <div className="ch-bar rise" style={{ animationDelay: ".1s" }}>
        {seg}
        {search}
      </div>
      <Sec nomarge title={titre} delay={0.18}>
        {people.length === 0 && vide}
        <div className="rows ch-people">
          {people.map((p) => {
            const { horses, ss, bill } = details(p);
            const meta = [horses.map((h) => h.name).join(", "), ss.length ? `${ss.length} séance${ss.length > 1 ? "s" : ""} ce mois` : ""].filter(Boolean).join(" · ");
            return (
              <div key={p.id} className="li">
                <span className="ini">{ini(p.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <b>{p.name}</b>
                  {meta ? <small>{meta}</small> : !p.phone && <small>rien ce mois</small>}
                  {tel(p)}
                  {horses.length > 0 && (
                    <span className="ch-mini-heads">
                      {horses.map((h) => (
                        <Link key={h.id} href={`/ticket?id=${h.id}`} aria-label={`Ticket de ${h.name}`}>
                          <Face horse={h} />
                        </Link>
                      ))}
                    </span>
                  )}
                </span>
                <span className="ch-who-r">
                  {bill ? (
                    <>
                      <b>{eur(bill.total)}</b>
                      <Pill tone={bill.due <= 0 ? undefined : "ink"}>{bill.due <= 0 ? "payé" : `${eur(bill.due)} à payer`}</Pill>
                    </>
                  ) : (
                    <small>rien à facturer</small>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Sec>
      {ajout}
      {facturer}
      <Pros data={data} />
      <div className="end" />
    </Ecran>
  );
}

/** Le métier d'un pro, lu dans les soins qu'il a faits. */
const METIER: Partial<Record<CareKind, string>> = {
  ferrure: "maréchal",
  veto: "vétérinaire",
  vaccin: "vétérinaire",
  vermifuge: "vétérinaire",
  dentiste: "dentiste",
  osteo: "ostéopathe",
};

/** Les pros qui s'occupent des chevaux : la liste se remplit toute seule. */
function Pros({ data }: { data: StableData }) {
  const pros = useMemo(() => derivePeople(data).filter((p) => p.roles.includes("prestataire")), [data]);
  if (!pros.length) return null;
  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";
  const kindOf = (name: string) => {
    const counts = new Map<CareKind, number>();
    for (const e of data.careEvents ?? []) if (e.provider?.trim().toLowerCase() === name.toLowerCase()) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  return (
    <Sec ill="piste" title="Les pros" delay={0.3}>
      <div className="rows">
        {pros.map((p) => {
          const k = kindOf(p.name);
          const metier = (k && METIER[k]) || "pro";
          return (
            <div key={p.name} className="li">
              <span className="ch-ico">
                <Ic n={k === "ferrure" ? "shoe" : "syringe"} className="" />
              </span>
              <span style={{ minWidth: 0 }}>
                <b>{p.name}</b>
                <small>
                  {metier}
                  {p.actCount > 0 && ` · ${p.actCount} soin${p.actCount > 1 ? "s" : ""}`}
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
              {p.totalBilled > 0 ? <Money v={-p.totalBilled} /> : <span />}
            </div>
          );
        })}
      </div>
      <p className="note">La liste se remplit toute seule : chaque soin noté avec un pro l’ajoute ici.</p>
    </Sec>
  );
}
