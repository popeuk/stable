"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Screen, Sec, eur } from "@/components/bs/ui";
import { Picto } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { useUiStore } from "@/stores/ui-store";
import { billsFor } from "@/lib/domain/billing";
import type { PersonRole } from "@/lib/domain/types";

/**
 * Les clients : propriétaires et cavaliers. Pour chacun, ses chevaux, ses
 * séances du mois et ce qu'il doit. Un nom saisi dans une séance devient
 * un client tout seul.
 */
export default function Page() {
  return (
    <ClientGate>
      <Clients />
    </ClientGate>
  );
}

const ini = (n: string) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

function Clients() {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const say = useUiStore((s) => s.say);
  const [role, setRole] = useState<PersonRole>("proprietaire");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState("");
  const bills = useMemo(() => billsFor(data, active), [data, active]);
  const people = (data.people ?? []).filter((p) => p.active && p.role === role && (!q || p.name.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const mm = `${active.year}-${String(active.month).padStart(2, "0")}`;

  function add() {
    const n = adding.trim();
    if (!n) return;
    useDataStore.getState().ensurePerson(n, role);
    setAdding("");
    say(`${role === "proprietaire" ? "Propriétaire" : "Cavalier"} ajouté : <strong>${n.replace(/</g, "&lt;")}</strong>.`);
  }

  return (
    <Screen>
      <div className="bs-over">
        <span>{(data.people ?? []).filter((p) => p.active).length} personnes</span>
      </div>
      <h1 className="bs-d bs-t1">Clients</h1>
      <div className="bs-seg">
        <button type="button" aria-pressed={role === "proprietaire"} onClick={() => setRole("proprietaire")}>
          Propriétaires
        </button>
        <button type="button" aria-pressed={role === "cavalier"} onClick={() => setRole("cavalier")}>
          Cavaliers
        </button>
      </div>
      <div className="bs-quick" style={{ marginTop: 12 }}>
        <input placeholder="Chercher un nom" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un client" />
      </div>
      <Sec>{role === "proprietaire" ? "Ceux qui ont un cheval en pension" : "Ceux qui montent en cours"}</Sec>
      {people.length === 0 && <p className="bs-p">Personne ici pour l’instant.</p>}
      {people.map((p) => {
        const horses = data.horses.filter((h) => !h.isArchived && h.ownerName === p.name);
        const seances = (data.seances ?? []).filter((s) => s.date.startsWith(mm) && s.status !== "cancelled" && s.participants.some((x) => x.personId === p.id));
        const bill = bills.find((b) => b.payer === p.name);
        return (
          <div key={p.id} className="bs-act">
            <span className="bs-ini">{ini(p.name)}</span>
            <span className="tx">
              <b>{p.name}</b>
              <span>
                {[
                  horses.length ? horses.map((h) => h.name).join(", ") : "",
                  seances.length ? `${seances.length} séance${seances.length > 1 ? "s" : ""} ce mois` : "",
                  p.phone ?? "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "rien ce mois"}
              </span>
              {horses.length > 0 && (
                <span style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {horses.map((h) => (
                    <Link key={h.id} href={`/ticket?id=${h.id}`} aria-label={`Ticket de ${h.name}`}>
                      <HorseFace horse={h} size={26} />
                    </Link>
                  ))}
                </span>
              )}
            </span>
            <span style={{ textAlign: "right" }}>
              {bill ? (
                <>
                  <b className="bs-amt">{eur(bill.total)}</b>
                  <br />
                  <span className={`bs-pill ${bill.due <= 0 ? "g" : "o"}`}>{bill.due <= 0 ? "payé" : `${eur(bill.due)} dus`}</span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>rien à facturer</span>
              )}
            </span>
          </div>
        );
      })}
      <Sec>Ajouter</Sec>
      <div className="bs-quick">
        <input placeholder={role === "proprietaire" ? "Nom du propriétaire" : "Nom du cavalier"} value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="Nom" />
        <button type="button" className="bs-chip" onClick={add} aria-label="Ajouter">
          <Picto name="plus" size={16} />
        </button>
      </div>
      <Link href="/argent?vue=facturer" className="bs-btn line" style={{ marginTop: 18 }}>
        Voir ce qu’il faut facturer
      </Link>
    </Screen>
  );
}
