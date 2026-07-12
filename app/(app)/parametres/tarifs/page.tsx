"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDataStore } from "@/stores/data-store";
import type { Tariffs } from "@/lib/domain/types";

/**
 * La grille tarifaire : tes prix, saisis une fois. Partout ailleurs
 * (composeur, vocal, nouveau cheval), le prix se remplit tout seul — et
 * reste modifiable au cas par cas : un tarif est un défaut, pas une cage.
 */
const ROWS: { key: keyof Tariffs; label: string; unit: string; hint: string }[] = [
  {
    key: "pension",
    label: "Pension",
    unit: "€ / mois",
    hint: "Proposée pour chaque nouveau cheval, puis postée toute seule chaque mois.",
  },
  {
    key: "cours_collectif",
    label: "Cours collectif",
    unit: "€ / cavalier",
    hint: "Attribuée à chaque cheval présent quand tu confirmes la séance.",
  },
  {
    key: "cours_individuel",
    label: "Cours individuel",
    unit: "€",
    hint: "",
  },
  {
    key: "entrainement",
    label: "Séance de travail",
    unit: "€",
    hint: "Le travail d'un cheval facturé à son propriétaire.",
  },
];

export default function TarifsPage() {
  return (
    <ClientGate>
      <Tarifs />
    </ClientGate>
  );
}

function Tarifs() {
  const tariffs = useDataStore((s) => s.tariffs) ?? {};
  const setTariff = useDataStore((s) => s.setTariff);
  const services = useDataStore((s) => s.services) ?? [];
  const addService = useDataStore((s) => s.addService);
  const deleteService = useDataStore((s) => s.deleteService);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  function saveService() {
    if (!newName.trim()) return;
    const p = Number(newPrice.replace(",", "."));
    addService({ name: newName, price: Number.isFinite(p) && p > 0 ? p : undefined });
    setNewName("");
    setNewPrice("");
  }

  return (
    <div className="space-y-6">
      <Link href="/parametres" className="inline-flex items-center gap-1 text-sm text-tertiary">
        <ChevronLeft size={16} /> Réglages
      </Link>
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-primary">
          Tes tarifs
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          Saisis-les une fois : partout ailleurs, le prix se remplit tout seul. Tu peux
          toujours le changer au cas par cas au moment de la saisie.
        </p>
      </div>

      <div className="divide-y rounded-[var(--radius-lg)] border bg-elevated px-4">
        {ROWS.map((row) => (
          <div key={row.key} className="py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-primary">{row.label}</span>
              <span className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-3 py-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={tariffs[row.key] ? String(tariffs[row.key]) : ""}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""));
                    setTariff(row.key, Number.isFinite(v) && v > 0 ? v : undefined);
                  }}
                  placeholder="—"
                  className="w-16 bg-transparent text-right text-sm tabular-nums text-primary outline-none"
                />
                <span className="whitespace-nowrap text-[12px] text-tertiary">{row.unit}</span>
              </span>
            </div>
            {row.hint && <p className="mt-1 text-[12px] text-tertiary">{row.hint}</p>}
          </div>
        ))}
      </div>

      <p className="text-[12px] text-tertiary">
        Un champ vide = pas de prix par défaut : tu saisiras le montant librement à chaque
        fois.
      </p>

      {/* Les prestations libres : les offres propres à cette écurie */}
      <div>
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-primary">
          Tes prestations
        </h2>
        <p className="mt-1 text-[13px] text-secondary">
          Balade, transport, débourrage, douche… Tes offres à toi : elles apparaissent
          dans « Quoi ? » quand tu ajoutes quelque chose au planning.
        </p>
      </div>

      <div className="divide-y rounded-[var(--radius-lg)] border bg-elevated px-4">
        {services.map((svc) => (
          <div key={svc.id} className="flex items-center justify-between gap-3 py-3.5">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
              {svc.name}
            </span>
            <span className="text-[13px] tabular-nums text-secondary">
              {svc.price ? `${svc.price.toLocaleString("fr-FR")} €` : "prix libre"}
            </span>
            <button
              onClick={() =>
                confirm(`Retirer « ${svc.name} » de tes prestations ?`) && deleteService(svc.id)
              }
              aria-label={`Retirer ${svc.name}`}
              className="shrink-0 p-1 text-tertiary hover:text-[var(--c-danger)]"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 py-3.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveService()}
            placeholder="Balade, transport…"
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-3 py-2 text-sm text-primary outline-none"
          />
          <span className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-base px-2.5 py-2">
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value.replace(/[^0-9,\.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && saveService()}
              inputMode="decimal"
              placeholder="—"
              className="w-10 bg-transparent text-right text-sm tabular-nums text-primary outline-none"
            />
            <span className="text-[12px] text-tertiary">€</span>
          </span>
          <button
            onClick={saveService}
            disabled={!newName.trim()}
            aria-label="Ajouter la prestation"
            className="btn-primary flex size-9 shrink-0 items-center justify-center text-[var(--on-accent)] disabled:opacity-40"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
