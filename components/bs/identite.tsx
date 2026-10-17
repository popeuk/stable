"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ic } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { GAP_LABEL, SEX_LABEL, horseGaps, type HorseSex } from "@/lib/domain/registre";
import type { Horse } from "@/lib/domain/types";

type TextKey = "sireNumber" | "chipNumber" | "origin" | "entryReason" | "destination" | "exitReason";

const jourLong = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * L'identité du cheval, repliée par défaut sur sa fiche : ce que le registre
 * d'élevage demande (SIRE, puce, sexe, naissance, provenance, destination).
 * Tout est facultatif ; chaque champ s'enregistre dès qu'on le quitte.
 */
export function Identite({ horse }: { horse: Horse }) {
  const updateHorse = useDataStore((s) => s.updateHorse);
  // Venu du registre (« Numéro SIRE à compléter ») : la rubrique s'ouvre et se montre.
  const [fromLink] = useState(() => typeof window !== "undefined" && window.location.hash === "#identite");
  const [open, setOpen] = useState(fromLink);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (fromLink) ref.current?.scrollIntoView({ block: "start" });
  }, [fromLink]);
  const gaps = horseGaps(horse);

  const save = (k: TextKey, v: string) => {
    const t = v.trim() || undefined;
    if (t !== (horse[k]?.trim() || undefined)) updateHorse(horse.id, { [k]: t });
  };
  const text = (k: TextKey, label: string, placeholder: string, extra: { inputMode?: "numeric" | "text"; caps?: boolean } = {}) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        defaultValue={horse[k] ?? ""}
        placeholder={placeholder}
        inputMode={extra.inputMode}
        autoCapitalize={extra.caps ? "characters" : undefined}
        autoComplete="off"
        spellCheck={false}
        onBlur={(e) => save(k, e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );

  return (
    <section ref={ref} className="sec nomarge rg-id" id="identite">
      <div style={{ minWidth: 0 }}>
        <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
          <summary>
            <span>
              <b>Identité</b>
              <small>{gaps.length === 0 ? "complète pour le registre d’élevage" : gaps.length === 1 ? GAP_LABEL[gaps[0]] : `${gaps.length} infos à compléter pour le registre`}</small>
            </span>
            <Ic n="chev" className="chev" />
          </summary>
          <div className="rg-id-body">
            <p className="note">Recopie ce qui est sur son document d’identification. Tout est facultatif.</p>
            {text("sireNumber", "Numéro SIRE ou UELN", "ex. 25012345X", { caps: true })}
            {text("chipNumber", "Numéro de puce (transpondeur)", "15 chiffres", { inputMode: "numeric" })}
            <div className="field" role="group" aria-label="Son sexe">
              <span>Sexe</span>
              <div className="chips">
                {(Object.keys(SEX_LABEL) as HorseSex[]).map((k) => (
                  <button key={k} type="button" className="chip" aria-pressed={horse.sex === k} onClick={() => updateHorse(horse.id, { sex: horse.sex === k ? undefined : k })}>
                    {SEX_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Date de naissance</span>
              <input
                className="input"
                type="date"
                defaultValue={horse.birthDate ?? ""}
                onBlur={(e) => {
                  const v = e.target.value || undefined;
                  if (v === horse.birthDate) return;
                  updateHorse(horse.id, v ? { birthDate: v, birthYear: Number(v.slice(0, 4)) } : { birthDate: undefined });
                }}
              />
              {!horse.birthDate && horse.birthYear ? <em>Année connue : {horse.birthYear}.</em> : null}
            </label>
            <p className="k rg-id-k">Arrivée{horse.entryDate ? ` le ${jourLong(horse.entryDate)}` : ""}</p>
            {text("origin", "D’où il vient", "adresse de provenance")}
            {text("entryReason", "Pourquoi il est arrivé", "pension, achat, prêt, naissance…")}
            {horse.exitDate || horse.isArchived ? (
              <>
                <p className="k rg-id-k">Départ{horse.exitDate ? ` le ${jourLong(horse.exitDate)}` : ""}</p>
                {text("destination", "Où il est parti", "adresse de destination")}
                {text("exitReason", "Pourquoi il est parti", "fin de pension, vente, prêt, décès…")}
              </>
            ) : null}
            <Link href={`/registre?cheval=${horse.id}`} className="btn line full">
              <Ic n="doc" className="" />
              Voir le registre d’élevage
            </Link>
          </div>
        </details>
      </div>
    </section>
  );
}
