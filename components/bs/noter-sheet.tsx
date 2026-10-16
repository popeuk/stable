"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore, type NoterPrefill } from "@/stores/ui-store";
import { CoursTiles, F, HorseChips, InField, Jours, Keypad, MoneyField, Puces, Q, Quand, SeanceDetails, Tiles, Wheel, hh, jourLabel, type SetD } from "@/components/bs/seance-form";
import { QuoiTiles, TaskDetails } from "@/components/bs/task-form";
import { Ic, Money, eur } from "@/components/carnet/ui";
import { applySoin, draftFor, draftFromCompris, endOf, habitudes, manque, titre, type AjoutType, type Draft, type Habitudes, type Pour } from "@/lib/domain/ajouter";
import { comprendre } from "@/lib/domain/dire";
import { norm } from "@/lib/domain/interpret";
import { distribute } from "@/lib/domain/distribution";
import { seriesDates } from "@/lib/domain/seances";
import type { CareKind } from "@/lib/domain/care";
import type { Frequency } from "@/lib/domain/types";
import { localToday } from "@/lib/utils/local-date";
import { currentPeriod } from "@/lib/utils/period";

/**
 * Le + : « Ajouter ». Un bouton foncé « Je préfère le dire » et quatre gros
 * boutons (Séance, Soin, Tâche ou rendez-vous, Argent). Rien ne démarre tout
 * seul. Après un bouton, deux questions avec les réponses habituelles déjà
 * cochées, chacune avec sa sortie libre ; « C’est bon » marche à tout moment
 * (seul l'argent demande un montant). À la voix, la phrase est comprise puis
 * montrée en puces à corriger d'un toucher. « Plus de détails » ouvre tout le
 * reste. Les cavaliers et les chevaux s'ajoutent après, depuis la séance.
 * Rendu en feuille du carnet, portée hors de la coque (iPhone).
 */
type Screen = "grid" | "listen" | "card" | "q" | "more";
type PickK = "type" | "cours" | "jour" | "h" | "pl" | "p" | "soin" | "cheval" | "quoi" | "sens" | "m" | "lab" | "pour";

const NB = " ";
const EXEMPLE = `Cours collectif demain 18${NB}h, 6 places`;
const TYPES: { id: AjoutType; l: string; s: string; i: string }[] = [
  { id: "seance", l: "Séance", s: "cours, balade, stage", i: "cal" },
  { id: "soin", l: "Soin", s: "maréchal, véto, vaccin", i: "syringe" },
  { id: "rdv", l: "Tâche ou rendez-vous", s: "avec ou sans heure", i: "clock" },
  { id: "argent", l: "Argent", s: "ça rentre, ça sort", i: "euro" },
];
const MOREH: Record<AjoutType, string> = {
  seance: "lieu, cavaliers, répétition…",
  soin: "qui vient, refacturer…",
  rdv: "rappel, répétition…",
  argent: "payé comment, notes…",
};
const POUR: [Pour, string][] = [
  ["cheval", "Un cheval"],
  ["ecurie", "L’écurie"],
  ["hors", "Rien à voir avec les chevaux"],
];
const HORS_DEF = { in: ["PAC", "Subvention", "Vente de foin"], out: ["Réparation du tracteur", "Carburant"] };
const COMMENT = ["Virement", "Chèque", "Espèces", "Carte"];
const MONEY_KINDS = ["recette", "depense", "commune"];

export function NoterSheet() {
  const open = useUiStore((s) => s.noterOpen);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <NoterInner />
    </div>,
    document.body,
  );
}

/** Ce que le + ouvre : la grille, ou directement les questions quand on vient d'un créneau, d'un ticket… */
function startFrom(p: NoterPrefill, h: Habitudes, today: string): { screen: Screen; d: Draft | null } {
  const base = { date: p.date, start: p.start, horseIds: p.horseIds, prestationId: p.prestationId, amount: p.amount };
  const money = (kind?: string) =>
    draftFor("argent", h, today, { ...base, sens: kind === "recette" ? "in" : "out", pour: kind === "commune" ? "ecurie" : p.horseIds?.length ? "cheval" : undefined });
  const care = p.kind && !MONEY_KINDS.includes(p.kind) ? (p.kind as CareKind) : undefined;
  if (p.mode === "seance") return { screen: "q", d: draftFor("seance", h, today, base) };
  if (p.mode === "soin") return { screen: "q", d: draftFor("soin", h, today, { ...base, care }) };
  if (p.mode === "tache") return { screen: "q", d: draftFor("rdv", h, today, base) };
  if (p.mode === "depense") return { screen: "q", d: money(p.kind) };
  if (p.kind && MONEY_KINDS.includes(p.kind)) return { screen: "q", d: money(p.kind) };
  if (care === "cours_collectif" || care === "cours_individuel") return { screen: "q", d: draftFor("seance", h, today, base) };
  if (care) return { screen: "q", d: draftFor("soin", h, today, { ...base, care }) };
  return { screen: "grid", d: null };
}

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
function makeRec(): Rec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Rec) | undefined;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "fr-FR";
  r.interimResults = true;
  r.continuous = false;
  return r;
}

