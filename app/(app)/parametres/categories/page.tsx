"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, X } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";

type Tab = "revenus" | "directes" | "mutualisees";

export default function CategoriesPage() {
  return (
    <ClientGate>
      <Categories />
    </ClientGate>
  );
}

function Categories() {
  const data = useDataStore();
  const addRevenueCategory = useDataStore((s) => s.addRevenueCategory);
  const addExpenseCategory = useDataStore((s) => s.addExpenseCategory);
  const deleteRevenueCategory = useDataStore((s) => s.deleteRevenueCategory);
  const deleteExpenseCategory = useDataStore((s) => s.deleteExpenseCategory);

  const [tab, setTab] = useState<Tab>("revenus");
  const [draft, setDraft] = useState("");

  const list =
    tab === "revenus"
      ? data.revenueCategories
      : data.expenseCategories.filter((c) =>
          tab === "directes" ? c.isDirect : !c.isDirect,
        );

  function add() {
    const name = draft.trim();
    if (!name) return;
    if (tab === "revenus") addRevenueCategory(name);
    else addExpenseCategory(name, tab === "directes");
    setDraft("");
  }

  function remove(catId: string) {
    if (tab === "revenus") deleteRevenueCategory(catId);
    else deleteExpenseCategory(catId);
  }

  return (
    <div className="space-y-5">
      <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Réglages
      </Link>
      <h1 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">
        Catégories
      </h1>
      <p className="-mt-3 text-[13px] text-tertiary">Les étiquettes que tu choisis quand tu notes de l&apos;argent. Ajoute les tiennes, retire celles qui ne te servent pas.</p>

      <div className="flex gap-1 card p-1 text-xs font-bold">
        {(
          [
            { v: "revenus", l: "Ce qui rentre" },
            { v: "directes", l: "Pour un cheval" },
            { v: "mutualisees", l: "Frais communs" },
          ] as { v: Tab; l: string }[]
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="flex-1 py-1.5 transition-colors"
            style={{
              background: tab === t.v ? "var(--accent-primary)" : "transparent",
              color: tab === t.v ? "var(--on-accent)" : "var(--text-tertiary)",
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Nom de la nouvelle catégorie"
          className="flex-1 rounded-[var(--radius-md)] border bg-elevated px-4 py-2.5 text-sm text-primary outline-none"
        />
        <button
          onClick={add}
          className="flex size-11 items-center justify-center btn-primary text-[var(--on-accent)]"
          aria-label="Ajouter cette catégorie"
        >
          <Plus size={18} />
        </button>
      </div>

      <ul className="divide-y rounded-[var(--radius-lg)] border bg-elevated px-4">
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-3">
            <span className="text-sm text-primary">{c.name}</span>
            <button
              onClick={() => remove(c.id)}
              className="text-tertiary transition-colors hover:text-[var(--c-danger)]"
              aria-label={`Retirer ${c.name}`}
            >
              <X size={16} />
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-center text-sm text-tertiary">Aucune catégorie ici. Tape un nom au-dessus pour en ajouter une.</li>
        )}
      </ul>
    </div>
  );
}
