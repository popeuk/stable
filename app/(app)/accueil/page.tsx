"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDesk } from "@/components/bs/desk";
import { dayItems } from "@/lib/domain/seances";
import { Compteur } from "@/components/bs/compteur";
import { BandeauFinDuMois, LigneHier, LigneJour, useDebutant, useFinDuMois, useMaintenant } from "@/components/bs/compte";
import { AideCarte } from "@/components/bs/nav";
import { PromoMonEcurie } from "@/components/bs/promo-mon-ecurie";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { Empty, Face, Ic, Page, Sec } from "@/components/carnet/ui";

/**
 * L'accueil, dans l'ordre : le chiffre du mois (le personnage à côté), la
 * ligne « Hier : … ont compté » qui ouvre la tournée du matin si on veut,
 * ta journée en pleine largeur, une seule chose à faire à la fois (fin du
 * mois, ou des chevaux à nommer), et l'encart mon-ecurie.fr réduit, tout en
 * bas. L'aide de la première visite tient en une ligne, sous le chiffre.
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
  const desk = useDesk();

  if (!desk)
    return (
      <Page className="ac-acc">
        <Compteur href="/argent" ill />
        <AideCarte compact />
        <LigneHier />
        <Journee delay={0.12} max={5} />
        <UneChose />
        <PromoMonEcurie small />
        <div className="end" />
      </Page>
    );
  return (
    <Page wide className="ac-acc ac-desk">
      <div className="ac-dtop">
        <div>
          <Compteur href="/argent" ill />
          <AideCarte compact />
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

/** Une seule chose à faire à la fois : la fin du mois d'abord, sinon les chevaux à nommer. */
function UneChose() {
  const fin = useFinDuMois();
  if (fin && fin.count) return <BandeauFinDuMois />;
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
  return (
    <Sec title="Ta journée" action={<Link href="/planning">Tout le planning</Link>} delay={delay} className="ac-jour">
      {!items.length ? (
        <p className="note ac-jnote">Rien de prévu aujourd’hui. Touche le + pour prévoir une séance, un soin ou une tâche.</p>
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
    <Link href={sansNom.length > 1 ? "/chevaux?vue=chevaux" : `/ticket?id=${first.id}`} className="card ac-nom rise" style={{ animationDelay: "0.1s" }}>
      <Face horse={first} />
      <span>
        <b>Donne un nom à tes chevaux</b>
        <small>{sansNom.length > 1 ? `${sansNom.length} s’appellent encore « ${first.name} », « ${sansNom[1].name} »…` : `« ${first.name} » attend son vrai nom.`}</small>
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
