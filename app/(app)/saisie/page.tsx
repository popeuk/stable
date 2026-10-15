"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseChips, NoHorse } from "@/components/bs/seance-form";
import { Chips, Hello, Ic, Page, Seg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import type { Frequency } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";

/**
 * Le composeur : la saisie n'est pas un formulaire, c'est une phrase.
 * « Belle te rapporte 450 € chaque mois. » On tape le montant sur un pavé
 * dédié, on touche deux puces, c'est noté. Zéro champ texte, zéro friction.
 */

type Kind = "revenu" | "charge";
type Rythme = "once" | Frequency;

const RYTHMES: { v: Rythme; l: string; phrase: string }[] = [
  { v: "once", l: "Une fois", phrase: "" },
  { v: "monthly", l: "Chaque mois", phrase: "chaque mois" },
  { v: "quarterly", l: "Chaque trimestre", phrase: "chaque trimestre" },
  { v: "yearly", l: "Chaque année", phrase: "chaque année" },
];

export default function SaisiePage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <Composer />
      </Suspense>
    </ClientGate>
  );
}

function Composer() {
  const router = useRouter();
  const search = useSearchParams();
  const data = useDataStore();
  const addRevenue = useDataStore((s) => s.addRevenue);
  const addRecurringRevenue = useDataStore((s) => s.addRecurringRevenue);
  const addDirectExpense = useDataStore((s) => s.addDirectExpense);
  const addRecurringExpense = useDataStore((s) => s.addRecurringExpense);

  const horses = data.horses.filter((h) => !h.isArchived);
  const presetHorse = search.get("horse");

  const [kind, setKind] = useState<Kind>(search.get("kind") === "charge" ? "charge" : "revenu");
  const [raw, setRaw] = useState("");
  const [horseId, setHorseId] = useState<string | null>(presetHorse && horses.some((h) => h.id === presetHorse) ? presetHorse : null);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [rythme, setRythme] = useState<Rythme>(kind === "revenu" ? "monthly" : "once");
  const [date, setDate] = useState(localToday());

  const cats = useMemo(
    () => (kind === "revenu" ? data.revenueCategories : data.expenseCategories.filter((c) => c.isDirect)),
    [kind, data.revenueCategories, data.expenseCategories],
  );
  // Un revenu part sur Pension (l'écrasante majorité) ; une dépense n'a PAS
  // de catégorie imposée : le gérant choisit, sinon on n'enregistre pas.
  const cat = cats.find((c) => c.id === categoryId) ?? (kind === "revenu" ? cats[0] : undefined);
  const amount = Number(raw.replace(",", ".")) || 0;
  const horse = horses.find((h) => h.id === horseId);
  const canSave = amount > 0 && !!horse && !!cat;

  function press(key: string) {
    if (key === "back") return setRaw((r) => r.slice(0, -1));
    if (key === ",") {
      if (raw.includes(",") || raw === "") return;
      return setRaw((r) => r + ",");
    }
    // Digits: cap at 2 decimals, 6 integer digits.
    const [int = "", dec] = raw.split(",");
    if (dec !== undefined && dec.length >= 2) return;
    if (dec === undefined && int.length >= 6) return;
    setRaw((r) => (r === "0" ? key : r + key));
  }

  function save() {
    if (!canSave || !horse || !cat) return;
    useFlashStore.getState().setFlash({
      kind: kind === "revenu" ? "revenue" : "expense",
      amount,
      label: `${cat.name} · ${horse.name}`,
    });
    if (kind === "revenu") {
      if (rythme === "once") {
        addRevenue({ horseId: horse.id, categoryId: cat.id, amount, date, source: "manual" });
      } else {
        addRecurringRevenue({ horseId: horse.id, categoryId: cat.id, amount, frequency: rythme, startDate: date, endDate: null, source: "recurring" });
      }
    } else {
      if (rythme === "once") {
        addDirectExpense({ horseId: horse.id, categoryId: cat.id, label: cat.name, amount, date, source: "manual" });
      } else {
        addRecurringExpense({ label: cat.name, amount, categoryId: cat.id, isShared: false, horseId: horse.id, frequency: rythme, startDate: date, endDate: null, source: "manual" });
      }
    }
    router.push("/accueil");
  }

  // La phrase vivante.
  const rythmePhrase = RYTHMES.find((r) => r.v === rythme)!.phrase;
  const amountStr = amount > 0 ? `${raw.replace(".", ",")} €` : "… €";
  const horseStr = horse?.name ?? "…";
  const catStr = cat?.name ?? "…";

  return (
    <Page className="nt-page">
      <Hello title="Noter" sub="Une phrase, un montant, c’est noté." />
      <div className="pad rise" style={{ animationDelay: ".08s", marginTop: 12 }}>
        <Seg
          label="Ça rentre ou ça sort ?"
          value={kind}
          onChange={(v) => {
            setKind(v);
            setCategoryId(undefined);
            setRythme(v === "revenu" ? "monthly" : "once");
          }}
          options={[
            ["revenu", "Ça rentre"],
            ["charge", "Ça sort"],
          ]}
        />
      </div>

      <p className="nt-phrase" aria-live="polite">
        {kind === "revenu" ? (
          <>
            <P on={!!horse}>{horseStr}</P> te rapporte <P on={amount > 0}>{amountStr}</P>
            {rythmePhrase && <> {rythmePhrase}</>} <span className="faint">({catStr.toLowerCase()})</span>
          </>
        ) : (
          <>
            <P on={!!cat}>{catStr}</P> pour <P on={!!horse}>{horseStr}</P> te coûte <P on={amount > 0}>{amountStr}</P>
            {rythmePhrase && <> {rythmePhrase}</>}
          </>
        )}
        .
      </p>

      <div className="form nt-form rise" style={{ animationDelay: ".14s" }}>
        <div className="field">
          <span>{kind === "revenu" ? "Qui te le rapporte ?" : "Pour qui ?"}</span>
          {horses.length === 0 ? (
            <NoHorse text="Ajoute d’abord un cheval pour pouvoir noter ce qu’il rapporte ou coûte." />
          ) : (
            <>
              <HorseChips horses={horses} value={horseId ? [horseId] : []} onChange={(ids) => setHorseId(ids[0] ?? null)} multi={false} wrap />
              {kind === "charge" && (
                <div className="chips">
                  <Link href="/saisie/mutualisee" className="chip nt-dash">
                    Frais communs (toute l’écurie)
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        <div className="field">
          <span>C’est quoi ?</span>
          <Chips value={cat?.id ?? ""} onChange={setCategoryId} options={cats.map((c) => [c.id, c.name] as [string, string])} />
        </div>

        <div className="field">
          <span>{rythme === "once" ? "Quand ?" : "À partir de quand ?"}</span>
          <Chips value={rythme} onChange={setRythme} options={RYTHMES.map((r) => [r.v, r.l] as [Rythme, string])} />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={rythme === "once" ? "Date" : "À partir du"} />
        </div>

        <div className="nt-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"].map((k) => (
            <button key={k} type="button" onClick={() => press(k)} aria-label={k === "back" ? "Effacer" : k}>
              {k === "back" ? <Ic n="chevL" /> : k}
            </button>
          ))}
        </div>

        <button type="button" className="btn full" disabled={!canSave} onClick={save}>
          <Ic n="ck" className="" />
          Enregistrer
        </button>
        {!canSave && amount > 0 && horse && !cat && (
          <p className="note" role="alert">
            <b>Choisis ce que c’est (pension, soin…) pour pouvoir enregistrer.</b>
          </p>
        )}
        <button type="button" className="btn ghost nt-cancel" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </Page>
  );
}

function P({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <span className={on ? "" : "vide"}>{children}</span>;
}
