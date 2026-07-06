"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { CareIcon } from "@/components/ed/care-bits";
import { useDataStore } from "@/stores/data-store";
import { CARE_META } from "@/lib/domain/care";
import { derivePeople } from "@/lib/domain/people";
import { LESSONS } from "@/content/lessons";
import { Explain } from "@/components/ed/explain";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * La recherche instantanée : un champ, tout le graphe. Chevaux, carnet,
 * journal, contacts, notions — filtrés en local à chaque frappe, zéro
 * latence perçue (esprit Superhuman).
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

function Recherche() {
  const router = useRouter();
  const data = useDataStore();
  const [q, setQ] = useState("");
  const nq = norm(q.trim());

  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";

  const results = useMemo(() => {
    if (nq.length < 2) return null;
    const hit = (...fields: (string | undefined)[]) =>
      fields.some((f) => f && norm(f).includes(nq));

    const horses = data.horses
      .filter((h) => !h.isArchived && hit(h.name, h.breed, h.ownerName))
      .slice(0, 6);
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
        sub: "Écurie",
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

  const empty =
    results &&
    results.horses.length +
      results.care.length +
      results.money.length +
      results.people.length +
      results.lessons.length ===
      0;

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-elevated px-4 py-1.5">
        <Search size={17} className="shrink-0 text-tertiary" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cheval, soin, dépense, contact, notion…"
          className="w-full bg-transparent py-2 text-[15px] text-primary outline-none"
        />
      </div>

      {!results ? (
        <p className="pt-6 text-center text-[13px] text-tertiary">
          Tape au moins deux lettres : tout le graphe est fouillé à chaque frappe.
        </p>
      ) : empty ? (
        <p className="pt-6 text-center text-[13px] text-tertiary">
          Rien pour « {q.trim()} ».
        </p>
      ) : (
        <div className="space-y-5">
          {results.horses.length > 0 && (
            <Group title="Chevaux">
              {results.horses.map((h) => (
                <Link key={h.id} href={`/cheval?id=${h.id}`} className="flex items-baseline justify-between py-2">
                  <span className="text-[15px] font-bold text-primary">{h.name}</span>
                  <span className="text-[12px] text-tertiary">
                    {h.breed}
                    {h.ownerName ? ` · ${h.ownerName}` : ""}
                  </span>
                </Link>
              ))}
            </Group>
          )}
          {results.care.length > 0 && (
            <Group title="Carnet">
              {results.care.map((e) => (
                <Link key={e.id} href={`/cheval?id=${e.horseId}`} className="flex items-center gap-2.5 py-2">
                  <span className="text-tertiary">
                    <CareIcon kind={e.kind} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-primary">
                    {CARE_META[e.kind].label} · {horseName(e.horseId)}
                  </span>
                  <span className="text-[12px] text-tertiary">
                    {e.date.slice(8, 10)}/{e.date.slice(5, 7)}/{e.date.slice(2, 4)}
                  </span>
                </Link>
              ))}
            </Group>
          )}
          {results.money.length > 0 && (
            <Group title="Journal">
              {results.money.map((m) => (
                <div key={m.id} className="flex items-baseline justify-between py-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-primary">
                    {m.label} <span className="font-normal text-tertiary">· {m.sub}</span>
                  </span>
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{ color: m.isIn ? "var(--c-success)" : "var(--text-primary)" }}
                  >
                    {m.isIn ? "+" : "−"}
                    {formatEur(m.amount)}
                  </span>
                </div>
              ))}
            </Group>
          )}
          {results.people.length > 0 && (
            <Group title="Contacts">
              {results.people.map((p) => (
                <Link key={p.name} href="/contacts" className="flex items-baseline justify-between py-2">
                  <span className="text-[14px] font-semibold text-primary">{p.name}</span>
                  <span className="text-[12px] text-tertiary">
                    {p.roles.map((r) => (r === "proprietaire" ? "Propriétaire" : "Prestataire")).join(" · ")}
                  </span>
                </Link>
              ))}
            </Group>
          )}
          {results.lessons.length > 0 && (
            <Group title="Notions">
              {results.lessons.map((l) => (
                <Explain key={l.key} k={l.key} variant="plain" className="block w-full py-2 text-left">
                  <span className="text-[14px] font-semibold text-primary">{l.title}</span>
                  <span className="block text-[12px] text-tertiary">{l.definition}</span>
                </Explain>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="title-serif mb-1 text-[18px] text-primary">{title}</h2>
      <div className="divide-y divide-[var(--border-default)] border-t border-[var(--border-default)]">
        {children}
      </div>
    </section>
  );
}
