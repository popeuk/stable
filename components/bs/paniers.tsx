"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { esc } from "@/components/bs/ui";
import { useParcours } from "@/components/bs/parcours";
import { Empty, Face, Ic, Money, eur, ini, sg } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { billsFor, monthKey, type Bill } from "@/lib/domain/billing";
import { lignesSimples, messagePanier, paniers as calculer, prenom, type LignePanier, type Panier } from "@/lib/domain/paniers";
import { localToday } from "@/lib/utils/local-date";
import { currentPeriod } from "@/lib/utils/period";

/**
 * Les paniers : ce qui a eu lieu, rangé par client, à valider d'un geste.
 * La pile (accueil, tournée du matin), la liste (onglet Clients) et « À
 * encaisser ». Tout passe par le store : le compteur et Mon mois se
 * recalculent seuls. Styles : app/carnet/paniers.css.
 */

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Le jour et l'heure, remis à jour chaque minute : une séance finie entre dans son panier. */
function useNow() {
  const [now, setNow] = useState(() => ({ today: localToday(), time: hhmm() }));
  useEffect(() => {
    const t = setInterval(() => setNow({ today: localToday(), time: hhmm() }), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/* ---------- Les données ---------- */

export function usePaniers(): { paniers: Panier[]; total: number; count: number } {
  const hydrated = useDataStore((s) => s.hydrated);
  const data = useDataStore(useShallow((s) => ({ horses: s.horses, revenueCategories: s.revenueCategories, people: s.people, seances: s.seances, careEvents: s.careEvents })));
  const { today, time } = useNow();
  return useMemo(() => {
    const list = hydrated ? calculer(data, today, time) : [];
    return { paniers: list, total: list.reduce((t, p) => t + p.total, 0), count: list.length };
  }, [hydrated, data, today, time]);
}

/** Ce qui reste à encaisser ce mois : une ligne par client qui doit encore. */
export function useAEncaisser(): { bills: Bill[]; total: number; count: number } {
  const hydrated = useDataStore((s) => s.hydrated);
  const data = useDataStore(useShallow((s) => ({ horses: s.horses, revenues: s.revenues, revenueCategories: s.revenueCategories, people: s.people, payments: s.payments })));
  return useMemo(() => {
    const bills = hydrated ? billsFor(data as Parameters<typeof billsFor>[0], currentPeriod()).filter((b) => b.due > 0) : [];
    return { bills, total: bills.reduce((t, b) => t + b.due, 0), count: bills.length };
  }, [hydrated, data]);
}

/* ---------- Les gestes ---------- */

const snapshot = () => {
  const st = useDataStore.getState();
  const snap = { seances: st.seances, careEvents: st.careEvents, directExpenses: st.directExpenses, revenues: st.revenues };
  return () => useDataStore.setState(snap);
};

/** La date réelle d'un soin confirmé : sa date prévue si elle est passée, sinon aujourd'hui. */
const vraieDate = (d: string) => {
  const t = localToday();
  return d < t ? d : t;
};

function confirmerLigne(l: LignePanier, present: boolean) {
  const st = useDataStore.getState();
  if (l.type === "seance" && l.seanceId) {
    if (present) st.validateSeance(l.seanceId, {});
    else st.cancelSeance(l.seanceId, "N’a pas eu lieu");
  } else if (l.careIds?.length) {
    const horses = (st.careEvents ?? []).filter((e) => l.careIds!.includes(e.id)).map((e) => e.horseId);
    st.confirmSession(l.careIds, present ? horses : [], vraieDate(l.date));
  }
}

/**
 * Valide toutes les lignes simples d'un panier (les cours collectifs
 * attendent la présence). Renvoie l'annulation. Sans `silent`, le message du
 * bas dit ce qui est validé, avec « Annuler ».
 */
export function validerPanier(p: Panier, opts: { silent?: boolean } = {}): () => void {
  const undo = snapshot();
  const simples = lignesSimples(p);
  const vu = new Set<string>();
  for (const l of simples) {
    const id = l.seanceId ?? l.key;
    if (vu.has(id)) continue;
    vu.add(id);
    confirmerLigne(l, true);
  }
  if (!opts.silent) {
    const say = useUiStore.getState().say;
    const montant = simples.reduce((t, l) => t + l.amount, 0);
    if (simples.length) say(`C’est validé. ${esc(prenom(p.client))} te doit <strong>${eur(montant)}</strong>.`, undo);
    else say("Le cours collectif se confirme avec la présence.");
  }
  return undo;
}

/** Retire une ligne qui n'a pas eu lieu : séance annulée, soin sorti sans rien facturer. */
function retirerLigne(l: LignePanier, p: Panier) {
  const undo = snapshot();
  confirmerLigne(l, false);
  const reste = p.lignes.filter((x) => x.key !== l.key).length;
  const q = esc(prenom(p.client));
  useUiStore.getState().say(reste ? `${esc(l.label)} : retiré du panier.` : `Panier de ${q} vidé. Rien à valider pour ${q}.`, undo);
}

/* ---------- Le message après validation : « Envoyer à Léa » et « Annuler » ---------- */

interface Recu {
  id: number;
  client: string;
  lignes: LignePanier[];
  montant: number;
  undo: () => void;
}
const useRecu = create<{ recu: Recu | null; host: number | null; set: (r: Recu | null) => void }>((set) => ({ recu: null, host: null, set: (recu) => set({ recu }) }));
let hostSeq = 0;

/** Un seul message à la fois, même si la pile et la liste sont sur le même écran. */
function RecuHost() {
  const [me] = useState(() => ++hostSeq);
  const host = useRecu((s) => s.host);
  const recu = useRecu((s) => s.recu);
  const setRecu = useRecu((s) => s.set);
  const say = useUiStore((s) => s.say);
  const signature = useSettingsStore((s) => [s.gerant, s.stableName].filter(Boolean).join(", "));
  useEffect(() => {
    if (useRecu.getState().host === null) useRecu.setState({ host: me });
    return () => {
      if (useRecu.getState().host === me) useRecu.setState({ host: null });
    };
  }, [me]);
  useEffect(() => {
    if (!recu) return;
    const t = setTimeout(() => setRecu(null), 7000);
    return () => clearTimeout(t);
  }, [recu, setRecu]);
  if (host !== me || !recu || typeof document === "undefined") return null;
  const qui = prenom(recu.client);
  const envoyer = async () => {
    setRecu(null);
    const text = messagePanier(recu.client, recu.lignes, signature);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      say(`Message pour ${esc(qui)} copié. Colle-le dans ta messagerie.`);
    } catch {
      say(`Impossible de copier le message pour ${esc(qui)}.`);
    }
  };
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="toast pp-toast" role="status" aria-live="polite" key={recu.id}>
        <span>
          C’est validé. {qui} te doit <b>{eur(recu.montant)}</b>.
        </span>
        <span className="pp-acts">
          <button type="button" onClick={envoyer}>
            Envoyer à {qui}
          </button>
          <button
            type="button"
            onClick={() => {
              recu.undo();
              setRecu(null);
            }}
          >
            Annuler
          </button>
        </span>
      </div>
    </div>,
    document.body,
  );
}

/** Valider depuis l'écran : le panier, le message, et l'étape « ta première journée ». */
function useValider(onValidated?: (p: Panier) => void) {
  const { pass, parcours } = useParcours();
  const openSeance = useUiStore((s) => s.openSeance);
  return useCallback(
    (p: Panier) => {
      const simples = lignesSimples(p);
      if (!simples.length) {
        const c = p.lignes.find((l) => l.collective && l.seanceId);
        if (c?.seanceId) openSeance(c.seanceId, "presence");
        return;
      }
      const undo = validerPanier(p, { silent: true });
      useUiStore.getState().dismiss();
      useRecu.getState().set({ id: Date.now(), client: p.client, lignes: simples, montant: simples.reduce((t, l) => t + l.amount, 0), undo });
      onValidated?.(p);
      const today = localToday();
      const after = useDataStore.getState();
      const n = (after.seances ?? []).filter((x) => x.status === "done" && x.date === today).length + (after.careEvents ?? []).filter((e) => !e.pending && e.date === today).length;
      if (n >= 3 && parcours.factures) setTimeout(() => pass("journee"), 1200);
    },
    [onValidated, openSeance, pass, parcours.factures],
  );
}

/* ---------- Les briques ---------- */

function Qui({ p }: { p: Panier }) {
  const h = useDataStore((s) => (p.role === "proprietaire" ? s.horses.find((x) => x.name === p.horses[0]) : undefined));
  return h ? <Face horse={h} /> : <span className="ini">{ini(p.client)}</span>;
}

const quiEst = (p: Panier) =>
  p.role === "proprietaire" ? (p.horses.length ? `propriétaire de ${p.horses.slice(0, 2).join(", ")}${p.horses.length > 2 ? ` +${p.horses.length - 2}` : ""}` : "propriétaire") : p.horses.length ? `monte ${p.horses[0]}` : "à cheval chez toi";

function Ligne({ l, p }: { l: LignePanier; p: Panier }) {
  const openSeance = useUiStore((s) => s.openSeance);
  const ref = useRef<HTMLDivElement>(null);
  const retirer = () => {
    const row = ref.current;
    if (calme() || !row?.animate) return retirerLigne(l, p);
    row.animate([{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0, minHeight: "0px" }], { duration: 240, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }).onfinish = () => retirerLigne(l, p);
  };
  return (
    <div className={`pp-pl${l.collective ? " coll" : ""}`} ref={ref}>
      <span>
        <b>{l.label}</b>
        <small>{l.sub}</small>
      </span>
      <Money v={l.amount} />
      {l.collective ? (
        <button type="button" className="pp-who" onClick={() => l.seanceId && openSeance(l.seanceId, "presence")}>
          Qui était là ?
        </button>
      ) : (
        <button type="button" className="pp-rm" onClick={retirer} aria-label={`Retirer : ${l.label}, n’a pas eu lieu`}>
          <Ic n="x" className="" />
        </button>
      )}
    </div>
  );
}

function Pied({ p, onValider, busy }: { p: Panier; onValider: (btn: HTMLButtonElement) => void; busy: boolean }) {
  const simples = lignesSimples(p);
  const coll = p.lignes.length - simples.length;
  const total = simples.reduce((t, l) => t + l.amount, 0);
  return (
    <div className="pp-foot">
      {coll > 0 && simples.length > 0 && <p className="pp-coll">Le cours collectif se confirme avec la présence.</p>}
      {simples.length ? (
        <button type="button" className="btn full" disabled={busy} onClick={(e) => onValider(e.currentTarget)}>
          Tout valider · {sg(total)}
        </button>
      ) : (
        <button type="button" className="btn line full" disabled={busy} onClick={(e) => onValider(e.currentTarget)}>
          Le cours collectif se confirme avec la présence
        </button>
      )}
    </div>
  );
}

/* ---------- La pile ---------- */

export function PilePaniers({ onValidated, compact }: { onValidated?: (p: Panier) => void; compact?: boolean }) {
  const { paniers } = usePaniers();
  const valider = useValider(onValidated);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const deck = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; dx: number; on: boolean; id: number } | null>(null);
  const n = paniers.length;
  const k = n ? cur % n : 0;

  const top = () => deck.current?.querySelector<HTMLElement>('.pp-pan[data-pos="0"]') ?? null;

  const flip = (dir: 1 | -1) => {
    if (busy || n < 2) return;
    const next = () => setCur((c) => (((c % n) + dir) % n + n) % n);
    const t = top();
    if (calme() || !t) return next();
    setBusy(true);
    t.style.transition = "transform .22s ease-in, opacity .22s";
    t.style.transform = `translateX(${-dir * 120}%) rotate(${-dir * 7}deg)`;
    t.style.opacity = "0";
    setTimeout(() => {
      t.style.transition = "";
      t.style.transform = "";
      t.style.opacity = "";
      setBusy(false);
      next();
    }, 220);
  };

  const onValider = (p: Panier) => () => {
    if (busy) return;
    const t = top();
    const fin = () => {
      if (t) {
        t.style.transform = "";
        t.style.opacity = "";
      }
      setBusy(false);
      valider(p);
    };
    if (!lignesSimples(p).length || calme() || !t?.animate) return fin();
    setBusy(true);
    t.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(-70px) scale(.8)", opacity: 0 }], { duration: 380, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }).onfinish = (e) => {
      fin();
      // Le panier peut rester (cours collectif) : la carte revient au prochain rendu.
      requestAnimationFrame(() => (e.target as Animation | null)?.cancel?.());
    };
  };

  /* Glisser pour feuilleter */
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (busy || n < 2 || (e.target as HTMLElement).closest("button")) return;
    if (!(e.target as HTMLElement).closest('.pp-pan[data-pos="0"]')) return;
    drag.current = { x: e.clientX, dx: 0, on: false, id: e.pointerId };
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const t = top();
    if (!d || !t) return;
    d.dx = e.clientX - d.x;
    if (!d.on && Math.abs(d.dx) > 6) {
      d.on = true;
      try {
        deck.current?.setPointerCapture(d.id);
      } catch {}
      t.style.transition = "none";
    }
    if (d.on) t.style.transform = `translateX(${d.dx}px) rotate(${d.dx / 30}deg)`;
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    const t = top();
    if (!d?.on || !t) return;
    t.style.transition = "";
    if (Math.abs(d.dx) > 70) flip(d.dx < 0 ? 1 : -1);
    else t.style.transform = "";
  };

  if (!n)
    return (
      <div className={`pp-pile${compact ? " compact" : ""}`}>
        <Empty ill="rosette">
          <b className="pp-ok">Tout le monde est à jour.</b>
          <br />
          Ce que chacun te doit est dans Clients, à encaisser.
        </Empty>
        <RecuHost />
      </div>
    );

  return (
    <div className={`pp-pile${compact ? " compact" : ""}`} aria-label="Paniers à valider" role="region">
      <div className="pp-deck" ref={deck} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {paniers.map((p, i) => {
          const d = (i - k + n) % n;
          const pos = d < 3 ? String(d) : "x";
          return (
            <article key={p.client} className="pp-pan" data-pos={pos} inert={d !== 0} aria-hidden={d !== 0 || undefined} aria-label={`Panier de ${p.client}`}>
              <div className="pp-ph">
                <Qui p={p} />
                <span>
                  <b>{p.client}</b>
                  <small>{quiEst(p)}</small>
                </span>
                <span className="pp-pos">
                  {i + 1} / {n}
                </span>
              </div>
              <div className="pp-pls">
                {p.lignes.map((l) => (
                  <Ligne key={l.key} l={l} p={p} />
                ))}
              </div>
              <Pied p={p} busy={busy} onValider={onValider(p)} />
            </article>
          );
        })}
      </div>
      <div className="pp-nav">
        <button type="button" className="pp-arr" aria-label="Client précédent" disabled={n < 2} onClick={() => flip(-1)}>
          <Ic n="chevL" className="" />
        </button>
        {n <= 8 ? (
          <span className="dots" aria-hidden="true">
            {paniers.map((p, i) => (
              <i key={p.client} className={i === k ? "on" : ""} />
            ))}
          </span>
        ) : (
          <span className="pp-pos">
            {k + 1} / {n}
          </span>
        )}
        <button type="button" className="pp-arr" aria-label="Client suivant" disabled={n < 2} onClick={() => flip(1)}>
          <Ic n="chev" className="" />
        </button>
      </div>
      {!compact && <p className="pp-hint">Pas eu lieu ? Touche × pour retirer la ligne.</p>}
      <RecuHost />
    </div>
  );
}

