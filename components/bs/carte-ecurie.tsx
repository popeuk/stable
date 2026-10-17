"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { fraisDuMois } from "@/components/bs/parcours";
import { getSession } from "@/lib/account/session";

/**
 * Proposition de navigation (?nav=2) : les deux écrans qui remplacent
 * « Réglages ». Mon écurie ne parle que de l'écurie (ce qu'elle vend, ce
 * qu'elle paie, ses gens, ses papiers) ; Réglages ne parle que de l'app sur
 * ce téléphone. Chaque ligne dit ce qu'il y a dedans avant qu'on l'ouvre.
 */
type Ligne = { href: string; ic: string; t: string; s: string };

function Case({ titre, lignes }: { titre: string; lignes: Ligne[] }) {
  return (
    <section className="ce-case rise">
      <h2>{titre}</h2>
      {lignes.map((l) => (
        <Link key={l.t} href={l.href} className="ce-li">
          <span className="ce-ic">
            <Ic n={l.ic} className="" />
          </span>
          <span className="ce-tx">
            <b>{l.t}</b>
            <small>{l.s}</small>
          </span>
          <Ic n="chev" className="ce-chev" />
        </Link>
      ))}
    </section>
  );
}

const noms = (xs: string[], vide: string) => (xs.length ? (xs.length > 3 ? `${xs.slice(0, 3).join(", ")} et ${xs.length - 3} autre${xs.length > 4 ? "s" : ""}` : xs.join(", ")) : vide);

export function MonEcurie() {
  const stableName = useSettingsStore((s) => s.stableName);
  const capacity = useSettingsStore((s) => s.capacity);
  const horses = useDataStore((s) => s.horses.filter((h) => !h.isArchived).length);
  const t = useDataStore((s) => s.tariffs) ?? {};
  const team = useDataStore((s) => s.team) ?? [];
  const factures = useDataStore((s) => (s.invoices ?? []).length);
  const frais = useDataStore((s) => {
    const f = fraisDuMois(s);
    return f.total + f.postes;
  });
  const prix = [t.pension && `Pension ${eur(t.pension)}`, t.cours_collectif && `cours ${eur(t.cours_collectif)}`].filter(Boolean).join(" · ");
  return (
    <div className="ce">
      <header className="ce-hd rise">
        <h1>Mon écurie</h1>
        <p>
          {stableName}
          {capacity ? ` · ${capacity} places, ${Math.min(horses, capacity)} prises` : ""}
        </p>
      </header>
      <Case
        titre="Ce que tu vends, ce que tu paies"
        lignes={[
          { href: "/parcours/tarifs?retour=ecurie", ic: "euro", t: "Mes prix", s: prix || "Pension, cours, forfaits, prestations" },
          { href: "/parcours/factures?retour=ecurie", ic: "hay", t: "Mes frais", s: frais ? `${eur(frais)} par mois · foin, paille, loyer…` : "Foin, paille, loyer, salaires" },
        ]}
      />
      <Case
        titre="Les gens"
        lignes={[
          { href: "/moi?s=ecurie", ic: "people", t: "Mon équipe", s: noms(team.filter((m) => m.role === "employe").map((m) => m.name), "Ceux qui travaillent avec toi") },
          { href: "/contacts", ic: "user", t: "Les pros", s: noms(team.filter((m) => m.role === "prestataire").map((m) => m.name), "Maréchal, vétérinaire, dentiste…") },
        ]}
      />
      <Case
        titre="L’écurie et ses papiers"
        lignes={[
          { href: "/moi?s=ecurie", ic: "home", t: "L’écurie", s: `${stableName || "Son nom"}${capacity ? `, ${capacity} places` : ", ses places"}, le lieu de détention` },
          { href: "/moi?s=papiers", ic: "doc", t: "Mes papiers", s: `${factures ? `${factures} facture${factures > 1 ? "s" : ""}` : "Factures"}, fichier du comptable, registre d’élevage` },
          { href: "/ma-fiche", ic: "flag", t: "Ma fiche mon-ecurie.fr", s: "Ta vitrine pour les cavaliers qui cherchent une pension" },
        ]}
      />
    </div>
  );
}

export function Reglages() {
  const reminder = useSettingsStore((s) => s.reminder);
  const evening = useSettingsStore((s) => s.evening);
  const [compte, setCompte] = useState("Sur ce téléphone");
  useEffect(() => {
    const s = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompte(s?.kind === "demo" ? "Tu visites l’écurie d’exemple" : s?.kind === "compte" ? "Connecté, tes chiffres sont gardés" : "Sur ce téléphone seulement : garde tes chiffres");
  }, []);
  return (
    <div className="ce">
      <header className="ce-hd rise">
        <h1>Réglages</h1>
        <p>L’app sur ce téléphone. Rien ici ne change tes chiffres.</p>
      </header>
      <Case
        titre="Toi"
        lignes={[
          { href: "/moi?s=telephone", ic: "key", t: "Mon compte", s: compte },
          { href: "/moi?s=rappel", ic: "bell", t: "Mon rappel", s: `${reminder ? reminder.replace(":", " h ") : "Le matin"}${evening ? ", et le soir s’il reste quelque chose" : ""}` },
        ]}
      />
      <Case
        titre="L’app"
        lignes={[
          { href: "/moi?s=telephone", ic: "phone", t: "Affichage", s: "Gros texte, installer l’app sur l’écran d’accueil" },
          { href: "/moi?s=telephone", ic: "help", t: "Revoir", s: "Les explications, la tournée du matin" },
          { href: "/moi?s=telephone", ic: "gear", t: "Avancé", s: "Catégories, sauvegarde, tout effacer" },
        ]}
      />
    </div>
  );
}
