"use client";

import { useState } from "react";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { esc } from "@/components/bs/ui";
import { localToday } from "@/lib/utils/local-date";
import { dernierSejour, sejours, sejourEnMots } from "@/lib/domain/sejours";
import type { Horse } from "@/lib/domain/types";
import { selonSexe } from "@/lib/domain/registre";
import { cap } from "@/components/bs/ui";

const jour = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const moisDe = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" });

/**
 * Le départ ou le retour d'un cheval, daté : aujourd'hui par défaut, une
 * date passée possible. La date va telle quelle au registre d'élevage ;
 * dans l'argent, les mois d'avant ce mois-ci ne bougent pas (déjà comptés,
 * peut-être facturés). Un retour ajoute un séjour, sans toucher aux
 * précédents (lib/domain/sejours).
 */
export function SejourForm({ horse, onDone }: { horse: Horse; onDone: (parti: boolean) => void }) {
  const archiveHorse = useDataStore((s) => s.archiveHorse);
  const restoreHorse = useDataStore((s) => s.restoreHorse);
  const say = useUiStore((s) => s.say);
  const today = localToday();
  // Une jument : les accords suivent (lib/domain/registre, selonSexe).
  const e = (m: string, f: string) => selonSexe(horse, m, f, m);
  const il = e("il", "elle");
  const le = e("le", "la");
  const cur = dernierSejour(horse);
  const revient = !!cur.exit;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [lieu, setLieu] = useState("");
  const min = revient ? cur.exit! : cur.entry;
  const d = date && date <= today && (!min || date >= min) ? date : "";
  const moisAvant = !!d && d.slice(0, 7) < today.slice(0, 7);
  const avant = sejours(horse).length > 1 ? sejours(horse).slice(0, -1) : [];

  if (!open) {
    return (
      <div className="ch-leave">
        {revient && <p className="note">{horse.exitDate ? `${e("Parti", "Partie")} le ${jour(horse.exitDate)}. ` : `${e("Parti", "Partie")}. `}Son argent reste dans les mois où ${il} était là.</p>}
        {avant.length > 0 && <p className="note">Ses séjours d’avant : {avant.map(sejourEnMots).join(", ")}.</p>}
        <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
          {revient ? `${horse.name} revient à l’écurie` : `${horse.name} quitte l’écurie`}
        </button>
      </div>
    );
  }

  const valider = () => {
    if (!d) return;
    const snap = useDataStore.getState();
    const back = { horses: snap.horses, revenues: snap.revenues };
    if (revient) {
      restoreHorse(horse.id, d, { origin: lieu });
      say(`<strong>${esc(horse.name)}</strong> est de retour depuis le ${jour(d)}. Ses séjours d’avant restent tels quels.`, () => useDataStore.setState(back));
      onDone(false);
    } else {
      archiveHorse(horse.id, d, { destination: lieu });
      say(`<strong>${esc(horse.name)}</strong> est ${e("parti", "partie")} le ${jour(d)}. Tu ${le} retrouves dans les chevaux partis.`, () => useDataStore.setState(back));
      onDone(true);
    }
    setOpen(false);
  };

  return (
    <div className="ch-sejour form">
      <label className="field">
        <span>{revient ? `${e("Revenu", "Revenue")} le` : `${e("Parti", "Partie")} le`}</span>
        <input className="input" type="date" value={date} min={min || undefined} max={today} onChange={(e) => setDate(e.target.value)} />
        {!d && <em>Choisis un jour entre le {min ? jour(min) : "jour de son arrivée"} et aujourd’hui.</em>}
      </label>
      <label className="field">
        <span>{revient ? `D’où ${il} revient` : `Où ${il} part`} <span className="ch-opt">facultatif</span></span>
        <input className="input" value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder={revient ? "adresse de provenance" : "adresse de destination"} autoComplete="off" />
      </label>
      <p className="note">
        {revient
          ? moisAvant
            ? `La date va au registre d’élevage. Dans tes chiffres, ${il} recompte à partir de ce mois-ci : ${moisDe(d)} est déjà compté, il ne bouge pas.`
            : `${cap(il)} recompte à partir de ce jour : sa pension et sa part des frais. Ses séjours d’avant ne bougent pas.`
          : moisAvant
            ? `La date va au registre d’élevage. Dans tes chiffres, ${moisDe(d)} est déjà compté et ne bouge pas ; ${il} ne compte plus à partir de ce mois-ci, et sa pension de ce mois, si elle n’est pas encore facturée, est retirée.`
            : `Ce qu’${il} a rapporté et coûté reste dans les mois où ${il} était là. Sa pension ne sera plus comptée les mois suivants.`}
      </p>
      <button type="button" className="btn full" disabled={!d} onClick={valider}>
        {revient ? `${horse.name} est ${e("revenu", "revenue")} le ${d ? jour(d) : "…"}` : `${horse.name} est ${e("parti", "partie")} le ${d ? jour(d) : "…"}`}
      </button>
      <button type="button" className="btn line full" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </div>
  );
}
