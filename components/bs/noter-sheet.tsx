"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useDataStore } from "@/stores/data-store";
import { useUiStore, type AddMode, type NoteKindId } from "@/stores/ui-store";
import { HorseChips, InField, SeanceForm } from "@/components/bs/seance-form";
import { TaskForm } from "@/components/bs/task-form";
import { Chips, Face, Ic, Money, Seg, eur, sg } from "@/components/carnet/ui";
import { esc } from "@/components/bs/ui";
import { horseTicket } from "@/lib/domain/ticket";
import { interpretLocal } from "@/lib/domain/interpret";
import { distribute } from "@/lib/domain/distribution";
import { CARE_META, addDays, type CareKind } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import { currentPeriod } from "@/lib/utils/period";

/**
 * « Noter » : quoi, pour qui, combien, quand. Un soin ou un cours devient
 * un acte du carnet (et la dépense ou la recette liée) ; une recette ou une
 * dépense va au ticket du cheval ; une facture commune se partage entre
 * tous. Une date future planifie : l'acte attend sa confirmation.
 * Rendu en feuille du carnet, portée hors de la coque (iPhone).
 */
interface Kind {
  id: NoteKindId;
  label: string;
  money: "cost" | "revenue";
  scope: "horse" | "stable";
}
const KINDS: Kind[] = [
  { id: "ferrure", label: "Maréchal", money: "cost", scope: "horse" },
  { id: "veto", label: "Véto", money: "cost", scope: "horse" },
  { id: "vaccin", label: "Vaccin", money: "cost", scope: "horse" },
  { id: "vermifuge", label: "Vermifuge", money: "cost", scope: "horse" },
  { id: "osteo", label: "Ostéo", money: "cost", scope: "horse" },
  { id: "dentiste", label: "Dentiste", money: "cost", scope: "horse" },
  { id: "cours_individuel", label: "Cours", money: "revenue", scope: "horse" },
  { id: "concours", label: "Concours", money: "cost", scope: "horse" },
  { id: "recette", label: "Autre entrée d’argent", money: "revenue", scope: "horse" },
  { id: "depense", label: "Autre dépense", money: "cost", scope: "horse" },
  { id: "commune", label: "Frais communs", money: "cost", scope: "stable" },
];

type When = "today" | "yesterday" | "tomorrow" | "other";
type Done = { horseId?: string; sourceId?: string; text: string };

export function NoterSheet() {
  const open = useUiStore((s) => s.noterOpen);
  if (!open) return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <NoterInner />
    </div>,
    document.body,
  );
}

