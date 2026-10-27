"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getSession, leave } from "@/lib/account/session";
import { useSauvegardeOuverte } from "@/components/bs/sauvegarde-ouverte";
import { ClientGate } from "@/components/ui/client-gate";
import { useDesk } from "@/components/bs/desk-hook";
import { dayItems } from "@/lib/domain/seances";
import { Compteur } from "@/components/bs/compteur";
import { BandeauFinDuMois, LigneHier, LigneJour, useDebutant, useFinDuMois, useMaintenant } from "@/components/bs/compte";
import { AideCarte } from "@/components/bs/nav";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { Empty, Face, Ic, Page, Sec } from "@/components/carnet/ui";
import { CeQuiManque, Chemin, JourneeMontree, useCheminActif, useJamaisNote } from "@/components/bs/accueil-fort";
import "@/app/carnet/accueil-fort.css";
import { AccueilBriques } from "@/components/bs/accueil-briques";

/** L'encart mon-ecurie.fr, tout en bas : chargé après le reste de l'accueil. */
const PromoMonEcurie = dynamic(() => import("@/components/bs/promo-mon-ecurie").then((m) => m.PromoMonEcurie), { ssr: false });

/**
 * L'accueil, dans l'ordre : le chiffre du mois (le personnage à côté) et, sans aucun frais, ce qui lui
 * manque ; le chemin en cinq pas d'une écurie qui démarre
 * (components/bs/accueil-fort.tsx) ; puis la
 * ligne « Hier : … ont compté » qui ouvre la tournée du matin si on veut,
 * ta journée en pleine largeur, une seule chose à faire à la fois (fin du
 * mois, ou des chevaux à nommer), et l'encart mon-ecurie.fr réduit, tout en
 * bas. À la première visite, une bulle montre le + ; la carte d'aide
 * complète s'ouvre sous le chiffre quand on touche le « ? ».
 * Sur ordinateur : le chiffre en grand à gauche, ta journée à droite et
 * l'équipe dessous.
 */
export default function AccueilPage() {
  return (
    <ClientGate>
      <Accueil />
    </ClientGate>
  );
}

function Accueil() {
  useSauvegardeOuverte();
  const desk = useDesk();
  // Un compte : l'accueil en blocs, composé selon ses briques (components/bs/accueil-briques.tsx).
  // La démo et l'écurie sans compte gardent l'accueil d'avant, qui montre tout.
  const [compte] = useState(() => getSession()?.kind === "compte");
  if (compte)
    return (
      <Page className="ac-acc">
        <AccueilBriques
          chemin={<Chemin />}
          mois={
            <>
              <Compteur href="/argent" ill />
              <CeQuiManque />
            </>
          }
          journee={<Journee delay={0.16} max={5} />}
        />
        <div className="end" />
      </Page>
    );

  if (!desk)
    return (
      <Page className="ac-acc">
        <BandeauExemple />
        <Compteur href="/argent" ill />
        <CeQuiManque />
        <AideCarte compact />
        <Chemin />
        <LigneHier />
        <Journee delay={0.16} max={5} />
        <UneChose />
        <PromoMonEcurie small />
        <div className="end" />
      </Page>
    );
  return (
    <Page wide className="ac-acc ac-desk">
      <BandeauExemple />
      <div className="ac-dtop">
        <div>
            <Compteur href="/argent" ill />
          <CeQuiManque />
          <AideCarte compact />
          <Chemin />
          <LigneHier />
          <UneChose />
        </div>
        <div>
          <Journee delay={0.12} max={8} />
          <Equipe />
        </div>
      </div>
      <PromoMonEcurie small />
      <div className="end" />
    </Page>
  );
}

/** La démo se dit : une ligne ténue en tête, « Écurie d'exemple », et la porte pour en sortir. */
function BandeauExemple() {
  const [demo] = useState(() => getSession()?.kind === "demo");
  if (!demo) return null;
  return (
    <p className="ac-ex rise">
      <span>
        <b>Écurie d’exemple</b> · rien n’est à ton nom
      </span>
      <button type="button" className="lnk" onClick={() => leave("/bienvenue")}>
        Quitter l’exemple
      </button>
    </p>
  );
}

/** Une seule chose à faire à la fois : la fin du mois d'abord, sinon les chevaux à nommer (le chemin s'en charge tant qu'il est là). */
function UneChose() {
  const fin = useFinDuMois();
  const chemin = useCheminActif();
  if (fin && fin.count) return <BandeauFinDuMois />;
  if (chemin) return null;
  return <NommerChevaux />;
}

