"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { Page, eur, eurc } from "@/components/carnet/ui";
import { TeteVerte, Chiffres } from "@/components/da/tete-verte";
import { useDataStore } from "@/stores/data-store";
import { usePeriodStore } from "@/stores/period-store";
import { montantsParCategorie, tvaDuMois } from "@/lib/domain/tva";
import type { Category } from "@/lib/domain/types";

/**
 * Tes taux de TVA (27 novembre 2026, comme dans l'app du Clos) : chaque
 * montant est noté TVA comprise ; il suffit de dire le taux une fois, par
 * prestation et par catégorie (Pension, Cours, Foin…), pour que le Suivi
 * calcule la TVA à reverser. Un taux qui n'est pas dit n'est jamais deviné :
 * son montant reste à part. Le bon taux, c'est le comptable qui le dit.
 */
export default function Page_() {
  return (
    <ClientGate>
      <Taux />
    </ClientGate>
  );
}

const TAUX = [20, 10, 5.5, 0];
const dit = (t: number) => `${String(t).replace(".", ",")} %`;

function ChoixTaux({ value, onChange, label }: { value: number | null | undefined; onChange: (v: number | null) => void; label: string }) {
  return (
    <select className="da-tva-sel" aria-label={label} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
      <option value="">TVA ?</option>
      {TAUX.map((t) => (
        <option key={t} value={String(t)}>
          {dit(t)}
        </option>
      ))}
    </select>
  );
}

function Taux() {
  const data = useDataStore();
  const st = useDataStore.getState;
  const active = usePeriodStore((s) => s.active);
  const t = useMemo(() => tvaDuMois(data, active), [data, active]);
  const { recettes, frais } = useMemo(() => montantsParCategorie(data, active), [data, active]);
  const nom = new Date(active.year, active.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" });
  const prestations = (data.prestations ?? []).filter((p) => p.active);
  // Les catégories qui ont servi ce mois d'abord, puis les autres.
  const trier = (l: Category[], m: Map<string, number>) => [...l].sort((a, b) => (m.get(b.id) ?? 0) - (m.get(a.id) ?? 0) || a.name.localeCompare(b.name, "fr"));

  const ligne = (c: Category, m: Map<string, number>, kind: "recette" | "depense") => (
    <div key={c.id} className="da-tva-ligne">
      <span>
        <b>{c.name}</b>
        <small>{m.get(c.id) ? `${eur(Math.round(m.get(c.id)!))} en ${nom}` : `rien en ${nom}`}</small>
      </span>
      <ChoixTaux value={c.vatRate} label={`TVA de ${c.name}`} onChange={(v) => st().setCategoryVat(kind, c.id, v)} />
    </div>
  );

  return (
    <Page className="da-tva">
      <TeteVerte titre="Tes taux de TVA" sous="Tes montants sont notés TVA comprise : dis le taux une fois, le Suivi calcule le reste.">
        <Chiffres
          items={[
            { n: eur(Math.round(t.tvaCollectee)), l: `de TVA sur ce qui rentre en ${nom}` },
            { n: eur(Math.round(t.tvaDeductible)), l: "de TVA dans tes frais" },
            { n: eur(Math.abs(Math.round(t.aReverser))), l: t.aReverser >= 0 ? "à reverser" : "à récupérer" },
          ]}
        />
      </TeteVerte>

      {(t.recettesSansTaux > 0 || t.fraisSansTaux > 0) && (
        <p className="da-tva-reste">
          {t.recettesSansTaux > 0 && (
            <>
              <b>{eurc(t.recettesSansTaux)}</b> de recettes sans taux.{" "}
            </>
          )}
          {t.fraisSansTaux > 0 && (
            <>
              <b>{eurc(t.fraisSansTaux)}</b> de frais sans taux.{" "}
            </>
          )}
          Leur TVA n’est pas comptée tant que le taux n’est pas dit.
        </p>
      )}

      <section className="da-tva-sec">
        <h2>Ce que tu vends</h2>
        <p className="da-tva-aide">Le taux d’une prestation vaut pour ses séances ; celui d’une catégorie, pour tout le reste noté dessous.</p>
        <div className="da-tva-liste">
          {prestations.map((p) => (
            <div key={p.id} className="da-tva-ligne">
              <span>
                <b>{p.label}</b>
                <small>prestation · {p.price > 0 ? `${eurc(p.price)} la séance` : "prix de tes tarifs"}</small>
              </span>
              <ChoixTaux value={p.vatRate} label={`TVA de ${p.label}`} onChange={(v) => st().updatePrestation(p.id, { vatRate: v })} />
            </div>
          ))}
          {trier(data.revenueCategories, recettes).map((c) => ligne(c, recettes, "recette"))}
        </div>
      </section>

      <section className="da-tva-sec">
        <h2>Ce que tu paies</h2>
        <p className="da-tva-aide">Le taux compris dans ce que tu achètes : la TVA de tes frais se déduit de celle à reverser.</p>
        <div className="da-tva-liste">{trier(data.expenseCategories, frais).map((c) => ligne(c, frais, "depense"))}</div>
      </section>

      <p className="da-tva-note">
        Le bon taux dépend de ce que tu vends (pension, enseignement, location…) et de ton statut : demande-le à ton comptable. L’app ne le devine jamais.{" "}
        <Link href="/argent">Revenir au Suivi</Link>
      </p>
      <div className="end" />
    </Page>
  );
}
