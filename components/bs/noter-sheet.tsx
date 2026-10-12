"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/data-store";
import { useUiStore, type AddMode, type NoteKindId } from "@/stores/ui-store";
import { SeanceForm } from "@/components/bs/seance-form";
import { TaskForm } from "@/components/bs/task-form";
import { Picto, pictoForLabel, type PictoName } from "@/components/bs/picto";
import { HorseFace } from "@/components/bs/horse-face";
import { eur, signed, esc } from "@/components/bs/ui";
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
 */
interface Kind {
  id: NoteKindId;
  label: string;
  picto: PictoName;
  money: "cost" | "revenue";
  scope: "horse" | "stable";
}
const KINDS: Kind[] = [
  { id: "ferrure", label: "Maréchal", picto: "fer", money: "cost", scope: "horse" },
  { id: "veto", label: "Véto", picto: "veto", money: "cost", scope: "horse" },
  { id: "vaccin", label: "Vaccin", picto: "veto", money: "cost", scope: "horse" },
  { id: "vermifuge", label: "Vermifuge", picto: "pot", money: "cost", scope: "horse" },
  { id: "osteo", label: "Ostéo", picto: "main", money: "cost", scope: "horse" },
  { id: "dentiste", label: "Dentiste", picto: "dent", money: "cost", scope: "horse" },
  { id: "cours_individuel", label: "Cours", picto: "cours", money: "revenue", scope: "horse" },
  { id: "concours", label: "Concours", picto: "trophee", money: "cost", scope: "horse" },
  { id: "recette", label: "Autre entrée d’argent", picto: "euro", money: "revenue", scope: "horse" },
  { id: "depense", label: "Autre dépense", picto: "tag", money: "cost", scope: "horse" },
  { id: "commune", label: "Frais communs", picto: "foin", money: "cost", scope: "stable" },
];

type When = "today" | "yesterday" | "tomorrow" | "other";