/** Ta journée, courte : ce qui a compté (avec ×), puis ce qui vient. */
function Journee({ delay, max }: { delay: number; max: number }) {
  const data = useDataStore();
  const { today, time } = useMaintenant();
  const items = useMemo(() => dayItems(data, today, today, time), [data, today, time]);
  const comptes = items.filter((i) => i.type !== "task" && i.done);
  const avenir = items.filter((i) => !i.done);
  // Ce qui vient d'abord, puis ce qui a compté : au plus `max` lignes en tout.
  const shownNext = avenir.slice(0, max);
  const shownDone = comptes.slice(-Math.max(0, max - shownNext.length));
  const shown = [...shownDone, ...shownNext].sort((a, b) => (a.start ?? "99").localeCompare(b.start ?? "99"));
  const reste = items.filter((i) => !(i.type === "task" && i.done)).length - shown.length;
  const debutant = useDebutant();
  const jamais = useJamaisNote();
  return (
    <Sec title="Ta journée" action={<Link href="/planning">Tout le planning</Link>} delay={delay} className="ac-jour">
      {!items.length && jamais ? (
        <JourneeMontree />
      ) : !items.length ? (
        <p className="note ac-jnote">Rien de prévu aujourd’hui. Touche le + pour ajouter une séance, un soin ou une tâche.</p>
      ) : !shown.length ? (
        <Empty ill="dodo">
          <b>Tout est fait pour aujourd’hui.</b>
        </Empty>
      ) : (
        <>
          <div className="rows">
            {shown.map((it) => (
              <LigneJour key={it.key} it={it} />
            ))}
          </div>
          {debutant && shownDone.length > 0 && <p className="note cp-hint">Pas eu lieu ? Retire la ligne.</p>}
          {reste > 0 && (
            <p className="note ac-jnote">
              <Link className="lnk" href="/planning">
                Et {reste} de plus au planning
              </Link>
            </p>
          )}
        </>
      )}
    </Sec>
  );
}

/** Des chevaux encore nommés « Cheval 1 », « Cheval 2 » : une invite discrète à leur donner un nom. */
function NommerChevaux() {
  const horses = useDataStore((s) => s.horses);
  const sansNom = horses.filter((h) => !h.isArchived && /^cheval\s*\d+$/i.test(h.name.trim()));
  if (!sansNom.length) return null;
  const first = sansNom[0];
  return (
    <Link href={sansNom.length > 1 ? "/chevaux?vue=chevaux" : `/ticket?id=${first.id}`} className="ac-nom rise" style={{ animationDelay: "0.1s" }}>
      <Face horse={first} />
      <span>
        <b>Donne un nom à tes chevaux</b>
        <small>{sansNom.length > 1 ? `${sansNom.length} chevaux portent encore un numéro : ${first.name}, ${sansNom[1].name}…` : `${first.name} n’a pas encore son vrai nom.`}</small>
      </span>
      <Ic n="chev" className="chev" />
    </Link>
  );
}

/** Ordinateur : les tâches d'équipe qui comptent aujourd'hui (en retard, du jour, en cours). */
function Equipe() {
  const data = useDataStore();
  const today = localToday();
  const done = data.taskLists?.find((l) => l.isDone)?.id;
  const doing = data.taskLists?.find((l) => !l.isDone && /cours/i.test(l.title))?.id;
  const tasks = (data.tasks ?? []).filter((t) => t.listId !== done && !(t.kind === "rdv" && t.due && t.due.slice(0, 10) < today) && ((t.due && t.due.slice(0, 10) <= today) || t.listId === doing)).slice(0, 5);
  if (!tasks.length) return null;
  return (
    <Sec title="L’équipe" action={<Link href="/equipe">Voir les tâches</Link>} delay={0.34}>
      {tasks.map((t) => {
        const late = !!t.due && t.due.slice(0, 10) < today;
        return (
          <Link key={t.id} href="/equipe" className="li">
            <span className="ini" aria-hidden="true">
              <Ic n={t.kind === "rdv" ? "clock" : "board"} className="mt-ic" />
            </span>
            <span>
              <b>{t.title}</b>
              <small>
                {[t.forWho.join(", "), t.due ? (late ? "" : t.due.slice(0, 10) === today ? "aujourd’hui" : "") : "en cours"].filter(Boolean).join(" · ")}
                {late && (
                  <>
                    {t.forWho.length ? " · " : ""}
                    <b className="mt-late">en retard</b>
                  </>
                )}
              </small>
            </span>
            <Ic n="chev" className="chev" />
          </Link>
        );
      })}
    </Sec>
  );
}
