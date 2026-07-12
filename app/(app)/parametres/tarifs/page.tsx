"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    </div>
  );
}
