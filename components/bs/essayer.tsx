"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CountUp, Face, Ic, Ill, Portrait, Steam, eur, sg } from "@/components/carnet/ui";
import { enter, getSession, hasLocaleData, setSession, type LocaleSession } from "@/lib/account/session";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import type { Horse } from "@/lib/domain/types";

/**
 * Essayer avant le compte (maquette 1-essayer.html, sans la question du
 * personnage) : un premier écran, trois questions (chevaux, pension, frais
 * fixes), le résultat estimé, puis l'app avec SES chiffres, rangés sur cet
 * appareil (session « locale »). Le compte viendra pour les garder.
 */
type Step = "accueil" | "n" | "pension" | "frais" | "resultat";
const ORDER: Step[] = ["accueil", "n", "pension", "frais", "resultat"];
const FRAIS_LABEL = "Frais fixes (foin, loyer, salaires)";
const FRAIS_CAT = "Frais fixes";

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- Le personnage : gérante ou gérant, tiré une fois par appareil ---------- */
export type Perso = "f" | "m";
const TIRAGE = "be-stable-tirage";
/** Un tirage simple et stable : le même personnage à chaque visite sur cet appareil. */
export function usePerso(): Perso {
  const [p, setP] = useState<Perso>("f");
  useEffect(() => {
    let v: Perso = "f";
    try {
      const raw = localStorage.getItem(TIRAGE);
      if (raw === "f" || raw === "m") v = raw;
      else {
        v = Math.random() < 0.5 ? "f" : "m";
        localStorage.setItem(TIRAGE, v);
      }
    } catch {
      v = new Date().getDate() % 2 ? "m" : "f";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setP(v);
  }, []);
  return p;
}

/* ---------- Remplir l'écurie avec les réponses ---------- */
export interface Reponses {
  chevaux: number;
  pension: number;
  frais: number;
}

/**
 * Ouvre l'écurie locale et la remplit : « Cheval 1 » … « Cheval N » à la
 * pension donnée, les frais fixes en une charge commune mensuelle, et les
 * trois premières étapes du parcours passées. Puis l'app s'ouvre.
 */
export async function ouvrirEcurieLocale(r: Reponses, to = "/accueil") {
  const s: LocaleSession = { kind: "locale", at: new Date().toISOString() };
  setSession(s);
  await Promise.all([useDataStore.persist.rehydrate(), useSettingsStore.persist.rehydrate()]);

  const d = useDataStore.getState();
  d.startEmpty();
  const today = localToday();
  const month = today.slice(0, 7);
  const n = Math.max(1, Math.min(60, Math.round(r.chevaux)));
  const pension = Math.max(0, Math.round(r.pension));
  for (let i = 1; i <= n; i++) d.addHorse({ name: `Cheval ${i}`, pension: pension || undefined, entryDate: `${month}-01` });
  for (const h of useDataStore.getState().horses) d.setPension(h.id, pension, month);
  if (pension) d.setTariff("pension", pension);
  if (r.frais > 0) {
    d.addExpenseCategory(FRAIS_CAT, false);
    const cat = useDataStore.getState().expenseCategories.find((c) => c.name === FRAIS_CAT && !c.isDirect);
    if (cat) d.setMonthlyCharge(cat.id, FRAIS_LABEL, r.frais, currentPeriod());
  }
  d.runAutopilot(today);

  useSettingsStore.setState((st) => ({
    stableName: "Mon écurie",
    gerant: "",
    parcours: { ...st.parcours, chevaux: true, tarifs: true, factures: true },
    parcoursPlusTard: false,
    arrived: false,
  }));
  // Le coffre écrit l'un après l'autre : on laisse finir avant de recharger.
  await wait(80);
  enter(s, to);
}

/* ---------- Les chevaux encore sans nom ---------- */
const SANS_NOM = /^Cheval \d+$/;
export const chevauxSansNom = (horses: Pick<Horse, "name" | "isArchived">[]) => horses.filter((h) => !h.isArchived && SANS_NOM.test(h.name.trim())).length;

/**
 * L'invite « Donne un nom à tes chevaux » : visible tant que des chevaux
 * s'appellent « Cheval 1 », « Cheval 2 »… (venus de l'essai). Rien sinon.
 */
export function NommerChevaux({ href = "/chevaux" }: { href?: string }) {
  const horses = useDataStore((s) => s.horses);
  const n = chevauxSansNom(horses);
  if (!n) return null;
  return (
    <Link href={href} className="es-nom rise">
      <Face size={40} />
      <span>
        <b>Donne un nom à tes chevaux</b>
        <small>{n > 1 ? `${n} chevaux s’appellent encore « Cheval »` : "Un cheval s’appelle encore « Cheval »"}</small>
      </span>
      <Ic n="chev" className="cn-ic sm" />
    </Link>
  );
}

/* ---------- Le parcours ---------- */
export function Essayer() {
  const router = useRouter();
  const perso = usePerso();
  const [step, setStep] = useState<Step>("accueil");
  const [dir, setDir] = useState<1 | -1>(1);
  const [n, setN] = useState(9);
  const [pension, setPensionTxt] = useState("450");
  const [frais, setFraisTxt] = useState("3500");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reprendre, setReprendre] = useState(false);

  useEffect(() => {
    // Un compte connecté n'a rien à essayer : il retrouve son écurie.
    if (getSession()?.kind === "compte") return router.replace("/accueil");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReprendre(hasLocaleData());
  }, [router]);

  const go = useCallback((to: Step) => {
    setDir(ORDER.indexOf(to) >= ORDER.indexOf(step) ? 1 : -1);
    setStep(to);
    window.scrollTo({ top: 0 });
  }, [step]);
  const back = () => go(ORDER[Math.max(0, ORDER.indexOf(step) - 1)]);

  const p = Number(pension) || 0;
  const f = Number(frais) || 0;
  const reste = n * p - f;

  const key = useCallback(
    (k: string) => {
      const setter = step === "pension" ? setPensionTxt : step === "frais" ? setFraisTxt : null;
      if (!setter) return;
      setter((v) => (k === "del" ? v.slice(0, -1) : v.length >= 5 ? v : v === "0" ? k : v + k));
    },
    [step],
  );

  // Au clavier (ordinateur) : chiffres, effacer, Entrée pour continuer.
  useEffect(() => {
    if (step !== "pension" && step !== "frais") return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) key(e.key);
      else if (e.key === "Backspace") key("del");
      else if (e.key === "Enter") {
        if (step === "pension" && p > 0) go("frais");
        if (step === "frais" && frais !== "") go("resultat");
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [step, key, p, frais, go]);

  const voir = async () => {
    if (busy) return;
    setBusy(true);
    await ouvrirEcurieLocale({ chevaux: n, pension: p, frais: f });
  };

  const cls = `es-st${calme() ? "" : dir > 0 ? " go" : " bk"}`;
  const rang = { accueil: 0, n: 1, pension: 2, frais: 3, resultat: 3 }[step];
  const head = (
    <div className="es-top">
      <button type="button" className="es-back" onClick={back} aria-label="Revenir">
        <Ic n="back" className="" />
      </button>
      <span className="dots" role="img" aria-label={`Question ${rang} sur 3`}>
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= rang ? "on" : ""} />
        ))}
      </span>
      {step === "resultat" ? (
        <span />
      ) : (
        <span className={`es-av ${perso}`} aria-hidden="true">
          <Ill n={perso === "m" ? "gerant-buste" : "carnet-buste"} />
        </span>
      )}
    </div>
  );
  const pad = (
    <div className="es-pad" role="group" aria-label="Clavier">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
        <button key={k} type="button" onClick={() => key(k)}>
          {k}
        </button>
      ))}
      <span />
      <button type="button" onClick={() => key("0")}>
        0
      </button>
      <button type="button" onClick={() => key("del")} aria-label="Effacer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6h11v12H9l-5-6z" />
          <path d="m12 10 4 4M16 10l-4 4" />
        </svg>
      </button>
    </div>
  );
  const champ = (v: string) => (
    <div className="es-amt" aria-live="polite">
      {v ? <span>{eur(Number(v)).replace(/\s?€$/, "")}</span> : <span className="ph">0</span>}
      <i className="caret" aria-hidden="true" />
      <span className="u">€ / mois</span>
    </div>
  );

  return (
    <div className="ar ar-duo">
      <div className="ar-v">
        {step === "accueil" && (
          <div key="accueil" className="es-st">
            <div className="es-top es-top-w">
              <span className="ar-wm">be stable</span>
              <Link href="/compte/connexion" className="es-have">
                J’ai déjà un compte
              </Link>
            </div>
            <div className="es-hero rise">
              <Portrait />
            </div>
            <div className="q rise" style={{ animationDelay: ".08s" }}>
              <h3>On regarde ce qu’il te reste ?</h3>
              <p>Une minute, tes chiffres, pas de compte.</p>
            </div>
            <div className="foot rise" style={{ animationDelay: ".16s" }}>
              <button type="button" className="btn full" onClick={() => go("n")}>
                Commencer
              </button>
              {reprendre && (
                <button type="button" className="btn line full" onClick={() => enter({ kind: "locale", at: new Date().toISOString() })}>
                  Reprendre mon écurie
                </button>
              )}
              <button type="button" className="lnk" onClick={() => enter({ kind: "demo" }, "/accueil")}>
                Juste regarder l’écurie d’exemple
              </button>
            </div>
          </div>
        )}

        {step === "n" && (
          <div key="n" className={cls}>
            {head}
            <div className="q">
              <h3>Combien de chevaux en pension ?</h3>
              <p>Ceux dont le propriétaire te paie une pension.</p>
            </div>
            <div className="es-count">
              <button type="button" aria-label="Un cheval de moins" disabled={n <= 1} onClick={() => (setN((v) => Math.max(1, v - 1)), setTick((t) => t + 1))}>
                −
              </button>
              <b key={tick} className={tick ? "tick" : ""} aria-live="polite">
                {n}
              </b>
              <button type="button" aria-label="Un cheval de plus" disabled={n >= 60} onClick={() => (setN((v) => Math.min(60, v + 1)), setTick((t) => t + 1))}>
                +
              </button>
            </div>
            <p className="es-count-lab">{n > 1 ? "chevaux" : "cheval"}</p>
            <div className="foot">
              <button type="button" className="btn full" onClick={() => go("pension")}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === "pension" && (
          <div key="pension" className={cls}>
            {head}
            <div className="q">
              <h3>Une pension, c’est combien par mois ?</h3>
            </div>
            {champ(pension)}
            <p className="es-help">En moyenne, toutes formules confondues.</p>
            {pad}
            <div className="foot">
              <button type="button" className="btn full" disabled={!p} onClick={() => go("frais")}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === "frais" && (
          <div key="frais" className={cls}>
            {head}
            <div className="q">
              <h3>Foin, loyer, salaires : combien par mois ?</h3>
            </div>
            {champ(frais)}
            <p className="es-help">Un ordre d’idée suffit. Tu affineras plus tard.</p>
            {pad}
            <div className="foot">
              <button type="button" className="btn full" disabled={frais === ""} onClick={() => go("resultat")}>
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === "resultat" && (
          <div key="resultat" className={cls}>
            {head}
            <div className="perch es-perch rise">
              {reste < 0 ? (
                <div className="es-bag">
                  <Ill n="sacoche" alt="Une sacoche presque vide." />
                </div>
              ) : perso === "m" ? (
                <div className="sitw m">
                  <Ill n="gerant-assise" alt="Le gérant, assis sur son chiffre, une tasse de café à la main." />
                  <Steam />
                </div>
              ) : (
                <div className="sitw">
                  <Ill n="assise" alt="La gérante, assise sur son chiffre, une tasse de café à la main." />
                  <Steam />
                </div>
              )}
              <div className="moncard">
                <p className="es-say">{reste >= 0 ? "Il te reste" : "Il te manque"}</p>
                <p className={`big ${reste >= 0 ? "in" : "out"}`}>
                  <CountUp value={reste} ms={1200} />
                </p>
                <p className="es-say">par mois.</p>
                <div className="es-calc">
                  <div>
                    <span>
                      {n} {n > 1 ? "pensions" : "pension"} × {eur(p)}
                    </span>
                    <span className="in">{sg(n * p)}</span>
                  </div>
                  <div>
                    <span>Foin, loyer, salaires</span>
                    <span className={f ? "out" : "num"}>{sg(-f)}</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="note es-est rise" style={{ animationDelay: ".12s" }}>
              C’est une estimation. Plus tu notes, plus c’est juste.
            </p>
            <div className="foot rise" style={{ animationDelay: ".2s" }}>
              <button type="button" className="btn full" disabled={busy} onClick={voir}>
                {busy ? "On prépare ton écurie…" : "Voir mon écurie"}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="ar-side" aria-hidden="true">
        <div className="hero-ill">
          <Ill n={perso === "m" ? "gerant-buste" : "carnet-buste"} />
        </div>
        <p className="k">Be Stable</p>
        <p className="ar-big">Ton écurie, ce qu’elle te rapporte.</p>
      </aside>
    </div>
  );
}
