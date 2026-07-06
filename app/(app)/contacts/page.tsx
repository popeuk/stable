"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, UserRound, Wrench } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";
import { derivePeople } from "@/lib/domain/people";
import { formatEur } from "@/lib/utils/format-currency";

/**
 * Les personnes de l'écurie, dérivées du graphe : propriétaires (cités par
 * les chevaux) et prestataires (cités par le carnet). Rien à saisir ici —
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
  const people = useMemo(() => derivePeople(data), [data]);
  const horseName = (id: string) => data.horses.find((h) => h.id === id)?.name ?? "";

  return (
    <div className="space-y-4">
      <Link href="/ecurie" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Mon écurie
      </Link>
      <header>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">Contacts</h1>
        <p className="mt-0.5 text-[13px] text-tertiary">
          Déduits de tes chevaux et de ton carnet, sans rien saisir.
        </p>
      </header>

      {people.length === 0 ? (
        <div className="card p-5 text-center">
          <p className="text-[15px] font-bold text-primary">Personne pour l&apos;instant.</p>
          <p className="mt-1 text-[13px] text-secondary">
            Renseigne le propriétaire d&apos;un cheval ou le prestataire d&apos;un soin : ils
            apparaîtront ici, reliés à tout le reste.
          </p>
        </div>
      ) : (
        <ul>
          {people.map((p, i) => (
            <motion.li
              key={p.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="border-b border-[var(--border-default)] py-3.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--bg-pressed)", color: "var(--text-secondary)" }}
                >
                  {p.roles.includes("prestataire") ? <Wrench size={16} /> : <UserRound size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-primary">{p.name}</p>
                  <p className="text-[12px] text-tertiary">
                    {p.roles
                      .map((r) => (r === "proprietaire" ? "Propriétaire" : "Prestataire"))
                      .join(" · ")}
                    {p.actCount > 0 && ` · ${p.actCount} acte${p.actCount > 1 ? "s" : ""}`}
                    {p.totalBilled > 0 && ` · ${formatEur(p.totalBilled)}`}
                  </p>
                </div>
              </div>
              {p.horseIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                  {p.horseIds.map((id) => (
                    <Link
                      key={id}
                      href={`/cheval?id=${id}`}
                      className="rounded-full border border-[var(--border-default)] px-2.5 py-0.5 text-[12px] font-semibold text-secondary"
                    >
                      {horseName(id)}
                    </Link>
                  ))}
                </div>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
