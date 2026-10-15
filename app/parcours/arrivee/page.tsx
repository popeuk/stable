"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { dec1 } from "@/components/bs/ui";
import { Face, Ic, Ill, Money } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
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
      <h4 className="ar-t1 rise" style={{ animationDelay: ".08s" }}>
        Six obstacles sur six. Ton flot est gagné.
      </h4>
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
      <div className="ar-seuil rise" style={{ animationDelay: ".16s" }} role="img" aria-label={isFinite(seuil) ? `${horses.length} chevaux. Il en faut ${dec1(seuil)} pour ne pas perdre d’argent.` : `${horses.length} chevaux. Les pensions ne paient pas encore les soins.`}>
        {Array.from({ length: cap }, (_, i) => (horses[i] ? <Face key={i} horse={horses[i]} /> : <span key={i} className="vide" />))}
        {isFinite(seuil) && <span className="trait" style={{ left: `calc(${((col / cols) * 100).toFixed(2)}% + 1px)`, top: row * 48 - 4 }} />}
      </div>
      <div className="ar-seuil-lab">
        <span>
          {horses.length} cheva{horses.length > 1 ? "ux" : "l"} · {vides} box vide{vides > 1 ? "s" : ""}
        </span>
        <b>
          <Ic n="flag" className="ar-ico" />
          {isFinite(seuil) ? `il en faut ${dec1(seuil)}` : "pas encore atteignable"}
        </b>
      </div>
    </>
  );
}