function NoterInner() {
  const prefill = useUiStore((s) => s.prefill);
  const close = useUiStore((s) => s.closeNoter);
  const say = useUiStore((s) => s.say);
  const markLine = useUiStore((s) => s.markLine);
  const gerant = useSettingsStore((s) => s.gerant);
  const data = useDataStore();
  const today = localToday();
  const horses = useMemo(() => data.horses.filter((x) => !x.isArchived), [data.horses]);
  const h = useMemo(() => habitudes(data, today), [data, today]);

  const [init] = useState(() => startFrom(prefill, h, today));
  const [screen, setScreen] = useState<Screen>(init.screen);
  const [prev, setPrev] = useState<Screen>("q");
  const [d, setD] = useState<Draft | null>(init.d);
  const [pick, setPick] = useState<PickK | null>(null);
  const [other, setOther] = useState(false);
  const [tried, setTried] = useState(false);
  const [heard, setHeard] = useState("");
  // La dictée
  const recRef = useRef<Rec | null>(null);
  const textRef = useRef("");
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const [typed, setTyped] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // La page derrière ne défile pas tant que la feuille est ouverte.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
      const r = recRef.current;
      if (r) {
        r.onend = null;
        r.abort();
      }
    };
  }, [close]);

  // Chaque écran repart du haut ; seul « Plus de détails » défile.
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
  }, [screen]);

  const set: SetD = (f) => setD((x) => (x ? f(x) : x));
  const carry = prefill.horseIds ?? [];

  function choose(type: AjoutType) {
    setD(draftFor(type, h, today, { horseIds: carry, date: prefill.date }));
    setPick(null);
    setOther(false);
    setTried(false);
    setHeard("");
    setScreen("q");
  }

  /* ---------- La dictée ---------- */
  function understand(text: string) {
    const t = text.trim();
    if (!t) return;
    const c = comprendre(t, { today, horses: horses.map((x) => ({ id: x.id, name: x.name })), prestations: (data.prestations ?? []).filter((p) => p.active) });
    const nd = draftFromCompris(c, h, today);
    if (!nd.horseIds.length && carry.length && (nd.type === "soin" || nd.type === "argent")) {
      nd.horseIds = carry;
      if (nd.type === "argent" && nd.pour === "ecurie") nd.pour = "cheval";
    }
    setD(nd);
    setHeard(t);
    setPick(null);
    setOther(false);
    setTried(false);
    setScreen("card");
  }

  function abortRec() {
    const r = recRef.current;
    if (!r) return;
    r.onend = null;
    r.onresult = null;
    r.onerror = null;
    r.abort();
    recRef.current = null;
  }
  function listen() {
    abortRec();
    setScreen("listen");
    setLive("");
    setVoiceMsg("");
    textRef.current = "";
    const rec = makeRec();
    if (!rec) {
      setTyping(true);
      return;
    }
    recRef.current = rec;
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      textRef.current = txt;
      setLive(txt);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        setTyping(true);
        setVoiceMsg("Le micro n’est pas permis. Écris-le, ou touche le micro du clavier.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const t = textRef.current.trim();
      if (t) understand(t);
      else setVoiceMsg((m) => m || "Je n’ai rien entendu. Touche le micro pour recommencer.");
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      setTyping(true);
    }
  }
  function stopListening() {
    recRef.current?.stop();
  }
  function backToGrid() {
    abortRec();
    setListening(false);
    setPick(null);
    setOther(false);
    setScreen("grid");
  }

  /* ---------- Enregistrer ---------- */
  function commit() {
    if (!d) return;
    if (manque(d)) {
      setTried(true);
      if (screen === "card") setPick("m");
      return;
    }
    const st = useDataStore.getState();
    const snap = {
      seances: st.seances,
      careEvents: st.careEvents,
      revenues: st.revenues,
      directExpenses: st.directExpenses,
      sharedExpenses: st.sharedExpenses,
      recurringExpenses: st.recurringExpenses,
      recurringRevenues: st.recurringRevenues,
      tasks: st.tasks,
      prestations: st.prestations,
      people: st.people,
    };
    const undo = () => useDataStore.setState(snap);
    const name = titre(d, h);
    const notes = [d.qui.length && d.type === "seance" ? `Avec ${d.qui.join(", ")}` : "", d.notes.trim()].filter(Boolean).join(" · ") || undefined;

    if (d.type === "seance") {
      const custom = d.custom.trim();
      const hab = custom ? undefined : h.cours.find((c) => c.key === d.coursKey);
      let prestationId = hab?.prestationId;
      const format = hab?.format;
      if (!prestationId) {
        const known = (st.prestations ?? []).find((p) => custom && norm(p.label) === norm(custom));
        prestationId = known?.id ?? st.addPrestation({ label: custom || "Séance", price: d.price ?? 0 });
        if (known && !known.active) st.updatePrestation(known.id, { active: true });
      }
      const start = d.start ?? "18:00";
      const participants = d.cav.map((n, i) => {
        const owner = horses.find((x) => x.ownerName === n);
        return { personId: st.ensurePerson(n, owner ? "proprietaire" : "cavalier"), horseId: owner?.id ?? (d.horseIds.length ? d.horseIds[i % d.horseIds.length] : undefined) };
      });
      const hName = horses.find((x) => x.id === d.horseIds[0])?.name;
      st.addSeances(
        {
          prestationId,
          title: format === "particulier" && hName ? `Cours de ${hName}` : name,
          format,
          places: format === "collectif" ? (d.places ?? 6) : format === "particulier" ? 1 : (d.places ?? undefined),
          participants,
          horseIds: d.horseIds,
          start,
          end: endOf(start, d.dur),
          lieu: d.lieu.trim() || undefined,
          notes,
          unitPrice: d.price ?? 0,
          updatedBy: gerant,
        },
        seriesDates(d.date, d.rep, d.until),
      );
      close();
      say("C’est dans le planning.", undo);
      return;
    }

    if (d.type === "soin") {
      const start = d.start ?? "09:00";
      if (!d.horseIds.length) {
        // Un soin sans cheval (le maréchal passe jeudi) : un rendez-vous au planning.
        st.addTask({
          kind: "rdv",
          title: name,
          listId: d.listId ?? st.taskLists?.[0]?.id ?? "",
          labels: ["Chevaux"],
          forWho: [],
          due: `${d.date}T${start}`,
          lieu: d.provider.trim() || undefined,
          cost: d.price ?? undefined,
          notes: d.notes.trim() || undefined,
          createdBy: gerant,
        });
        close();
        say("C’est dans le planning.", undo);
        return;
      }
      const before = new Set((st.careEvents ?? []).map((e) => e.id));
      st.logCareMany(d.horseIds, {
        kind: d.care ?? "soin",
        date: d.date,
        start,
        label: d.custom.trim() || undefined,
        provider: d.provider.trim() || undefined,
        cost: d.price ?? undefined,
        note: d.notes.trim() || undefined,
        // Refacturer : tout de suite si le soin est fait, sinon quand il comptera.
        refacturer: d.refac || undefined,
      });
      const created = (useDataStore.getState().careEvents ?? []).filter((e) => !before.has(e.id));
      const first = created.find((e) => e.expenseId);
      if (first?.expenseId) markLine(first.horseId, first.expenseId);
      close();
      say("C’est dans le planning.", undo);
      return;
    }

    if (d.type === "rdv") {
      const lists = st.taskLists ?? [];
      const dates = seriesDates(d.date, d.rep === "biweekly" ? "weekly" : d.rep, d.until);
      const extra = [d.rappel && d.rappel !== "Pas de rappel" ? `Rappel : ${d.rappel.toLowerCase()}` : "", d.notes.trim()].filter(Boolean).join("\n") || undefined;
      for (const date of dates) {
        st.addTask({
          kind: d.start ? "rdv" : "tache",
          title: name,
          listId: d.listId ?? lists[0]?.id ?? "",
          labels: d.labels,
          forWho: d.qui,
          due: d.start ? `${date}T${d.start}` : date,
          end: d.start && d.end && d.end > d.start ? d.end : undefined,
          lieu: d.lieu.trim() || undefined,
          cost: d.price ?? undefined,
          notes: extra,
          createdBy: gerant,
        });
      }
      close();
      say("C’est dans le planning.", undo);
      return;
    }

    // L'argent
    const v = d.amount;
    const inn = d.sens === "in";
    const chosen = d.pour === "cheval" ? d.horseIds : [];
    const pour: Pour = d.pour === "cheval" && !chosen.length ? (inn ? "hors" : "ecurie") : inn && d.pour === "ecurie" ? "hors" : d.pour;
    const label = d.label.trim();
    const cats = inn ? st.revenueCategories : pour === "ecurie" ? st.expenseCategories.filter((c) => !c.isDirect) : st.expenseCategories.filter((c) => c.isDirect);
    const cat = cats.find((c) => norm(c.name) === norm(label));
    const note = [d.comment ? `Payé par ${d.comment.toLowerCase()}` : "", d.notes.trim()].filter(Boolean).join(" · ") || undefined;
    const freq: Frequency | null = d.moneyRep === "once" || pour === "hors" ? null : d.moneyRep;
    if (freq) {
      if (inn) chosen.forEach((horseId) => st.addRecurringRevenue({ horseId, categoryId: cat?.id, label: label || undefined, amount: v, frequency: freq, startDate: d.date, endDate: null, source: "manual" }));
      else if (pour === "ecurie") st.addRecurringExpense({ label: label || cat?.name || "Frais communs", amount: v, categoryId: cat?.id, isShared: true, distributionMode: "equal", frequency: freq, startDate: d.date, endDate: null, source: "manual" });
      else chosen.forEach((horseId) => st.addRecurringExpense({ label: label || cat?.name || "Dépense", amount: v, categoryId: cat?.id, isShared: false, horseId, frequency: freq, startDate: d.date, endDate: null, source: "manual" }));
    } else if (pour === "hors") {
      if (inn) st.addRevenue({ horseId: "", amount: v, date: d.date, note: label || note, source: "manual" });
      else st.addDirectExpense({ horseId: "", label: label || "Hors chevaux", amount: v, date: d.date, note, source: "manual" });
    } else if (pour === "ecurie") {
      const period = currentPeriod(new Date(d.date + "T12:00:00"));
      st.addSharedExpense({
        categoryId: cat?.id,
        label: label || cat?.name || "Frais communs",
        totalAmount: v,
        periodMonth: period.month,
        periodYear: period.year,
        distributionMode: "equal",
        source: "manual",
        allocations: distribute(v, horses, "equal", period),
        note,
      });
    } else {
      const before = new Set([...st.revenues.map((r) => r.id), ...st.directExpenses.map((x) => x.id)]);
      for (const horseId of chosen) {
        if (inn) st.addRevenue({ horseId, categoryId: cat?.id, amount: v, date: d.date, note: [label, note].filter(Boolean).join(" · ") || undefined, source: "manual" });
        else st.addDirectExpense({ horseId, categoryId: cat?.id, label: label || cat?.name || "Dépense", amount: v, date: d.date, note, source: "manual" });
      }
      const after = useDataStore.getState();
      const added = [...after.revenues, ...after.directExpenses].find((x) => !before.has(x.id) && x.horseId === chosen[0]);
      if (added) markLine(chosen[0], added.id);
    }
    close();
    say("C’est dans ton mois.", undo);
  }

  /* ---------- Les morceaux d'écran ---------- */
  const typeOf = (t: AjoutType) => TYPES.find((x) => x.id === t)!;
  const providers = [...new Set([...(d?.provider ? [d.provider] : []), ...h.soins.map((s) => s.provider).filter((x): x is string => !!x), ...(data.team ?? []).filter((m) => m.role === "prestataire").map((m) => m.name)])];

  const labOptions = (x: Draft): string[] => {
    const uniq = (xs: string[]) => [...new Map(xs.filter(Boolean).map((s) => [norm(s), s])).values()];
    if (x.pour === "hors") {
      const past = x.sens === "in" ? data.revenues.filter((r) => !r.horseId && r.note).map((r) => r.note!) : data.directExpenses.filter((e) => !e.horseId).map((e) => e.label);
      return uniq([...past.reverse(), ...HORS_DEF[x.sens]]).slice(0, 5);
    }
    if (x.sens === "in") return data.revenueCategories.filter((c) => c.name !== "Pension").map((c) => c.name);
    return data.expenseCategories.filter((c) => (x.pour === "ecurie" ? !c.isDirect : c.isDirect)).map((c) => c.name);
  };
  const labChips = (x: Draft, scroll?: boolean) => {
    const opts = labOptions(x);
    const isOther = other || (!!x.label && !opts.some((o) => norm(o) === norm(x.label)));
    return (
      <>
        <Puces
          scroll={scroll}
          options={opts.map((o) => [o, o] as [string, string])}
          value={isOther ? null : opts.find((o) => norm(o) === norm(x.label)) ?? null}
          onPick={(label) => {
            setOther(false);
            set((y) => ({ ...y, label: y.label === label ? "" : label, pour: /tracteur|pac\b/i.test(label) ? "hors" : y.pour }));
          }}
          extra={
            <button type="button" className={`chip${isOther ? " on" : ""}`} aria-pressed={isOther} onClick={() => setOther(true)}>
              Autre…
            </button>
          }
        />
        {isOther && (
          <label className="input nt-tin">
            <input autoFocus value={x.label} placeholder="Tape ce que c’est" aria-label="Tape ce que c’est" autoComplete="off" enterKeyHint="done" onChange={(e) => set((y) => ({ ...y, label: e.target.value }))} />
          </label>
        )}
      </>
    );
  };
  const pourChips = (x: Draft) => (
    <>
      <Puces
        scroll
        options={POUR.filter(([k]) => !(x.sens === "in" && k === "ecurie"))}
        value={x.sens === "in" && x.pour === "ecurie" ? "hors" : x.pour}
        onPick={(pour) => set((y) => ({ ...y, pour, label: pour !== y.pour && y.pour !== "hors" && pour !== "hors" ? "" : y.label, horseIds: pour === "cheval" ? y.horseIds : [] }))}
      />
      {x.pour === "cheval" && horses.length > 0 && (
        <div className="nt-gap">
          <HorseChips horses={horses} value={x.horseIds} onChange={(horseIds) => set((y) => ({ ...y, horseIds }))} />
        </div>
      )}
    </>
  );
  const soinTiles = (x: Draft) => (
    <Tiles
      options={h.soins.slice(0, 5).map((s) => ({ key: s.kind, label: s.label, sub: [s.price ? eur(s.price) : "", s.provider].filter(Boolean).join(" · ") || hh(s.start) }))}
      value={x.custom ? null : x.care}
      onPick={(k) => {
        setOther(false);
        set((y) => {
          const s = h.soins.find((z) => z.kind === k);
          const n = { ...y };
          if (s) applySoin(n, s);
          return n;
        });
        if (screen === "card") setPick(null);
      }}
      otherLabel="Autre soin…"
      otherOn={other || !!x.custom}
      onOther={() => setOther(true)}
      custom={x.custom}
      onCustom={(v) => set((y) => ({ ...y, custom: v, care: v.trim() ? "soin" : y.care }))}
      placeholder="Tape le soin"
    />
  );
  const habStart = (x: Draft) => (x.type === "seance" ? h.cours.find((c) => c.key === x.coursKey)?.start : x.type === "soin" ? h.soins.find((s) => s.kind === x.care)?.start : undefined);
  const habPrice = (x: Draft) => (x.type === "seance" ? h.cours.find((c) => c.key === x.coursKey)?.price : x.type === "soin" ? h.soins.find((s) => s.kind === x.care)?.price : undefined);

  const hourLine = (x: Draft) => {
    if (pick === "h")
      return (
        <div className="nt-pick nt-ph">
          <Wheel value={x.start} onPick={(start) => (set((y) => ({ ...y, start })), setPick(null))} taskChip={x.type === "rdv"} onTask={() => (set((y) => ({ ...y, start: null })), setPick(null))} />
        </div>
      );
    const lk = (t: string) => (
      <button type="button" className="lnk" onClick={() => setPick("h")}>
        {t}
      </button>
    );
    if (x.type === "rdv")
      return x.start == null ? (
        <p className="nt-hab">
          <span>Sans heure, c’est une tâche.</span> {lk("Mettre une heure")}
        </p>
      ) : (
        <p className="nt-hab">
          <span>
            À <b>{hh(x.start)}</b>, c’est un rendez-vous.
          </span>{" "}
          {lk("Autre heure")}
        </p>
      );
    const s = x.start ?? "09:00";
    return (
      <p className="nt-hab">
        <span>
          À <b>{hh(s)}</b>
          {habStart(x) === s ? ", comme d’habitude" : ""}.
        </span>{" "}
        {lk("Autre heure")}
      </p>
    );
  };
  const priceLine = (x: Draft) => {
    const lk = (t: string) => (
      <button type="button" className="lnk" onClick={() => setPick(pick === "p" ? null : "p")}>
        {t}
      </button>
    );
    return (
      <>
        <p className="nt-hab">
          {x.price ? (
            <span>
              {x.type === "seance" ? (
                <>
                  <b>
                    {eur(x.price)} la place
                  </b>
                  {x.places ? ` · ${x.places} place${x.places > 1 ? "s" : ""}` : ""}.
                </>
              ) : (
                <>
                  <Money v={-x.price} />
                  {habPrice(x) === x.price ? ", comme d’habitude" : ""}.
                </>
              )}
            </span>
          ) : (
            <span>{x.type === "seance" ? "Pas de prix pour l’instant" : "Sans prix."}</span>
          )}{" "}
          {lk(x.price ? "Autre montant" : "Ajouter un prix")}
        </p>
        {pick === "p" && (
          <div className="nt-pick">
            <Keypad value={x.price ?? 0} onChange={(n) => set((y) => ({ ...y, price: n || null }))} onOk={() => setPick(null)} />
          </div>
        )}
      </>
    );
  };
  const okBtn = () => (
    <>
      {tried && d && manque(d) && (
        <p className="nt-miss" role="alert">
          Il manque le montant.
        </p>
      )}
      <button type="button" className="btn full nt-ok" onClick={commit}>
        C’est bon
      </button>
    </>
  );

  /* ---------- Les écrans ---------- */
  let body: ReactNode = null;
  if (screen === "grid") {
    body = (
      <>
        <button type="button" className="nt-dire" onClick={listen}>
          <Ic n="mic" className="" />
          <span>
            <b>Je préfère le dire</b>
            <small>dis-le en une phrase, l’app prépare le reste</small>
          </span>
        </button>
        <div className="nt-four">
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => choose(t.id)}>
              <Ic n={t.i} className="" />
              <span>
                <b>{t.l}</b>
                <small>{t.s}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="nt-later">Tu pourras ajouter les cavaliers et les chevaux après.</p>
      </>
    );
  } else if (screen === "listen") {
    body = (
      <>
        <div className="nt-micw">
          <button type="button" className={`nt-bigmic${listening ? " on" : ""}`} onClick={listening ? stopListening : listen} aria-label={listening ? "J’ai fini" : "Parler"} aria-pressed={listening}>
            {listening && (
              <>
                <span className="nt-ring" />
                <span className="nt-ring r2" />
              </>
            )}
            <Ic n="mic" className="" />
          </button>
          <span className={`nt-wave${listening ? " on" : ""}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <p className="nt-sayit">Dis-le. C’est tout.</p>
          <p className={`nt-heard${live ? " live" : ""}`} aria-live="polite">
            {live ? (
              <>
                «{NB}
                {live}
                {listening && <i className="nt-caret" />}
                {NB}»
              </>
            ) : voiceMsg ? (
              voiceMsg
            ) : (
              `Ex. «${NB}${EXEMPLE}${NB}»`
            )}
          </p>
        </div>
        {typing && (
          <form
            className="nt-typed"
            onSubmit={(e) => {
              e.preventDefault();
              understand(typed);
            }}
          >
            <InField className="nt-tin">
              <input autoFocus value={typed} placeholder={`Ex. ${EXEMPLE}`} aria-label="Dis-le en une phrase" enterKeyHint="go" onChange={(e) => setTyped(e.target.value)} />
            </InField>
            <button type="submit" className="btn full" disabled={!typed.trim()}>
              C’est dit
            </button>
          </form>
        )}
        <div className="nt-alt">
          <button type="button" className="lnk" onClick={backToGrid}>
            Revenir au choix
          </button>
        </div>
      </>
    );
  } else if (d && screen === "card") {
    body = card();
  } else if (d && screen === "q") {
    body = questions(d);
  } else if (d && screen === "more") {
    body = more(d);
  }

  function card() {
    const x = d!;
    const t = typeOf(x.type);
    const J = { k: "jour" as PickK, l: jourLabel(x.date, today) };
    const horseName = x.horseIds.length === 1 ? horses.find((y) => y.id === x.horseIds[0])?.name : x.horseIds.length > 1 ? `${x.horseIds.length} chevaux` : "";
    const parts: { k: PickK; l: ReactNode; ph?: boolean }[] =
      x.type === "seance"
        ? [
            {
              k: "cours",
              l: (
                <>
                  {titre(x, h)}
                  {x.custom.trim() && <em>nouveau</em>}
                </>
              ),
            },
            J,
            { k: "h", l: hh(x.start ?? "18:00") },
            ...(x.places ? [{ k: "pl" as PickK, l: `${x.places} place${x.places > 1 ? "s" : ""}` }] : []),
            { k: "p", l: x.price ? `${eur(x.price)} la place` : "sans prix" },
          ]
        : x.type === "soin"
          ? [
              { k: "soin", l: titre(x, h) },
              { k: "cheval", l: horseName ? `pour ${horseName}` : "quel cheval ?", ph: !horseName },
              J,
              { k: "h", l: hh(x.start ?? "09:00") },
              { k: "p", l: x.price ? <Money v={-x.price} /> : "sans prix" },
            ]
          : x.type === "rdv"
            ? [{ k: "quoi", l: x.quoi.trim() || "c’est quoi ?", ph: !x.quoi.trim() }, J, { k: "h", l: x.start ? hh(x.start) : "sans heure" }]
            : [
                { k: "sens", l: x.sens === "in" ? "Ça rentre" : "Ça sort" },
                { k: "m", l: x.amount ? <Money v={x.sens === "in" ? x.amount : -x.amount} /> : "combien ?", ph: !x.amount },
                { k: "lab", l: x.label.trim() || "c’est quoi ?", ph: !x.label.trim() },
                { k: "pour", l: x.pour === "cheval" ? (horseName ? `pour ${horseName}` : "pour quel cheval ?") : x.pour === "ecurie" ? "pour l’écurie" : "rien à voir avec les chevaux", ph: x.pour === "cheval" && !horseName },
                J,
              ];
    const LBL: Record<PickK, string> = {
      type: "Ce n’est pas ça ?",
      cours: "Quel cours ?",
      jour: "Quel jour ?",
      h: "À quelle heure ?",
      pl: "Combien de places ?",
      p: x.type === "seance" ? "Combien la place ?" : "Combien ?",
      soin: "Quel soin ?",
      cheval: "Quel cheval ?",
      quoi: "C’est quoi ?",
      sens: "Ça rentre ou ça sort ?",
      m: "Combien ?",
      lab: "C’est quoi ?",
      pour: "C’est pour qui ?",
    };
    const close1 = () => setPick(null);
    const picker = (k: PickK): ReactNode => {
      if (k === "type")
        return (
          <Puces
            options={TYPES.map((y) => [y.id, y.l] as [AjoutType, string])}
            value={x.type}
            onPick={(type) => {
              if (type !== x.type) {
                const n = draftFor(type, h, today, { date: x.date, horseIds: x.horseIds });
                const said = x.label || x.quoi || x.custom;
                if (type === "rdv" && said) n.quoi = said;
                if (type === "argent") Object.assign(n, { label: said, amount: x.amount || x.price || 0 });
                if (type === "seance" && x.type === "rdv" && x.quoi) Object.assign(n, { coursKey: null, custom: x.quoi, price: null, places: null });
                if (x.start && type !== "argent") n.start = x.start;
                setD(n);
              }
              close1();
            }}
          />
        );
      if (k === "cours") return <CoursTiles d={x} set={set} h={h} other={other} setOther={setOther} onDone={close1} />;
      if (k === "soin") return soinTiles(x);
      if (k === "quoi") return <QuoiTiles d={x} set={set} h={h} other={other} setOther={setOther} onDone={close1} />;
      if (k === "jour") return <Jours date={x.date} today={today} onDate={(date) => (set((y) => ({ ...y, date })), close1())} />;
      if (k === "h") return <Wheel value={x.start} onPick={(start) => (set((y) => ({ ...y, start })), close1())} taskChip={x.type === "rdv"} onTask={() => (set((y) => ({ ...y, start: null })), close1())} />;
      if (k === "pl") return <Puces options={[1, 2, 4, 6, 8, 10].map((n) => [n, `${n} place${n > 1 ? "s" : ""}`] as [number, string])} value={x.places} onPick={(places) => (set((y) => ({ ...y, places })), close1())} />;
      if (k === "p") return <Keypad value={x.price ?? 0} onChange={(n) => set((y) => ({ ...y, price: n || null }))} onOk={close1} />;
      if (k === "m") return <Keypad value={x.amount} sens={x.sens} onChange={(amount) => (set((y) => ({ ...y, amount })), setTried(false))} onOk={close1} />;
      if (k === "cheval") return <HorseChips horses={horses} value={x.horseIds} onChange={(horseIds) => set((y) => ({ ...y, horseIds }))} />;
      if (k === "sens")
        return (
          <Puces
            options={[
              ["in", "Ça rentre"],
              ["out", "Ça sort"],
            ]}
            value={x.sens}
            onPick={(sens) => (set((y) => ({ ...y, sens: sens as "in" | "out", label: "" })), close1())}
          />
        );
      if (k === "lab") return labChips(x);
      return pourChips(x);
    };
    return (
      <>
        {heard && <p className="nt-quote">Tu as dit : «{NB}{heard}{NB}»</p>}
        <div className="card nt-got">
          <p className="k">C’est bien ça ?</p>
          <div className="nt-pzs">
            <button type="button" className={`nt-pz ty${pick === "type" ? " on" : ""}`} onClick={() => setPick(pick === "type" ? null : "type")}>
              {t.l}
            </button>
            {parts.map((p) => (
              <button key={p.k} type="button" className={`nt-pz${p.ph ? " ph" : ""}${pick === p.k ? " on" : ""}`} aria-expanded={pick === p.k} onClick={() => (setOther(false), setPick(pick === p.k ? null : p.k))}>
                {p.l}
              </button>
            ))}
          </div>
          <p className="nt-hint">Touche ce que tu veux changer.</p>
        </div>
        {pick && (
          <div className="nt-pick">
            <p className="nt-pl">{LBL[pick]}</p>
            {picker(pick)}
          </div>
        )}
        {okBtn()}
        <div className="nt-again">
          <button type="button" className="lnk" onClick={listen}>
            <Ic n="mic" className="" />
            Le redire
          </button>
          <button type="button" className="lnk" onClick={() => (setPrev("card"), setPick(null), setScreen("more"))}>
            Plus de détails
          </button>
          <button type="button" className="lnk" onClick={backToGrid}>
            Revenir au choix
          </button>
        </div>
      </>
    );
  }

  function questions(x: Draft) {
    const t = typeOf(x.type);
    let qs: ReactNode;
    if (x.type === "seance")
      qs = (
        <>
          <Q>Quel cours ?</Q>
          <CoursTiles d={x} set={set} h={h} other={other} setOther={setOther} />
          <Q>Quel jour ?</Q>
          <Quand date={x.date} today={today} onDate={(date) => set((y) => ({ ...y, date }))} />
          {hourLine(x)}
          {priceLine(x)}
        </>
      );
    else if (x.type === "soin")
      qs = (
        <>
          <Q>Quel soin ?</Q>
          {soinTiles(x)}
          {horses.length > 0 && (
            <>
              <Q em="si tu veux">Pour quel cheval ?</Q>
              <HorseChips horses={horses} value={x.horseIds} onChange={(horseIds) => set((y) => ({ ...y, horseIds }))} />
            </>
          )}
          <Q>Quel jour ?</Q>
          <Quand date={x.date} today={today} onDate={(date) => set((y) => ({ ...y, date }))} />
          {hourLine(x)}
          {priceLine(x)}
        </>
      );
    else if (x.type === "rdv")
      qs = (
        <>
          <Q>C’est quoi ?</Q>
          <QuoiTiles d={x} set={set} h={h} other={other} setOther={setOther} />
          <Q>Quel jour ?</Q>
          <Quand date={x.date} today={today} onDate={(date) => set((y) => ({ ...y, date }))} />
          {hourLine(x)}
        </>
      );
    else
      qs = (
        <>
          <div className="nt-q3 two">
            <button type="button" className={x.sens === "in" ? "on" : ""} aria-pressed={x.sens === "in"} onClick={() => set((y) => ({ ...y, sens: "in", label: y.sens === "in" ? y.label : "", pour: y.pour === "ecurie" ? "hors" : y.pour }))}>
              <span className="in">+</span>Ça rentre
            </button>
            <button type="button" className={x.sens === "out" ? "on" : ""} aria-pressed={x.sens === "out"} onClick={() => set((y) => ({ ...y, sens: "out", label: y.sens === "out" ? y.label : "" }))}>
              <span className="out">−</span>Ça sort
            </button>
          </div>
          <Keypad value={x.amount} sens={x.sens} onChange={(amount) => (set((y) => ({ ...y, amount })), setTried(false))} />
          <Q>C’est pour qui ?</Q>
          {pourChips(x)}
          <Q em="si tu veux">C’est quoi ?</Q>
          {labChips(x, true)}
        </>
      );
    return (
      <>
        <button type="button" className="nt-bk" onClick={backToGrid}>
          <Ic n="back" className="" />
          {t.l}
        </button>
        {qs}
        {okBtn()}
        <div className="nt-more2">
          <button type="button" className="lnk" onClick={() => (setPrev("q"), setPick(null), setScreen("more"))}>
            Plus de détails
          </button>
          <span>{MOREH[x.type]}</span>
        </div>
      </>
    );
  }

  function more(x: Draft) {
    let fields: ReactNode;
    if (x.type === "seance") fields = <SeanceDetails d={x} set={set} h={h} today={today} />;
    else if (x.type === "rdv") fields = <TaskDetails d={x} set={set} h={h} today={today} />;
    else if (x.type === "soin") {
      const owners = x.horseIds.some((id) => horses.find((y) => y.id === id)?.ownerName);
      fields = (
        <>
          <F label="Le soin">
            {soinTiles(x)}
          </F>
          {horses.length > 0 && (
            <F label="Quel cheval" hint="sans cheval, c’est un rendez-vous au planning">
              <HorseChips horses={horses} value={x.horseIds} onChange={(horseIds) => set((y) => ({ ...y, horseIds }))} />
            </F>
          )}
          <F label="Quel jour">
            <Jours date={x.date} today={today} onDate={(date) => set((y) => ({ ...y, date }))} />
          </F>
          <F label="À quelle heure">
            <Wheel value={x.start} onPick={(start) => set((y) => ({ ...y, start }))} />
          </F>
          <F label="Qui vient">
            <Puces options={providers.map((p) => [p, p] as [string, string])} value={x.provider} onPick={(provider) => set((y) => ({ ...y, provider: y.provider === provider ? "" : provider }))} />
            <InField className="nt-tin">
              <input placeholder="Ou tape un nom" aria-label="Qui vient" value={providers.includes(x.provider) ? "" : x.provider} onChange={(e) => set((y) => ({ ...y, provider: e.target.value }))} />
            </InField>
          </F>
          <F label="Prix">
            <MoneyField value={x.price} onChange={(price) => set((y) => ({ ...y, price }))} placeholder="Sans prix" label="Prix du soin" />
          </F>
          {owners && (
            <F label="Refacturer au propriétaire">
              <Puces
                options={[
                  ["oui", "Oui"],
                  ["non", "Non"],
                ]}
                value={x.refac ? "oui" : "non"}
                onPick={(v) => set((y) => ({ ...y, refac: v === "oui" }))}
              />
            </F>
          )}
          <F label="Notes">
            <textarea className="input ta nt-ta" rows={2} placeholder="Ex. Rappel grippe" aria-label="Notes" value={x.notes} onChange={(e) => set((y) => ({ ...y, notes: e.target.value }))} />
          </F>
        </>
      );
    } else {
      fields = (
        <>
          <F label="Ça rentre ou ça sort">
            <Puces
              options={[
                ["in", "Ça rentre"],
                ["out", "Ça sort"],
              ]}
              value={x.sens}
              onPick={(sens) => set((y) => ({ ...y, sens: sens as "in" | "out", label: y.sens === sens ? y.label : "" }))}
            />
          </F>
          <F label="Combien">
            <Keypad value={x.amount} sens={x.sens} onChange={(amount) => (set((y) => ({ ...y, amount })), setTried(false))} />
          </F>
          <F label="C’est pour qui">
            {pourChips(x)}
          </F>
          <F label="C’est quoi">
            {labChips(x)}
          </F>
          <F label="Quel jour">
            <Jours date={x.date} today={today} onDate={(date) => set((y) => ({ ...y, date }))} />
          </F>
          {x.pour !== "hors" && !(x.sens === "in" && x.pour !== "cheval") && (
            <F label="Répétition">
              <Puces
                options={[
                  ["once", "Une fois"],
                  ["monthly", "Chaque mois"],
                  ["quarterly", "Chaque trimestre"],
                  ["yearly", "Chaque année"],
                ]}
                value={x.moneyRep}
                onPick={(moneyRep) => set((y) => ({ ...y, moneyRep: moneyRep as Draft["moneyRep"] }))}
              />
            </F>
          )}
          <F label="Payé comment">
            <Puces options={COMMENT.map((c) => [c, c] as [string, string])} value={x.comment} onPick={(comment) => set((y) => ({ ...y, comment: y.comment === comment ? "" : comment }))} />
          </F>
          <F label="Notes">
            <textarea className="input ta nt-ta" rows={2} placeholder="Notes" aria-label="Notes" value={x.notes} onChange={(e) => set((y) => ({ ...y, notes: e.target.value }))} />
          </F>
        </>
      );
    }
    return (
      <>
        <button type="button" className="nt-bk" onClick={() => (setPick(null), setScreen(prev))}>
          <Ic n="back" className="" />
          Moins de détails
        </button>
        {fields}
        <div className="nt-stick">
          {okBtn()}
        </div>
      </>
    );
  }

  return (
    <div className="sheet-wrap open">
      <div className="scrim" onClick={close} />
      <div ref={sheetRef} className={`sheet nt-add${screen === "more" ? " nt-scrolls" : ""}`} role="dialog" aria-modal="true" aria-label="Ajouter">
        <div className="grab" />
        <div className="shd">
          <b>Ajouter</b>
          <button type="button" className="x" onClick={close} aria-label="Fermer">
            <Ic n="x" className="" />
          </button>
        </div>
        <div className="nt-body">{body}</div>
      </div>
    </div>
  );
}
