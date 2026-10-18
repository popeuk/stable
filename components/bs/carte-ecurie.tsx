"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ic, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { fraisDuMois } from "@/components/bs/parcours";
import { getSession, type Listing } from "@/lib/account/session";
import { api, type StableHit } from "@/lib/account/api";
import { useAnnuaire } from "@/components/bs/account-ui";
import { EcuriesTexte } from "@/lib/annuaire";

/**
 * Les deux écrans qui remplacent l'ancien « Réglages » (17 octobre 2026). Mon écurie ne parle que de l'écurie (ce qu'elle vend, ce
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

/* ---------- Ton écurie : sa fiche mon-ecurie.fr ---------- */

function TonEcurie() {
  const stableName = useSettingsStore((s) => s.stableName);
  const annuaire = useAnnuaire();
  const [listing, setListing] = useState<Listing | null>(null);
  useEffect(() => {
    const s = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s?.kind === "compte" && s.listing && s.listing.status !== "aucune") setListing(s.listing);
  }, []);
  // La recherche dans l'annuaire, à partir de deux lettres.
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StableHit[] | null>(null);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    let fini = false;
    const h = setTimeout(() => api.chercher(t).then((r) => !fini && setHits(r.resultats.slice(0, 4)), () => !fini && setHits([])), 250);
    return () => {
      fini = true;
      clearTimeout(h);
    };
  }, [q]);
  const montreHits = q.trim().length >= 2 && hits;

  return (
    <section className="ce-case ce-fiche rise">
      <h2>Ton écurie</h2>
      {listing ? (
        <Link href="/ma-fiche" className="ce-li">
          <span className="ce-ic">
            <Ic n="flag" className="" />
          </span>
          <span className="ce-tx">
            <b>{listing.title || stableName}</b>
            <small>{listing.status === "validee" ? "Ta fiche mon-ecurie.fr est en ligne. Touche pour la modifier." : "Ta demande est en cours de vérification."}</small>
          </span>
          <Ic n="chev" className="ce-chev" />
        </Link>
      ) : (
        <div className="ce-cherche">
          <label htmlFor="ce-q">Cherche-la sur mon-ecurie.fr</label>
          <p>{EcuriesTexte(annuaire?.ecuries)} y sont déjà. Retrouve la tienne : ton nom, ta commune et ta fiche se remplissent d’un coup.</p>
          <span className="ce-in">
            <Ic n="search" className="" />
            <input id="ce-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Le nom de ton écurie" autoComplete="off" />
          </span>
          {montreHits && (
            <ul className="ce-hits">
              {hits!.map((h) => (
                <li key={h.id}>
                  <Link href={`/compte/inscription?fiche=${h.id}&depuis=ecurie`}>
                    <b>{h.title}</b>
                    <small>{[h.commune, h.departement && `(${h.departement})`].filter(Boolean).join(" ")}</small>
                    <em>{h.statut === "libre" ? "C’est la mienne" : h.statut === "revendiquee" ? "déjà reprise" : "en vérification"}</em>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/compte/inscription?creer=1&depuis=ecurie" className="ce-ajout">
                  <b>Elle n’y est pas ?</b>
                  <small>L’ajouter à l’annuaire, gratuitement</small>
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

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
      <TonEcurie />
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
          { href: "/moi?s=equipe", ic: "people", t: "Mon équipe", s: noms(team.filter((m) => m.role === "employe").map((m) => m.name), "Ceux qui travaillent avec toi") },
          { href: "/contacts", ic: "user", t: "Les pros", s: noms(team.filter((m) => m.role === "prestataire").map((m) => m.name), "Maréchal, vétérinaire, dentiste…") },
        ]}
      />
      <Case
        titre="Tes places et tes papiers"
        lignes={[
          { href: "/moi?s=ecurie", ic: "home", t: "Mes places", s: capacity ? `${capacity} places, ${Math.min(horses, capacity)} prises` : "Combien de chevaux tu peux accueillir" },
          { href: "/moi?s=papiers", ic: "doc", t: "Mes papiers", s: `${factures ? `${factures} facture${factures > 1 ? "s" : ""}` : "Factures"}, fichier du comptable, registre d’élevage` },
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
          { href: "/moi?s=compte", ic: "key", t: "Mon compte", s: compte },
          { href: "/moi?s=rappel", ic: "bell", t: "Mon rappel", s: `${reminder ? reminder.replace(":", " h ") : "Le matin"}${evening ? ", et le soir s’il reste quelque chose" : ""}` },
        ]}
      />
      <Case
        titre="L’app"
        lignes={[
          { href: "/moi?s=affichage", ic: "phone", t: "Affichage", s: "Gros texte, installer l’app sur l’écran d’accueil" },
          { href: "/moi?s=revoir", ic: "help", t: "Revoir", s: "Les explications, la tournée du matin" },
          { href: "/moi?s=avance", ic: "gear", t: "Avancé", s: "Catégories, sauvegarde, tout effacer" },
        ]}
      />
      <Case
        titre="Les règles"
        lignes={[
          { href: "/regles?t=confidentialite", ic: "key", t: "Confidentialité", s: "Tes données : où elles vont, chiffrées, et tes droits" },
          { href: "/regles?t=cgu", ic: "doc", t: "Conditions d’utilisation", s: "Ce que l’app fait, ce qu’elle ne fait pas" },
          { href: "/regles?t=mentions-legales", ic: "flag", t: "Mentions légales", s: "Qui édite Be Stable, qui l’héberge" },
        ]}
      />
    </div>
  );
}
