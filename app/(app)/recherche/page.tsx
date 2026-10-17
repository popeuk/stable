"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";
import { CARE_META, type CareKind } from "@/lib/domain/care";
import { derivePeople } from "@/lib/domain/people";
import { LESSONS } from "@/content/lessons";
import { Explain } from "@/components/ed/explain";
import { Empty, Face, Ic, Money, Page, ini } from "@/components/carnet/ui";

/**
 * La recherche instantanée : un champ, tout le graphe. Chevaux, carnet,
 * argent, contacts, mots expliqués, filtrés en local à chaque frappe.
 */
export default function RecherchePage() {
  return (
    <ClientGate>
      <Recherche />
    </ClientGate>
  );
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Surligne la recherche dans un texte, accents compris. */
function hl(text: string | undefined, nq: string): ReactNode {
  if (!text || !nq) return text;
  let flat = "";
  const at: number[] = [];
  [...text].forEach((ch, i) => {
    for (const c of norm(ch)) {
      flat += c;
      at.push(i);
    }
  });
  const chars = [...text];
  const out: ReactNode[] = [];
  let from = 0;
  let k = flat.indexOf(nq);
  while (k !== -1) {
    const a = at[k];
    const b = at[k + nq.length - 1] + 1;
    if (a > from) out.push(chars.slice(from, a).join(""));
    out.push(<mark key={a}>{chars.slice(a, b).join("")}</mark>);
    from = b;
    k = flat.indexOf(nq, k + nq.length);
  }
  if (!out.length) return text;
  if (from < chars.length) out.push(chars.slice(from).join(""));
  return out.map((x, i) => <Fragment key={i}>{x}</Fragment>);
}

const careIcon = (k: CareKind) => (k === "ferrure" ? "shoe" : k === "vaccin" || k === "vermifuge" || k === "veto" ? "syringe" : "doc");

function Recherche() {
  const data = useDataStore();
  const [q, setQ] = useState("");
  const nq = norm(q.trim());

  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";

  const results = useMemo(() => {
    if (nq.length < 2) return null;
    const hit = (...fields: (string | undefined)[]) => fields.some((f) => f && norm(f).includes(nq));

    const horses = data.horses.filter((h) => !h.isArchived && hit(h.name, h.breed, h.ownerName)).slice(0, 6);
    const care = (data.careEvents ?? [])
      .filter((e) => hit(CARE_META[e.kind].label, e.label, e.provider, horseName(e.horseId)))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);
    const money = [
      ...data.revenues.map((r) => ({
        id: r.id,
        date: r.date,
        label: data.revenueCategories.find((c) => c.id === r.categoryId)?.name ?? "Revenu",
        sub: horseName(r.horseId),
        amount: r.amount,
        isIn: true,
      })),
      ...data.directExpenses.map((e) => ({
        id: e.id,
        date: e.date,
        label: e.label,
        sub: horseName(e.horseId),
        amount: e.amount,
        isIn: false,
      })),
      ...data.sharedExpenses.map((e) => ({
        id: e.id,
        date: `${e.periodYear}-${String(e.periodMonth).padStart(2, "0")}-01`,
        label: e.label,
        sub: "Frais de l’écurie",
        amount: e.totalAmount,
        isIn: false,
      })),
    ]
      .filter((m) => hit(m.label, m.sub))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);
    const people = derivePeople(data)
      .filter((p) => hit(p.name))
      .slice(0, 4);
    const lessons = Object.values(LESSONS)
      .filter((l) => hit(l.title, l.definition))
      .slice(0, 4);

    return { horses, care, money, people, lessons };
  }, [nq, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = results && results.horses.length + results.care.length + results.money.length + results.people.length + results.lessons.length === 0;
  const d8 = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
  const court = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  let delay = 0.04;
  const next = () => (delay += 0.06) - 0.06;

  return (
    <Page className="mt-find">
      <div className="pad" style={{ paddingTop: 14 }}>
        <label className="input mt-sfind">
          <Ic n="search" className="mt-ic" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un cheval, un soin, une dépense, un nom…" aria-label="Chercher" />
          {q && (
            <button type="button" className="x" onClick={() => setQ("")} aria-label="Effacer">
              <Ic n="x" className="" />
            </button>
          )}
        </label>
      </div>

      {!results ? (
        <Empty ill="carnet">Tape au moins deux lettres pour chercher dans toute ton écurie.</Empty>
      ) : empty ? (
        <Empty>Rien trouvé pour « {q.trim()} ». Essaie un autre mot.</Empty>
      ) : (
        <>
          {results.horses.length > 0 && (
            <Group title="Chevaux" delay={next()}>
              {results.horses.map((h) => (
                <Link key={h.id} href={`/ticket?id=${h.id}`} className="li">
                  <Face horse={h} />
                  <span>
                    <b>{hl(h.name, nq)}</b>
                    <small>{hl([h.breed, h.ownerName].filter(Boolean).join(" · "), nq)}</small>
                  </span>
                  <Ic n="chev" className="chev" />
                </Link>
              ))}
            </Group>
          )}
          {results.care.length > 0 && (
            <Group title="Carnet" delay={next()}>
              {results.care.map((e) => (
                <Link key={e.id} href={`/ticket?id=${e.horseId}`} className="li">
                  <span className="ini" aria-hidden="true">
                    <Ic n={careIcon(e.kind)} className="mt-ic" />
                  </span>
                  <span>
                    <b>{hl(`${CARE_META[e.kind].label} · ${horseName(e.horseId)}`, nq)}</b>
                    <small>{hl([d8(e.date), e.label, e.provider].filter(Boolean).join(" · "), nq)}</small>
                  </span>
                  <Ic n="chev" className="chev" />
                </Link>
              ))}
            </Group>
          )}
          {results.money.length > 0 && (
            <Group title="Argent" delay={next()}>
              {results.money.map((m) => (
                <div key={m.id} className="li">
                  <span className="ini" aria-hidden="true">
                    <Ic n="euro" className="mt-ic" />
                  </span>
                  <span>
                    <b>{hl(m.sub ? `${m.label} · ${m.sub}` : m.label, nq)}</b>
                    <small>{court(m.date)}</small>
                  </span>
                  <Money v={m.isIn ? m.amount : -m.amount} />
                </div>
              ))}
            </Group>
          )}
          {results.people.length > 0 && (
            <Group title="Contacts" delay={next()}>
              {results.people.map((p) => (
                <Link key={p.name} href="/contacts" className="li">
                  <span className="ini" aria-hidden="true">
                    {ini(p.name)}
                  </span>
                  <span>
                    <b>{hl(p.name, nq)}</b>
                    <small>
                      {[p.roles.map((r) => (r === "proprietaire" ? "Propriétaire" : "Pro (soins)")).join(" · "), p.horseIds.map(horseName).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <Ic n="chev" className="chev" />
                </Link>
              ))}
            </Group>
          )}
          {results.lessons.length > 0 && (
            <Group title="Mots expliqués" delay={next()}>
              {results.lessons.map((l) => (
                <Explain key={l.key} k={l.key} variant="plain" className="li mt-btnli">
                  <span className="ini" aria-hidden="true">
                    <Ic n="bulb" className="mt-ic" />
                  </span>
                  <span>
                    <b>{hl(l.title, nq)}</b>
                    <small>{hl(l.definition, nq)}</small>
                  </span>
                  <Ic n="chev" className="chev" />
                </Explain>
              ))}
            </Group>
          )}
        </>
      )}
      <div className="end" />
    </Page>
  );
}

function Group({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <section className="mt-rg rise" style={{ animationDelay: `${delay}s` }}>
      <p className="k">{title}</p>
      {children}
    </section>
  );
}