/* ---------- La liste (onglet Clients) ---------- */

export function ListePaniers() {
  const { paniers } = usePaniers();
  const valider = useValider();
  const [busy, setBusy] = useState<string | null>(null);
  if (!paniers.length)
    return (
      <>
        <p className="note">Tout le monde est à jour.</p>
        <RecuHost />
      </>
    );
  const go = (p: Panier, btn: HTMLButtonElement) => {
    if (busy) return;
    const row = btn.closest<HTMLElement>(".pp-cl");
    if (!lignesSimples(p).length || calme() || !row?.animate) return valider(p);
    setBusy(p.client);
    row.style.overflow = "hidden";
    row.animate([{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" }], { duration: 300, easing: "ease-in", fill: "forwards" }).onfinish = (e) => {
      setBusy(null);
      valider(p);
      requestAnimationFrame(() => {
        (e.target as Animation | null)?.cancel?.();
        row.style.overflow = "";
      });
    };
  };
  return (
    <div className="pp-list">
      {paniers.map((p) => {
        const simples = lignesSimples(p);
        return (
          <div key={p.client} className="pp-cl">
            <Qui p={p} />
            <span>
              <b>{p.client}</b>
              <small>
                {pl(p.lignes.length, "ligne")} · <Money v={p.total} />
              </small>
            </span>
            <button type="button" className={simples.length ? "btn" : "btn line"} disabled={busy === p.client} onClick={(e) => go(p, e.currentTarget)}>
              {simples.length ? "Valider" : "Présence"}
            </button>
          </div>
        );
      })}
      <RecuHost />
    </div>
  );
}

/* ---------- À encaisser ---------- */

export function AEncaisser() {
  const { bills } = useAEncaisser();
  const say = useUiStore((s) => s.say);
  const mk = monthKey(currentPeriod());
  if (!bills.length) return <p className="note">Personne ne te doit rien ce mois-ci.</p>;
  const paye = (b: Bill, btn: HTMLButtonElement) => {
    const fin = () => {
      const snap = useDataStore.getState().payments;
      useDataStore.getState().addPayment(b.payer, mk, b.due);
      say(`${esc(prenom(b.payer))} a payé <strong>${eur(b.due)}</strong>. C’est noté.`, () => useDataStore.setState({ payments: snap }));
    };
    const row = btn.closest<HTMLElement>(".pp-cl");
    btn.disabled = true;
    if (calme() || !row?.animate) return fin();
    row.style.overflow = "hidden";
    row.animate([{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" }], { duration: 300, easing: "ease-in", fill: "forwards" }).onfinish = (e) => {
      fin();
      requestAnimationFrame(() => {
        (e.target as Animation | null)?.cancel?.();
        row.style.overflow = "";
        btn.disabled = false;
      });
    };
  };
  return (
    <div className="pp-list">
      {bills.map((b) => {
        const quoi = [...new Set(b.lines.map((l) => l.label.toLowerCase()))].slice(0, 2).join(", ");
        return (
          <div key={b.payer} className="pp-cl">
            <span className="ini">{ini(b.payer)}</span>
            <span>
              <b>{b.payer}</b>
              <small>
                {quoi}
                {quoi ? " · " : ""}
                <Money v={b.due} />
              </small>
            </span>
            <button type="button" className="btn line" onClick={(e) => paye(b, e.currentTarget)}>
              Payé
            </button>
          </div>
        );
      })}
    </div>
  );
}
