"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { scopedKey } from "@/lib/account/session";
import { dayItems } from "@/lib/domain/seances";
import { localToday } from "@/lib/utils/local-date";
import { usePaniers, PilePaniers } from "@/components/bs/paniers";
import { phraseObjectif, useCompte, useMois } from "@/components/bs/compteur";
import { Ill, Money, eur, sg } from "@/components/carnet/ui";
import type { Panier } from "@/lib/domain/paniers";

/**
 * La tournée du matin : une fois par jour, à la première ouverture de
 * l'accueil, 30 secondes en trois étapes. Hier (la pile des paniers),
 * Aujourd'hui (ce qui t'attend, à regarder), Ton mois (le compteur qui compte
 * depuis la dernière tournée). « Passer » toujours en haut. Si rien n'attend
 * et rien n'est prévu, elle ne s'ouvre pas.
 * Se souvient, sur cet appareil et par compte, du jour et du chiffre de la
 * dernière tournée.
 */

type Etape = "hier" | "aujourdhui" | "mois";
const NOMS: Record<Etape, string> = { hier: "Hier", aujourdhui: "Aujourd’hui", mois: "Ton mois" };
interface Vu {
  date: string;
  net: number;
}

const cle = () => scopedKey("be-stable-tournee");
function lire(): Vu | null {
  try {
    const raw = localStorage.getItem(cle());
    return raw ? (JSON.parse(raw) as Vu) : null;
  } catch {
    return null;
  }
}
function ecrire(v: Vu) {
  try {
    localStorage.setItem(cle(), JSON.stringify(v));
  } catch {}
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

/** Posée dans l'accueil : décide à l'ouverture, ou se rouvre depuis le rond. */
export function Tournee() {
  const ready = useDataStore((s) => s.hydrated);
  const forced = useUiStore((s) => s.tourneeOpen);
  const closeForced = useUiStore((s) => s.closeTournee);
  const { count } = usePaniers();
  const { net } = useMois();
  const [auto, setAuto] = useState<null | { prev: Vu | null }>(null);
  const decide = useRef(false);

  // Une seule décision par ouverture de l'accueil, une fois les données là.
  useEffect(() => {
    if (!ready || decide.current) return;
    decide.current = true;
    const vu = lire();
    const today = localToday();
    if (vu?.date === today) return;
    const items = dayItems(useDataStore.getState(), today, today, hhmm()).filter((i) => !i.done);
    if (!count && !items.length) {
      ecrire({ date: today, net });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuto({ prev: vu });
  }, [ready, count, net]);

  const open = forced || !!auto;
  if (!open || !ready) return null;
  return (
    <TourneeEcran
      prev={auto?.prev ?? lire()}
      onClose={() => {
        setAuto(null);
        closeForced();
      }}
    />
  );
}

function TourneeEcran({ prev, onClose }: { prev: Vu | null; onClose: () => void }) {
  const data = useDataStore();
  const { count, total } = usePaniers();
  const mois = useMois();
  const today = localToday();
  const items = useMemo(() => dayItems(data, today, today, hhmm()), [data, today]);
  const restants = items.filter((i) => !i.done);

  // Les étapes se fixent à l'ouverture : valider la pile ne fait pas sauter « Hier ».
  const [etapes] = useState<Etape[]>(() => [...(count ? (["hier"] as Etape[]) : []), ...(restants.length ? (["aujourdhui"] as Etape[]) : []), "mois"]);
  const [aValiderAvant] = useState(total);
  const [i, setI] = useState(0);
  const [fini, setFini] = useState(false);
  const [valides, setValides] = useState<Panier[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const netRef = useRef(mois.net);
  useEffect(() => {
    netRef.current = mois.net;
  }, [mois.net]);
  const terminer = useCallback(() => {
    ecrire({ date: localToday(), net: netRef.current });
    onClose();
  }, [onClose]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && terminer();
    window.addEventListener("keydown", k);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = avant;
    };
  }, [terminer]);

  const suivant = () => {
    stage.current?.scrollTo({ top: 0 });
    if (i < etapes.length - 1) setI(i + 1);
    else setFini(true);
  };

  const etape = etapes[i];
  const kept = valides.reduce((t, p) => t + p.total, 0);
  const memeMois = prev?.date?.slice(0, 7) === today.slice(0, 7);
  const depuis = memeMois && prev ? prev.net : 0;
  const dt = cap(new Date(today + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  const moisNom = cap(new Date(today + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" }));

  const recap = [
    ...(valides.length ? [`${pl(valides.length, "panier")} validé${valides.length > 1 ? "s" : ""}, ${sg(kept)} comptés dans ton mois.`] : etapes.includes("hier") && count ? [`${pl(count, "client")} encore à valider, dans Clients et chevaux.`] : []),
    ...(restants.length ? [`${restants.length > 1 ? `${restants.length} choses` : "Une chose"} au planning aujourd’hui.`] : []),
    `Ce mois, ${mois.net < 0 ? "il te manque" : "il te reste"} ${sg(mois.net)}.`,
  ];

  return createPortal(
    <div className="carnet carnet-portal">
      <div className="ac-tour" role="dialog" aria-modal="true" aria-label="La tournée du matin" ref={ref} tabIndex={-1}>
        <div className="ac-top">
          <div className="ac-tophd">
            <span>30 secondes pour faire le point</span>
            <button type="button" className="ac-skip" onClick={terminer}>
              {fini ? "Fermer" : "Passer"}
            </button>
          </div>
          <div className="ac-bars" style={{ gridTemplateColumns: `repeat(${etapes.length}, 1fr)` }} aria-hidden="true">
            {etapes.map((e, k) => (
              <i key={e}>
                <b style={{ width: fini || k < i ? "100%" : k === i ? "50%" : "0%" }} />
              </i>
            ))}
          </div>
          <ol className="ac-steps" style={{ gridTemplateColumns: `repeat(${etapes.length}, 1fr)` }}>
            {etapes.map((e, k) => (
              <li key={e} className={!fini && k === i ? "on" : ""} aria-current={!fini && k === i ? "step" : undefined}>
                {NOMS[e]}
              </li>
            ))}
          </ol>
        </div>
        <div className="ac-stage" ref={stage}>
          {fini ? (
            <section className="ac-step ac-end" key="fin">
              <Ill n="gerant-rosette" alt="" />
              <h3>
                Tu sais où tu en es.
                <br />
                Bonne journée.
              </h3>
              <ul className="ac-recap">
                {recap.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <button type="button" className="btn full" onClick={terminer}>
                Ouvrir l’accueil
              </button>
            </section>
          ) : etape === "hier" ? (
            <section className="ac-step" key="hier">
              <div className="ac-h">
                <div>
                  <p className="ac-dt">Ce qui a eu lieu</p>
                  <h3>À valider</h3>
                  <p>
                    {count ? (
                      <>
                        {pl(count, "client")} · <Money v={total} /> à valider
                      </>
                    ) : (
                      "Rien à valider, tout le monde est à jour."
                    )}
                  </p>
                </div>
                <Ill n="gerant-buste" alt="" />
              </div>
              <div className="ac-tpile">
                <PilePaniers onValidated={(p) => setValides((v) => [...v, p])} />
              </div>
              <div className="ac-kept">
                <span>Validé ce matin</span>
                <b className={kept > 0 ? "in" : "num"}>{sg(kept)}</b>
              </div>
              <button type="button" className="btn full" onClick={suivant}>
                Continuer
              </button>
            </section>
          ) : etape === "aujourdhui" ? (
            <section className="ac-step" key="auj">
              <div className="ac-h">
                <div>
                  <p className="ac-dt">{dt}</p>
                  <h3>Aujourd’hui</h3>
                  <p>Rien à faire, juste regarder.</p>
                </div>
              </div>
              <div className="ac-scene">
                <Ill n="foin" alt="Une gérante, assise sur une botte de foin, regarde sa journée sur son téléphone." />
              </div>
              <div className="rows ac-today">
                {restants.slice(0, 5).map((it) => (
                  <div className="row" key={it.key}>
                    <time>{it.start ?? ""}</time>
                    <span>
                      <b>{it.title}</b>
                      {it.sub && <small>{it.sub}</small>}
                    </span>
                    <span className="amt">{it.money ? <Money v={it.money} /> : null}</span>
                  </div>
                ))}
              </div>
              {restants.length > 5 && <p className="ac-mnote">Et {restants.length - 5} de plus au planning.</p>}
              <button type="button" className="btn full" onClick={suivant}>
                Continuer
              </button>
            </section>
          ) : (
            <section className="ac-step" key="mois">
              <div className="ac-h">
                <div>
                  <p className="ac-dt">
                    {moisNom}, au {Number(today.slice(8))}
                  </p>
                  <h3>Ton mois</h3>
                </div>
              </div>
              <MoisQuiCompte depuis={depuis} />
              <p className="ac-mnote">
                {memeMois && Math.round(mois.net - depuis) !== 0 ? (
                  <>
                    Depuis ta dernière tournée : <Money v={mois.net - depuis} />.{" "}
                  </>
                ) : null}
                {kept > 0 && aValiderAvant > 0 ? (
                  <>
                    Dont <b>{sg(kept)}</b> validés ce matin.{" "}
                  </>
                ) : null}
                {Math.round(mois.aValider) > 0 ? (
                  <>
                    Encore <Money v={mois.aValider} /> à valider.
                  </>
                ) : null}
              </p>
              <button type="button" className="btn full" onClick={suivant}>
                Terminer
              </button>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Le compteur de la tournée : la gérante assise dessus, il compte depuis la dernière tournée. */
function MoisQuiCompte({ depuis }: { depuis: number }) {
  const { net, objective, pct, planPct } = useMois();
  // Rien n'a bougé depuis la dernière tournée : le chiffre compte depuis zéro.
  const [from] = useState(Math.round(net - depuis) === 0 ? 0 : depuis);
  const v = useCompte(from, net, { ms: 1400, delay: 350 });
  const vpct = objective > 0 ? Math.max(0, Math.min(100, (v / objective) * 100)) : 0;
  const tone = Math.round(v) > 0 ? "in" : Math.round(v) < 0 ? "out" : "";
  return (
    <div className="perch ac-tperch">
      <div className="sitw">
        <Ill n="assise" alt="Une gérante assise sur le chiffre du mois, un café à la main." />
      </div>
      <div className="card moncard ac-cpt nobag" role="group" aria-label={`Ce mois, ${net < 0 ? "il te manque" : "il te reste"} ${sg(net)}`}>
        <span className="ac-tx">
          <span className="k">{v < 0 ? "Ce mois, il te manque" : "Ce mois, il te reste"}</span>
          <span className={`big ${tone}`}>
            <span className="num">{sg(v)}</span>
          </span>
          <span className="ac-sub">{phraseObjectif(net, objective)}</span>
        </span>
        {objective > 0 && (
          <>
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${vpct}%`, transition: "none" }} />
              {planPct > 0 && <i className="plan" style={{ left: `${pct}%`, width: `${planPct}%` }} />}
            </span>
            <span className="bar-lab">
              <span>0</span>
              <span>objectif {eur(objective)}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
