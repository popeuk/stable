"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ill, Portrait } from "@/components/carnet/ui";
import { enter, getSession, hasLocaleData, setSession, type LocaleSession } from "@/lib/account/session";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { Horse } from "@/lib/domain/types";
import { usePerso } from "@/components/bs/perso";

/**
 * Essayer avant le compte : un premier écran, puis le même parcours que
 * tout le monde (« Mes premiers pas », /parcours), en plus simple : un
 * nombre de chevaux, une pension moyenne, un total de frais. L'écurie est
 * rangée sur cet appareil (session « locale ») ; le compte viendra pour la
 * garder.
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- Le personnage : gérante ou gérant, tiré une fois par appareil ---------- */
export { usePerso, type Perso } from "@/components/bs/perso";

/* ---------- Ouvrir l'écurie de l'essai ---------- */
/**
 * Ouvre une écurie locale vide (sur cet appareil, sans compte), le parcours
 * remis à zéro, puis va aux premiers pas.
 */
export async function ouvrirEssai(to = "/parcours") {
  const s: LocaleSession = { kind: "locale", at: new Date().toISOString() };
  setSession(s);
  await Promise.all([useDataStore.persist.rehydrate(), useSettingsStore.persist.rehydrate()]);
  useDataStore.getState().startEmpty();
  useSettingsStore.setState((st) => ({
    stableName: "Mon écurie",
    gerant: "",
    parcours: Object.fromEntries(Object.keys(st.parcours).map((k) => [k, false])) as typeof st.parcours,
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

/* ---------- Le premier écran ---------- */
export function Essayer() {
  const router = useRouter();
  const perso = usePerso();
  const [busy, setBusy] = useState(false);
  const [reprendre, setReprendre] = useState(false);

  useEffect(() => {
    // Un compte connecté n'a rien à essayer : il retrouve son écurie.
    if (getSession()?.kind === "compte") return router.replace("/accueil");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReprendre(hasLocaleData());
  }, [router]);

  const commencer = async () => {
    if (busy) return;
    setBusy(true);
    await ouvrirEssai();
  };

  return (
    <div className="ar ar-duo">
      <div className="ar-v">
        <div className="es-st">
          <div className="es-top es-top-w">
            <span className="ar-wm">be stable</span>
            <Link href="/compte/connexion" className="es-have">
              J’ai déjà un compte
            </Link>
          </div>
          <div className="es-hero es-hero-d rise">
            <Portrait />
          </div>
          <div className="q rise" style={{ animationDelay: ".08s" }}>
            <h1>On regarde ce qu’il te reste ?</h1>
            <p>Quelques minutes, tes chiffres, pas de compte.</p>
          </div>
          {/* Au téléphone, la scène d'accueil remplit l'espace entre la question et le bouton. */}
          <div className="es-scene rise" style={{ animationDelay: ".12s" }}>
            <Ill n="accueil-premier" prio alt="La gérante t’accueille devant un box, un cheval à la porte." />
          </div>
          <div className="foot rise" style={{ animationDelay: ".16s" }}>
            <button type="button" className="btn full" disabled={busy} onClick={commencer}>
              {busy ? "On prépare ton écurie…" : "Commencer"}
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
