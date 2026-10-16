"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { scopedKey } from "@/lib/account/session";
import { dayItems, resumeJournee } from "@/lib/domain/seances";
import { aCompteLe } from "@/lib/domain/compte-auto";
import { addDays } from "@/lib/domain/care";
import { localToday } from "@/lib/utils/local-date";
import { dIciFin, phraseObjectif, useCompte, useMois } from "@/components/bs/compteur";
import { LigneComptee, useDebutant } from "@/components/bs/compte";
import { Ill, Money, eur, sg } from "@/components/carnet/ui";

/**
 * La tournée du matin : 30 secondes en trois étapes, quand on la demande
 * (la ligne « Hier : … ont compté » de l'accueil, ou Réglages). Elle ne
 * s'ouvre jamais toute seule. Hier, ce qui a compté (tout seul, avec × pour
 * retirer ce qui n'a pas eu lieu), Aujourd'hui (ce qui t'attend, à
 * regarder), Ton mois (le compteur qui compte depuis la dernière tournée).
 * « Passer » toujours en haut. Se souvient, sur cet appareil et par compte,
 * du jour et du chiffre de la dernière tournée.
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

/** Posée une fois dans la coque de l'app : s'ouvre quand on la demande. */
export function Tournee() {
  const ready = useDataStore((s) => s.hydrated);
  const open = useUiStore((s) => s.tourneeOpen);
  const close = useUiStore((s) => s.closeTournee);
  if (!open || !ready) return null;
  return <TourneeEcran prev={lire()} onClose={close} />;
}

function TourneeEcran({ prev, onClose }: { prev: Vu | null; onClose: () => void }) {
  const data = useDataStore();
  const mois = useMois();
  const today = localToday();
  const items = useMemo(() => dayItems(data, today, today, hhmm()), [data, today]);
  const restants = items.filter((i) => !i.done);
  const veille = useMemo(() => aCompteLe(data, addDays(today, -1), today, hhmm()), [data, today]);
  const debutant = useDebutant();
  const totalHier = veille.reduce((t, it) => t + (it.money ?? 0), 0);

  // Les étapes se fixent à l'ouverture : retirer une ligne ne fait pas sauter « Hier ».
  const [etapes] = useState<Etape[]>(() => [...(veille.length ? (["hier"] as Etape[]) : []), ...(restants.length ? (["aujourdhui"] as Etape[]) : []), "mois"]);
  const [i, setI] = useState(0);
  const [fini, setFini] = useState(false);
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
  const memeMois = prev?.date?.slice(0, 7) === today.slice(0, 7);
  const depuis = memeMois && prev ? prev.net : 0;
  const dt = cap(new Date(today + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
  const moisNom = cap(new Date(today + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" }));

  const recap = [
    ...(etapes.includes("hier") ? [veille.length ? `Hier, ${pl(veille.length, "ligne")} ${veille.length > 1 ? "ont" : "a"} compté : ${sg(totalHier)}.` : "Hier, plus rien ne compte."] : []),
    // Toutes les choses du jour, comme l'accueil : séances, soins, tâches, rendez-vous.
    ...(resumeJournee(items).ligne ? [resumeJournee(items).ligne!] : []),
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
                  <h3>Hier, ce qui a compté</h3>
                  <p>{veille.length ? <>Ça a compté tout seul : <Money v={totalHier} />.</> : "Plus rien hier : tu as tout retiré."}</p>
                </div>
                <Ill n="gerant-buste" alt="" />
              </div>
              {veille.length > 0 && (
                <>
                  <div className="rows ac-hier">
                    {veille.map((it) => (
                      <LigneComptee key={it.key} it={it} />
                    ))}
                  </div>
                  {debutant && <p className="ac-mnote cp-hint">Pas eu lieu ? Retire la ligne.</p>}
                </>
              )}
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
                {Math.round(mois.prevu) > 0 ? (
                  <>
                    Encore {sg(mois.prevu)} prévu au planning {dIciFin()}.
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
  const { net, objective } = useMois();
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
          {objective > 0 && <span className="ac-sub">{phraseObjectif(net, objective)}</span>}
        </span>
        {objective > 0 && (
          <>
            <span className="bar" aria-hidden="true">
              <i style={{ width: `${vpct}%`, transition: "none" }} />
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