function NoterInner() {
  const prefill = useUiStore((s) => s.prefill);
  const close = useUiStore((s) => s.closeNoter);
  const say = useUiStore((s) => s.say);
  const markLine = useUiStore((s) => s.markLine);
  const data = useDataStore();
  const horses = useMemo(() => data.horses.filter((h) => !h.isArchived), [data.horses]);
  const today = localToday();

  const MONEY_KINDS: NoteKindId[] = ["recette", "depense", "commune"];
  const [mode, setMode] = useState<AddMode>(
    prefill.mode ?? (prefill.kind ? (MONEY_KINDS.includes(prefill.kind) ? "depense" : "soin") : prefill.horseIds?.length ? "soin" : "seance"),
  );
  const [kind, setKind] = useState<NoteKindId>(prefill.kind ?? (mode === "depense" ? "depense" : "ferrure"));
  const [horseIds, setHorseIds] = useState<string[]>(prefill.horseIds ?? []);
  const [amount, setAmount] = useState(prefill.amount ? String(prefill.amount) : "");
  const [when, setWhen] = useState<When>(prefill.date && prefill.date !== today ? "other" : "today");
  const [otherDate, setOtherDate] = useState(prefill.date ?? today);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("");
  const [catId, setCatId] = useState<string | undefined>();
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [done, setDone] = useState<null | Done>(null);
  const textRef = useRef<HTMLInputElement>(null);

  const K = KINDS.find((k) => k.id === kind) ?? KINDS[0];
  const value = parseFloat(amount.replace(",", ".")) || 0;
  const date = when === "today" ? today : when === "yesterday" ? addDays(today, -1) : when === "tomorrow" ? addDays(today, 1) : otherDate;
  const future = date > today;
  const isCare = !["recette", "depense", "commune"].includes(kind);
  const needHorse = K.scope === "horse";
  const ready = (needHorse ? horseIds.length > 0 : true) && (value > 0 || (isCare && future));

  const sharedCats = data.expenseCategories.filter((c) => !c.isDirect);
  const directCats = data.expenseCategories.filter((c) => c.isDirect);
  const revCats = data.revenueCategories.filter((c) => c.name !== "Pension");
  const catList = kind === "commune" ? sharedCats : kind === "depense" ? directCats : revCats;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // La page derrière ne défile pas tant que la feuille est ouverte.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
  }, [close]);

  const who = horseIds.length === 1 ? horses.find((h) => h.id === horseIds[0])?.name : horseIds.length > 1 ? `${horseIds.length} chevaux` : "";
  const cta = !ready
    ? needHorse && horseIds.length === 0
      ? "Choisis un cheval"
      : "Indique un montant"
    : `${future ? "Prévoir" : "Noter"}${needHorse ? ` pour ${who}` : ""}${value ? ` · ${sg(K.money === "revenue" ? value : -value)}` : ""}`;

  function applyHeard(text: string) {
    const r = interpretLocal(text, { horses: horses.map((h) => ({ id: h.id, name: h.name })), today });
    const bits: string[] = [];
    const c = r.command;
    if (c) {
      const k = c.kind === "cours_collectif" ? "cours_individuel" : c.kind;
      if (KINDS.some((x) => x.id === k)) setKind(k as NoteKindId);
      setHorseIds(c.horseIds);
      const v = c.cost ?? c.revenue;
      if (v) setAmount(String(v));
      if (c.date === today) setWhen("today");
      else if (c.date === addDays(today, -1)) setWhen("yesterday");
      else if (c.date === addDays(today, 1)) setWhen("tomorrow");
      else {
        setWhen("other");
        setOtherDate(c.date);
      }
      bits.push(CARE_META[c.kind].label, c.horseIds.map((id) => horses.find((h) => h.id === id)?.name).join(", "));
      if (v) bits.push(eur(v));
    } else {
      // Interprétation partielle : un montant et des chevaux suffisent à aider.
      const num = text.match(/(\d+(?:[.,]\d+)?)/);
      if (num) setAmount(num[1]);
    }
    setHeard(bits.length ? `Compris : <strong>${esc(bits.filter(Boolean).join(" · "))}</strong>` : r.missing.length ? `Il me manque ${esc(r.missing.join(" et "))}.` : "");
  }

  function listen() {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void; start: () => void };
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setHeard("La dictée n’est pas disponible sur ce navigateur : écris la phrase.");
      textRef.current?.focus();
      return;
    }
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      if (textRef.current) textRef.current.value = t;
      applyHeard(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  /** Le toast « c'est noté » avec son Annuler (supprime ce qui vient d'être ajouté). */
  function toastNoted(what: string, signedValue: number, undo: () => void) {
    const pour = who ? ` pour ${esc(who)}` : "";
    const tail = signedValue ? `, ${sg(signedValue)} sur ${horseIds.length > 1 ? "leurs tickets" : "son ticket"}` : "";
    say(`<strong>${esc(what)}${pour}</strong> : noté${tail}.`, () => {
      undo();
      close();
    });
  }

  function save() {
    if (!ready) return;
    const st = useDataStore.getState();
    const period = currentPeriod(new Date(date + "T12:00:00"));
    if (kind === "commune") {
      const cat = sharedCats.find((c) => c.id === catId) ?? sharedCats[0];
      const lbl = label.trim() || cat?.name || "Frais communs";
      st.addSharedExpense({
        categoryId: cat?.id,
        label: lbl,
        totalAmount: value,
        periodMonth: period.month,
        periodYear: period.year,
        distributionMode: "equal",
        source: "manual",
        allocations: distribute(value, horses, "equal", period),
      });
      setDone({ text: `${esc(lbl)} : ${eur(value)} partagés entre tes ${horses.length} chevaux, soit ${eur(value / Math.max(1, horses.length))} de plus sur chaque ticket.` });
      say(`<strong>${esc(lbl)}</strong> noté, partagé entre ${horses.length} chevaux.`);
      return;
    }
    if (kind === "recette" || kind === "depense") {
      const before = new Set([...st.revenues.map((r) => r.id), ...st.directExpenses.map((d) => d.id)]);
      let what = K.label;
      for (const hid of horseIds) {
        if (kind === "recette") {
          const cat = revCats.find((c) => c.id === catId) ?? revCats[0];
          what = label.trim() || cat?.name || what;
          st.addRevenue({ horseId: hid, categoryId: cat?.id, amount: value, date, note: label.trim() || undefined, source: "manual" });
        } else {
          const cat = directCats.find((c) => c.id === catId) ?? directCats[0];
          what = label.trim() || cat?.name || "Dépense";
          st.addDirectExpense({ horseId: hid, categoryId: cat?.id, label: label.trim() || cat?.name || "Dépense", amount: value, date, source: "manual" });
        }
      }
      const after = useDataStore.getState();
      const newRev = after.revenues.filter((x) => !before.has(x.id)).map((x) => x.id);
      const newDep = after.directExpenses.filter((x) => !before.has(x.id)).map((x) => x.id);
      const added = [...after.revenues, ...after.directExpenses].find((x) => !before.has(x.id) && x.horseId === horseIds[0]);
      if (added) markLine(horseIds[0], added.id);
      setDone({ horseId: horseIds[0], sourceId: added?.id, text: "" });
      toastNoted(what, kind === "recette" ? value : -value, () => {
        const s = useDataStore.getState();
        newRev.forEach((rid) => s.deleteRevenue(rid));
        newDep.forEach((eid) => s.deleteDirectExpense(eid));
      });
      return;
    }
    // Un acte du carnet : soin, cours, concours.
    const before = new Set((st.careEvents ?? []).map((e) => e.id));
    st.logCareMany(horseIds, {
      kind: kind as CareKind,
      date,
      start: time || undefined,
      label: label.trim() || undefined,
      cost: K.money === "cost" && value ? value : undefined,
      revenue: K.money === "revenue" && value ? value : undefined,
    });
    const created = (useDataStore.getState().careEvents ?? []).filter((e) => !before.has(e.id));
    if (future) {
      setDone({ text: `${CARE_META[kind as CareKind].label} prévu le ${new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}. Il apparaîtra dans ta journée ce jour-là. L’argent ira sur le ticket quand tu le cocheras.` });
      say(`<strong>${CARE_META[kind as CareKind].label}</strong> prévu.`);
      return;
    }
    const first = created.find((e) => e.horseId === horseIds[0]);
    const src = first?.expenseId ?? first?.revenueId;
    if (src) markLine(horseIds[0], src);
    setDone({ horseId: horseIds[0], sourceId: src, text: "" });
    toastNoted(CARE_META[kind as CareKind].label, value ? (K.money === "revenue" ? value : -value) : 0, () => {
      const s = useDataStore.getState();
      created.forEach((e) => s.deleteCareEvent(e.id));
    });
  }

  const doneHorse = done?.horseId ? horses.find((h) => h.id === done.horseId) ?? data.horses.find((h) => h.id === done.horseId) : undefined;
  const whens: When[] = kind === "commune" ? ["today"] : isCare ? ["yesterday", "today", "tomorrow", "other"] : ["yesterday", "today", "other"];
  const whenLabel: Record<When, string> = { today: kind === "commune" ? "Ce mois" : "Aujourd’hui", yesterday: "Hier", tomorrow: "Demain", other: "Autre jour" };

  return (
    <div className="sheet-wrap open">
      <div className="scrim" onClick={close} />
      <div className="sheet nt-sheet" role="dialog" aria-modal="true" aria-label={done ? "C’est noté" : "Noter"}>
        <div className="grab" />
        <div className="shd">
          {done ? (
            <b className="nt-okt">
              <span className="ck on" aria-hidden="true">
                <Ic n="ck" className="" />
              </span>
              {doneHorse ? `Noté pour ${horseIds.length > 1 ? `${horseIds.length} chevaux` : doneHorse.name}` : "C’est noté"}
            </b>
          ) : (
            <b>Noter</b>
          )}
          <button type="button" className="x" onClick={close} aria-label="Fermer">
            <Ic n="x" className="" />
          </button>
        </div>
        {!done && (
          <div className="pad">
            <Seg
              label="Ajouter"
              value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === "soin") setKind("ferrure");
                if (m === "depense") setKind("depense");
                setCatId(undefined);
              }}
              options={[
                ["seance", "Séance"],
                ["soin", "Soin"],
                ["tache", "Tâche"],
                ["depense", "Argent"],
              ]}
            />
          </div>
        )}
        {done ? (
          <DoneView done={done} count={horseIds.length} onClose={close} />
        ) : mode === "seance" ? (
          <SeanceForm onDone={close} date={prefill.date} start={prefill.start} prestationId={prefill.prestationId} />
        ) : mode === "tache" ? (
          <TaskForm onDone={close} />
        ) : (
          <div className="form nt-form">
            <div className="field">
              <span>{mode === "soin" ? "Quel soin ?" : "De l’argent qui rentre ou qui sort ?"}</span>
              <Chips
                value={kind}
                onChange={(k) => {
                  setKind(k);
                  setCatId(undefined);
                }}
                options={KINDS.filter((k) => (mode === "depense") === MONEY_KINDS.includes(k.id)).map((k) => [k.id, k.label] as [NoteKindId, string])}
              />
            </div>

            {(kind === "recette" || kind === "depense" || kind === "commune") && catList.length > 0 && (
              <div className="field">
                <span>{kind === "commune" ? "Quels frais ?" : "Quel genre ?"}</span>
                <Chips value={catId ?? catList[0]?.id ?? ""} onChange={setCatId} options={catList.map((c) => [c.id, c.name] as [string, string])} />
              </div>
            )}

            {needHorse ? (
              <div className="field">
                <span>Pour quel cheval ?</span>
                {horses.length > 0 ? (
                  <HorseChips horses={horses} value={horseIds} onChange={setHorseIds} />
                ) : (
                  <Link href="/saisie/cheval" className="lnk" onClick={close}>
                    Ajoute d’abord un cheval
                  </Link>
                )}
              </div>
            ) : (
              <p className="note">Les frais communs (foin, paille, loyer…) sont partagés entre tes {horses.length} chevaux. Chacun en prend sa part sur son ticket.</p>
            )}

            <label className="field">
              <span>{K.money === "revenue" ? "Combien ça rapporte ?" : "Combien ça coûte ?"}</span>
              <InField unit="€">
                <input id="bs-amt" inputMode="decimal" placeholder={isCare && future ? "facultatif" : "0"} value={amount} autoComplete="off" onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} onKeyDown={(e) => e.key === "Enter" && save()} />
              </InField>
            </label>

            <div className="field">
              <span>Quand ?</span>
              <Seg label="Date" value={when} onChange={setWhen} options={whens.map((w) => [w, whenLabel[w]] as [When, string])} />
              {when === "other" && <input className="input" type="date" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} aria-label="Choisir la date" />}
            </div>
            {isCare && (
              <label className="field">
                <span>Heure</span>
                <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
            )}

            <input className="input" placeholder={kind === "commune" ? "Ex. Foin d’octobre" : isCare ? "Un détail (facultatif) : « rappel grippe »" : "Un nom pour t’y retrouver (facultatif)"} value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Détail" />

            <button type="button" className="btn full" disabled={!ready} onClick={save}>
              {cta}
            </button>

            <div className="field">
              <InField className="nt-dict">
                <input ref={textRef} placeholder={mode === "soin" ? "Ou dis-le : « ferrure Pacha 85 euros »" : "Ou dis-le : « compléments Sirius 105 euros »"} aria-label="Dis-le en une phrase" onKeyDown={(e) => e.key === "Enter" && applyHeard((e.target as HTMLInputElement).value)} onBlur={(e) => e.target.value && applyHeard(e.target.value)} />
                <button type="button" onClick={listen} aria-label="Dicter" aria-pressed={listening} className="nt-mic">
                  <Ic n="mic" />
                </button>
              </InField>
              <p className="nt-say" aria-live="polite" dangerouslySetInnerHTML={{ __html: listening ? "J’écoute…" : heard }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const shortDate = (d?: string) => {
  if (!d) return undefined;
  if (d === localToday()) return "aujourd’hui";
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

function DoneView({ done, count, onClose }: { done: Done; count: number; onClose: () => void }) {
  const data = useDataStore();
  const horse = done.horseId ? data.horses.find((h) => h.id === done.horseId) : undefined;
  if (!horse) {
    return (
      <div className="pad nt-done">
        <p className="note" style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: done.text }} />
        <button type="button" className="btn full" onClick={onClose}>
          Fermer
        </button>
      </div>
    );
  }
  const t = horseTicket(data, horse.id, currentPeriod());
  const nouvelle = t.lines.find((l) => l.sourceId && l.sourceId === done.sourceId);
  return (
    <div className="pad nt-done">
      <div className="nt-tkh">
        <Face horse={horse} />
        <span>
          <b>Ticket de {horse.name} ce mois-ci</b>
          <small>ce qu’il rapporte et ce qu’il coûte</small>
        </span>
      </div>
      <div className="ticket">
        {t.lines.map((l) => (
          <div key={l.key} className={`r${l.sourceId && l.sourceId === done.sourceId ? " new" : ""}`}>
            <span>
              {l.label}
              {shortDate(l.date) && <small>{shortDate(l.date)}</small>}
            </span>
            <Money v={l.amount} />
          </div>
        ))}
        <div className="r tot">
          <span>{t.net >= 0 ? "Il te laisse" : "Il te coûte"}</span>
          <Money v={t.net} />
        </div>
      </div>
      <p className="note">
        {nouvelle ? `${nouvelle.label} est sur le ticket de ${horse.name}, et dans ton mois.` : `C’est sur le ticket de ${horse.name}, et dans ton mois.`}
        {count > 1 ? ` Pareil pour les ${count - 1} autres chevaux.` : ""}
      </p>
      <Link href={`/ticket?id=${horse.id}`} className="btn full" onClick={onClose}>
        Voir le ticket de {horse.name}
      </Link>
    </div>
  );
}