export function NoterSheet() {
  const open = useUiStore((s) => s.noterOpen);
  if (!open) return null;
  return <NoterInner />;
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
  const [done, setDone] = useState<null | { horseId?: string; sourceId?: string; text: string }>(null);
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
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const who = horseIds.length === 1 ? horses.find((h) => h.id === horseIds[0])?.name : horseIds.length > 1 ? `${horseIds.length} chevaux` : "";
  const cta = !ready
    ? needHorse && horseIds.length === 0
      ? "Choisis un cheval"
      : "Indique un montant"
    : `${future ? "Prévoir" : "Noter"}${needHorse ? ` pour ${who}` : ""}${value ? ` · ${K.money === "revenue" ? "+" : ""}${eur(value)}` : ""}`;

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
      for (const hid of horseIds) {
        if (kind === "recette") {
          const cat = revCats.find((c) => c.id === catId) ?? revCats[0];
          st.addRevenue({ horseId: hid, categoryId: cat?.id, amount: value, date, note: label.trim() || undefined, source: "manual" });
        } else {
          const cat = directCats.find((c) => c.id === catId) ?? directCats[0];
          st.addDirectExpense({ horseId: hid, categoryId: cat?.id, label: label.trim() || cat?.name || "Dépense", amount: value, date, source: "manual" });
        }
      }
      const after = useDataStore.getState();
      const added = [...after.revenues, ...after.directExpenses].find((x) => !before.has(x.id) && x.horseId === horseIds[0]);
      if (added) markLine(horseIds[0], added.id);
      setDone({ horseId: horseIds[0], sourceId: added?.id, text: "" });
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
  }

  return (
    <>
      <div className="bs-scrim" onClick={close} />
      <div className="bs-sheet" role="dialog" aria-modal="true" aria-label="Ajouter">
        <div className="bs-grab" />
        <button type="button" className="bs-x" onClick={close} aria-label="Fermer">
          <Picto name="x" size={20} />
        </button>
        {!done && (
          <div className="bs-seg" aria-label="Ajouter" style={{ marginTop: 2, marginRight: 40 }}>
            {(
              [
                ["seance", "Séance"],
                ["soin", "Soin"],
                ["tache", "Tâche"],
                ["depense", "Argent"],
              ] as [AddMode, string][]
            ).map(([m, l]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  if (m === "soin") setKind("ferrure");
                  if (m === "depense") setKind("depense");
                  setCatId(undefined);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {done ? (
          <Done done={done} count={horseIds.length} onClose={close} />
        ) : mode === "seance" ? (
          <SeanceForm onDone={close} date={prefill.date} start={prefill.start} prestationId={prefill.prestationId} />
        ) : mode === "tache" ? (
          <TaskForm onDone={close} />
        ) : (
          <>
            <h2 className="bs-d bs-t2" style={{ marginTop: 14 }}>
              {mode === "soin" ? "Quel soin ?" : "De l’argent qui rentre ou qui sort ?"}
            </h2>
            <div className="bs-chips">
              {KINDS.filter((k) => (mode === "depense") === MONEY_KINDS.includes(k.id)).map((k) => (
                <button key={k.id} type="button" className="bs-chip" aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setCatId(undefined); }}>
                  <Picto name={k.picto} />
                  {k.label}
                </button>
              ))}
            </div>

            {(kind === "recette" || kind === "depense" || kind === "commune") && (
              <>
                <p className="bs-sec">{kind === "commune" ? "Quels frais ?" : "Quel genre ?"}</p>
                <div className="bs-chips">
                  {catList.map((c) => (
                    <button key={c.id} type="button" className="bs-chip" aria-pressed={(catId ?? catList[0]?.id) === c.id} onClick={() => setCatId(c.id)}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {needHorse ? (
              <>
                <p className="bs-sec">Pour quel cheval&nbsp;?</p>
                <div className="bs-faces">
                  {horses.map((h) => {
                    const on = horseIds.includes(h.id);
                    return (
                      <button key={h.id} type="button" className="bs-fpick" aria-pressed={on} onClick={() => setHorseIds(on ? horseIds.filter((x) => x !== h.id) : [...horseIds, h.id])}>
                        <span className="ring">
                          <HorseFace horse={h} size={40} />
                        </span>
                        {h.name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="bs-p" style={{ marginTop: 12 }}>
                Les frais communs (foin, paille, loyer…) sont partagés entre tes {horses.length} chevaux. Chacun en prend sa part sur son ticket.
              </p>
            )}

            <label className="bs-sec" htmlFor="bs-amt" style={{ display: "flex" }}>
              {K.money === "revenue" ? "Combien ça rapporte ?" : "Combien ça coûte ?"}
            </label>
            <div className="bs-field money">
              <input id="bs-amt" inputMode="decimal" placeholder={isCare && future ? "facultatif" : "0"} value={amount} autoComplete="off" onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} onKeyDown={(e) => e.key === "Enter" && save()} />
              <span>€</span>
            </div>

            <p className="bs-sec">Quand&nbsp;?</p>
            <div className="bs-seg" role="group" aria-label="Date">
              {(kind === "commune" ? (["today"] as When[]) : isCare ? (["yesterday", "today", "tomorrow", "other"] as When[]) : (["yesterday", "today", "other"] as When[])).map((w) => (
                <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)}>
                  {{ today: kind === "commune" ? "Ce mois" : "Aujourd’hui", yesterday: "Hier", tomorrow: "Demain", other: "Autre jour" }[w]}
                </button>
              ))}
            </div>
            {when === "other" && (
              <div className="bs-field">
                <input type="date" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} aria-label="Choisir la date" />
              </div>
            )}
            {isCare && (
              <label className="bs-field">
                <span>Heure</span>
                <input type="time" value={time} style={{ textAlign: "right" }} onChange={(e) => setTime(e.target.value)} />
              </label>
            )}

            {(kind === "recette" || kind === "depense" || kind === "commune" || isCare) && (
              <div className="bs-field" style={{ marginTop: 10 }}>
                <input placeholder={isCare ? "Un détail (facultatif) : « rappel grippe »" : "Un nom pour t’y retrouver (facultatif)"} value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Détail" />
              </div>
            )}

            <button type="button" className="bs-btn" style={{ marginTop: 14 }} disabled={!ready} onClick={save}>
              {cta}
            </button>

            <div className="bs-field" style={{ marginTop: 10, paddingRight: 6 }}>
              <input ref={textRef} placeholder="Ou dis-le : « ferrure Pacha 85 euros »" aria-label="Dis-le en une phrase" onKeyDown={(e) => e.key === "Enter" && applyHeard((e.target as HTMLInputElement).value)} onBlur={(e) => e.target.value && applyHeard(e.target.value)} />
              <button type="button" onClick={listen} aria-label="Dicter" className="bs-pic soft" style={{ width: 38, height: 38, ...(listening ? { background: "var(--rose)", color: "var(--vert-deep)" } : {}) }}>
                <Picto name="mic" />
              </button>
            </div>
            <p className="bs-say" dangerouslySetInnerHTML={{ __html: listening ? "J’écoute…" : heard }} />
          </>
        )}
      </div>
    </>
  );
}

function Done({ done, count, onClose }: { done: { horseId?: string; sourceId?: string; text: string }; count: number; onClose: () => void }) {
  const data = useDataStore();
  const horse = done.horseId ? data.horses.find((h) => h.id === done.horseId) : undefined;
  if (!horse) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <span className="bs-ck on" style={{ margin: 0, width: "auto", height: "auto" }}>
            <i>
              <Picto name="check" />
            </i>
          </span>
          <h2 className="bs-d bs-t2">C’est noté</h2>
        </div>
        <p className="bs-p" style={{ marginTop: 10 }} dangerouslySetInnerHTML={{ __html: done.text }} />
        <button type="button" className="bs-btn" style={{ marginTop: 16 }} onClick={onClose}>
          Fermer
        </button>
      </>
    );
  }
  const t = horseTicket(data, horse.id, currentPeriod());
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <span className="bs-ck on" style={{ margin: 0, width: "auto", height: "auto" }}>
          <i>
            <Picto name="check" />
          </i>
        </span>
        <h2 className="bs-d bs-t2">Noté pour {count > 1 ? `${count} chevaux` : horse.name}</h2>
      </div>
      <div className="bs-ticket">
        <div className="th">
          <HorseFace horse={horse} size={30} />
          Ticket de {horse.name} ce mois-ci · ce qu’il rapporte et ce qu’il coûte
        </div>
        {t.lines.map((l) => (
          <div key={l.key} className={`bs-tl${l.sourceId && l.sourceId === done.sourceId ? " new" : ""}`}>
            <Picto name={pictoForLabel(l.label)} />
            <span>{l.label}</span>
            <b>{signed(l.amount)}</b>
          </div>
        ))}
        <div className="bs-tot">
          <span>{t.net >= 0 ? "Il te laisse" : "Il te coûte"}</span>
          <span className="bs-big">{signed(t.net)}</span>
        </div>
      </div>
      <Link href={`/ticket?id=${horse.id}`} className="bs-btn" style={{ marginTop: 20 }} onClick={onClose}>
        Voir le ticket de {horse.name}
      </Link>
    </>
  );
}
