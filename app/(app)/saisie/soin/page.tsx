"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { HorseChips, InField, NoHorse } from "@/components/bs/seance-form";
import { Hello, Ic, Page, Switch, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useFlashStore } from "@/stores/flash-store";
import { CARE_KINDS, CARE_META, type CareKind } from "@/lib/domain/care";
import { weekdayOf, WEEKDAY_LABELS } from "@/lib/domain/rhythm";
import type { Tariffs } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";

/** Le tarif par défaut d'un acte facturable : la grille de Réglages. */
function tariffFor(t: Tariffs, k: CareKind): number | undefined {
  return k === "cours_collectif" || k === "cours_individuel" || k === "entrainement" ? t[k] : undefined;
}

/**
 * Ajouter au planning ou au carnet : un cours, une ferrure, un concours, un
 * rendez-vous. Un coût saisi crée la dépense liée, une recette suit la
 * feuille de présence, les actes à cadence replanifient automatiquement la
 * prochaine échéance, et la grille tarifaire préremplit les prix.
 */
export default function SaisieSoinPage() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <SoinComposer />
      </Suspense>
    </ClientGate>
  );
}

function SoinComposer() {
  const router = useRouter();
  const search = useSearchParams();
  const data = useDataStore();
  const logCareMany = useDataStore((s) => s.logCareMany);
  const addRhythm = useDataStore((s) => s.addRhythm);

  const horses = data.horses.filter((h) => !h.isArchived);
  const presetHorse = search.get("horse");
  // Préremplissage complet (le vocal et les liens profonds passent par là).
  const presetIds = (search.get("horses") ?? presetHorse ?? "").split(",").filter((hid) => horses.some((h) => h.id === hid));
  const presetKind = search.get("kind") as CareKind | null;
  const initialKind: CareKind = presetKind && CARE_KINDS.includes(presetKind) ? presetKind : "ferrure";
  const tariffs = data.tariffs ?? {};

  const services = data.services ?? [];
  const team = data.team ?? [];

  const [horseIds, setHorseIds] = useState<Set<string>>(() => new Set(presetIds));
  const [kind, setKind] = useState<CareKind>(initialKind);
  // La prestation choisie (balade, transport…) : un kind « prestation »
  // habillé du nom et du prix définis par le gérant.
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [date, setDate] = useState(search.get("date") ?? localToday());
  const [provider, setProvider] = useState(search.get("provider") ?? "");
  const [cost, setCost] = useState(search.get("cost") ?? "");
  // La recette : préremplie par la grille tarifaire tant que le gérant n'y a
  // pas touché. Un défaut, jamais une cage.
  const [revenue, setRevenue] = useState(() => search.get("revenue") ?? tariffFor(tariffs, initialKind)?.toString() ?? "");
  const [revenueEdited, setRevenueEdited] = useState(search.get("revenue") !== null);
  const [label, setLabel] = useState(search.get("label") ?? "");
  const [nextDue, setNextDue] = useState("");
  const [weekly, setWeekly] = useState(false);

  function pickKind(k: CareKind) {
    setKind(k);
    setServiceName(null);
    if (!revenueEdited) setRevenue(tariffFor(tariffs, k)?.toString() ?? "");
  }

  function pickService(name: string, price?: number) {
    setKind("prestation");
    setServiceName(name);
    setLabel(name);
    if (!revenueEdited) setRevenue(price?.toString() ?? "");
  }

  const selected = horses.filter((h) => horseIds.has(h.id));
  const allSelected = selected.length === horses.length && horses.length > 0;
  const today = localToday();
  const isPlanned = date > today;
  // Les actes facturables : cours, concours (gains), travail et prestations.
  const billable = kind === "cours_collectif" || kind === "cours_individuel" || kind === "concours" || kind === "entrainement" || kind === "prestation";
  const canRepeat = kind === "cours_collectif" || kind === "cours_individuel" || kind === "entrainement" || kind === "prestation";
  const kindLabel = serviceName ?? CARE_META[kind].label;
  const costNum = Number(cost.replace(",", ".")) || 0;
  const revenueNum = Number(revenue.replace(",", ".")) || 0;
  const canSave = selected.length > 0;

  function save() {
    if (!canSave) return;
    logCareMany(
      selected.map((h) => h.id),
      {
        kind,
        date,
        provider: provider.trim() || undefined,
        label: label.trim() || undefined,
        cost: costNum > 0 ? costNum : undefined,
        revenue: billable && revenueNum > 0 ? revenueNum : undefined,
        nextDue: nextDue || undefined,
      },
    );
    // Le rythme : cette séance revient chaque semaine, générée toute seule.
    // La borne part de la date saisie : l'occurrence du jour vient d'être créée.
    if (weekly) {
      addRhythm({
        kind,
        weekday: weekdayOf(date),
        label: label.trim() || undefined,
        provider: provider.trim() || undefined,
        horseIds: selected.map((h) => h.id),
        revenue: billable && revenueNum > 0 ? revenueNum : undefined,
        cost: costNum > 0 ? costNum : undefined,
        active: true,
        materializedUntil: date,
      });
    }
    const who = selected.length === 1 ? selected[0].name : `${selected.length} chevaux`;
    useFlashStore.getState().setFlash({
      kind: "care",
      amount: costNum,
      label: `${kindLabel} · ${who}${isPlanned ? " (prévu)" : ""}`,
    });
    router.push(presetHorse ? `/ticket?id=${presetHorse}` : "/planning");
  }

  return (
    <Page className="nt-page">
      <Hello title="Noter un soin ou un cours" />
      <p className="nt-phrase" aria-live="polite">
        {kindLabel} pour{" "}
        <span className={selected.length ? "" : "vide"}>
          {selected.length === 0 ? "…" : selected.length <= 2 ? selected.map((h) => h.name).join(", ") : `${selected[0].name} +${selected.length - 1}`}
        </span>
        {costNum > 0 && <span className="out"> · {sg(-costNum)}</span>}
        {billable && revenueNum > 0 && <span className="in"> · {sg(revenueNum)}/cheval</span>}
        {isPlanned && (
          <span className="faint">
            , pour le {date.slice(8, 10)}/{date.slice(5, 7)}
          </span>
        )}
        {weekly && <span className="faint">, chaque {WEEKDAY_LABELS[weekdayOf(date)]}</span>}.
      </p>

      <div className="form nt-form rise" style={{ animationDelay: ".1s" }}>
        {/* Quoi : un cours, un soin, un concours, un rendez-vous… */}
        <div className="field">
          <span>Quoi ?</span>
          <div className="chips">
            {CARE_KINDS.filter((k) => k !== "prestation").map((k) => (
              <button key={k} type="button" className={`chip${kind === k ? " on" : ""}`} aria-pressed={kind === k} onClick={() => pickKind(k)}>
                {CARE_META[k].label}
              </button>
            ))}
            {/* Les prestations du gérant : ses propres offres, à son prix. */}
            {services.map((svc) => {
              const on = kind === "prestation" && serviceName === svc.name;
              return (
                <button key={svc.id} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => pickService(svc.name, svc.price)}>
                  {svc.name}
                </button>
              );
            })}
            <Link href="/parametres/tarifs" className="chip nt-dash">
              + Ajouter ta prestation
            </Link>
          </div>
        </div>

        {/* Quel cheval */}
        <div className="field">
          <span>Pour qui ?</span>
          {horses.length === 0 ? (
            <NoHorse text="Ajoute d’abord un cheval pour lui noter un soin ou un cours." />
          ) : (
            <>
              <div className="chips">
                <button type="button" className={`chip${allSelected ? " on" : ""}`} aria-pressed={allSelected} onClick={() => setHorseIds(allSelected ? new Set() : new Set(horses.map((h) => h.id)))}>
                  Tous
                </button>
              </div>
              <HorseChips horses={horses} value={[...horseIds]} onChange={(ids) => setHorseIds(new Set(ids))} wrap />
            </>
          )}
        </div>

        {/* Détails */}
        <div className="nt-two">
          <label className="field">
            <span>Quand ?</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>
              Combien ça t’a coûté ? <span className="nt-opt">facultatif</span>
            </span>
            <InField unit="€">
              <input type="text" inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9,.]/g, ""))} />
            </InField>
          </label>
        </div>

        {billable && (
          <label className="field">
            <span>
              {kind === "cours_collectif" ? "Combien ça te rapporte par cheval ?" : "Combien ça te rapporte ?"} <span className="nt-opt">facultatif</span>
            </span>
            <InField unit={kind === "cours_collectif" ? "€ / cheval" : "€"}>
              <input
                type="text"
                inputMode="decimal"
                placeholder={tariffFor(tariffs, kind)?.toString() ?? "25"}
                value={revenue}
                onChange={(e) => {
                  setRevenueEdited(true);
                  setRevenue(e.target.value.replace(/[^0-9,.]/g, ""));
                }}
              />
            </InField>
            <em>
              {!revenueEdited && tariffFor(tariffs, kind) ? "On a mis ton tarif habituel. Tu peux le changer juste pour cette fois. " : ""}
              Ce montant compte pour chaque cheval présent, une fois que tu as confirmé que la séance a eu lieu.
            </em>
          </label>
        )}

        {canRepeat && (
          <Switch on={weekly} onClick={() => setWeekly((w) => !w)}>
            <span className="nt-sw-txt">
              <b>Répéter chaque {WEEKDAY_LABELS[weekdayOf(date)]}</b>
              <small>La séance s’ajoutera toute seule au planning, chaque semaine.</small>
            </span>
          </Switch>
        )}

        {/* L'assignation : l'équipe en un tap, le champ libre en secours */}
        <div className="field">
          <span>
            Qui s’en occupe ? <span className="nt-opt">facultatif</span>
          </span>
          {team.length > 0 && (
            <div className="chips">
              {team.map((m) => (
                <button key={m.id} type="button" className={`chip${provider === m.name ? " on" : ""}`} aria-pressed={provider === m.name} onClick={() => setProvider(provider === m.name ? "" : m.name)}>
                  {m.name}
                  {m.job ? ` · ${m.job}` : ""}
                </button>
              ))}
            </div>
          )}
          <input className="input" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={team.length > 0 ? "Ou quelqu’un d’autre…" : "Dr Lavigne, M. Roche…"} aria-label="Qui s’en occupe ?" />
        </div>

        <label className="field">
          <span>
            Détail <span className="nt-opt">facultatif</span>
          </span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rappel grippe, 4 pieds…" />
        </label>

        <label className="field">
          <span>
            Prochain rendez-vous <span className="nt-opt">facultatif</span>
          </span>
          <input className="input" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
          <em>Si tu connais déjà la date du prochain (vaccin, maréchal…), note-la. Sinon, pour les soins réguliers, l’app calcule la prochaine date toute seule.</em>
        </label>

        {costNum > 0 && <p className="note">Ce coût sera ajouté aux dépenses de chaque cheval concerné. Tu n’as rien d’autre à noter.</p>}

        <button type="button" className="btn full" disabled={!canSave} onClick={save}>
          <Ic n="ck" className="" />
          Enregistrer
        </button>
        <button type="button" className="btn ghost nt-cancel" onClick={() => router.back()}>
          Annuler
        </button>
      </div>
    </Page>
  );
}
