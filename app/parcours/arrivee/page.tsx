"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { CountUp, Face, Ic, Ill, Money, Steam, sg } from "@/components/carnet/ui";
import { usePerso } from "@/components/bs/perso";
import { useDataStore } from "@/stores/data-store";
import { OBSTACLES, useSettingsStore } from "@/stores/settings-store";
import { monthBreakdown } from "@/lib/domain/ticket";
import { currentPeriod } from "@/lib/utils/period";
import type { Horse } from "@/lib/domain/types";

export default function Page() {
  return (
    <ClientGate>
      <Arrivee />
    </ClientGate>
  );
}

function Arrivee() {
  const parcours = useSettingsStore((s) => s.parcours);
  return OBSTACLES.every((o) => parcours[o]) ? <Fin /> : <Reste />;
}

/**
 * Après les trois premiers obstacles : ce qui reste ce mois, avec les
 * chiffres qu'on vient de donner. Les trois derniers obstacles se passent
 * ensuite en utilisant l'app.
 */
function Reste() {
  const data = useDataStore();
  const perso = usePerso();
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const net = Math.round(m.net);
  const n = data.horses.filter((h) => !h.isArchived).length;
  return (
    <div className="ar-fin ar-reste">
      <h1 className="ar-t1 rise">Trois étapes sur six.</h1>
      <div className="perch es-perch rise" style={{ animationDelay: ".08s" }}>
        {net < 0 ? (
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
          {/* Rien n'est encore rentré : c'est une estimation, à l'encre, dite comme telle. */}
          <p className="es-say">{net >= 0 ? "Si tout est payé, il te restera environ" : "Si rien ne change, il te manquera environ"}</p>
          <p className="big num">
            <CountUp value={net} ms={1200} />
          </p>
          <p className="es-say">par mois.</p>
          <div className="es-calc">
            <div>
              <span>{n > 1 ? `${n} pensions, si payées` : "Ce qui devrait rentrer"}</span>
              <span className="num">{sg(m.revenue)}</span>
            </div>
            {m.direct > 0 && (
              <div>
                <span>Soins des chevaux</span>
                <span className="num">{sg(-m.direct)}</span>
              </div>
            )}
            <div>
              <span>Frais communs</span>
              <span className="num">{sg(-m.sharedTotal)}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="note rise" style={{ animationDelay: ".12s" }}>
        C’est une estimation, faite avec tes tarifs. Plus tu notes, plus c’est juste. Les trois dernières étapes se franchissent en utilisant l’app.
      </p>
      <div className="foot rise" style={{ animationDelay: ".2s" }}>
        <Link href="/accueil" className="btn full">
          Voir mon écurie
          <Ic n="arrow" className="" />
        </Link>
      </div>
    </div>
  );
}

/** Les six obstacles passés : le seuil en têtes de chevaux. */
function Fin() {
  const data = useDataStore();
  const capacity = useSettingsStore((s) => s.capacity);
  const m = useMemo(() => monthBreakdown(data, currentPeriod()), [data]);
  const horses = data.horses.filter((h) => !h.isArchived);
  const need = isFinite(m.seuil) ? Math.ceil(m.seuil) : null;
  return (
    <div className="ar-fin">
      <div className="hero-ill rise">
        <Ill n="rosette" alt="La gérante brandit une rosette." />
      </div>
      <h1 className="ar-t1 rise" style={{ animationDelay: ".08s" }}>
        Six étapes sur six. Ton flot est gagné.
      </h1>
      <Seuil horses={horses} capacity={capacity} seuil={m.seuil} />
      <p className="ar-say">
        {need ? (
          <>
            Il te faut {need} chevaux pour ne pas perdre d’argent. Tu en as {horses.length}
            {horses.length >= need ? ", c’est bon" : `, il en manque ${need - horses.length}`}. Chaque box loué en plus te laisse environ <Money v={m.contribution} /> de plus par mois.
          </>
        ) : (
          "Pour l’instant, les pensions ne suffisent pas à payer les soins des chevaux. Commence par revoir le prix de tes pensions."
        )}
      </p>
      <div className="foot">
        <Link href="/accueil" className="btn full">
          Ouvrir ma journée
          <Ic n="arrow" className="" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Le seuil en têtes de chevaux : une case par box, les chevaux présents
 * dans leur robe, les boxes vides en creux, et un trait là où les frais
 * communs sont payés.
 */
function Seuil({ horses, capacity, seuil }: { horses: Horse[]; capacity: number; seuil: number }) {
  const cap = Math.max(capacity, horses.length, isFinite(seuil) ? Math.ceil(seuil) : 0);
  const cols = 6;
  const sc = Math.min(isFinite(seuil) ? seuil : cap, cap);
  const row = Math.min(Math.floor(sc / cols), Math.ceil(cap / cols) - 1);
  const col = sc - row * cols;
  const vides = Math.max(0, capacity - horses.length);
  return (
    <>
      <div className="ar-seuil rise" style={{ animationDelay: ".16s" }} role="img" aria-label={isFinite(seuil) ? `${horses.length} chevaux. Il en faut ${Math.ceil(seuil - 1e-9)} pour ne pas perdre d’argent.` : `${horses.length} chevaux. Les pensions ne paient pas encore les soins.`}>
        {Array.from({ length: cap }, (_, i) => (horses[i] ? <Face key={i} horse={horses[i]} /> : <span key={i} className="vide" />))}
        {isFinite(seuil) && <span className="trait" style={{ left: `calc(${((col / cols) * 100).toFixed(2)}% + 1px)`, top: row * 48 - 4 }} />}
      </div>
      <div className="ar-seuil-lab">
        <span>
          {horses.length} cheva{horses.length > 1 ? "ux" : "l"}
          {capacity > 0 && ` · ${vides} box vide${vides > 1 ? "s" : ""}`}
        </span>
        <b>
          <Ic n="flag" className="ar-ico" />
          {isFinite(seuil) ? `il en faut ${Math.ceil(seuil - 1e-9)}` : "pas encore atteignable"}
        </b>
      </div>
    </>
  );
}
