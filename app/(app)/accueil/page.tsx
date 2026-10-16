"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDesk } from "@/components/bs/desk";
import { dayItems } from "@/lib/domain/seances";
import { Compteur } from "@/components/bs/compteur";
import { Tournee } from "@/components/bs/tournee";
import { PilePaniers, usePaniers } from "@/components/bs/paniers";
import { DayBlock } from "@/components/bs/day-block";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { Empty, Face, Ic, Money, Page, Sec } from "@/components/carnet/ui";

/**
 * L'accueil, en trois parties : le compteur du mois en grand (le gérant
 * assis dessus, la sacoche, la part encore à valider), la pile des paniers,
 * puis ta journée en quelques lignes. La tournée du matin s'ouvre par-dessus
 * une fois par jour. Sur ordinateur : compteur et pile côte à côte, la
 * journée et l'équipe dessous.
 */
export default function AccueilPage() {
  return (
    <ClientGate>
      <Accueil />
      <Tournee />
    </ClientGate>
  );
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

function Accueil() {
  const desk = useDesk();
  const { count, total } = usePaniers();

  const valider = (
    <>
      <Sec ill="confirmer" title="À valider" action={<Link href="/chevaux?vue=clients">Clients</Link>} delay={0.12} className="ac-vhead">
        <p className="note ac-vnote">
          {count ? (
            <>
              {pl(count, "client")} · <Money v={total} /> à valider
            </>
          ) : (
            "Ce qui a eu lieu arrive ici, rangé par client."
          )}
        </p>
      </Sec>
      <div className="ac-pile rise" style={{ animationDelay: "0.2s" }}>
        <PilePaniers />
      </div>
    </>
  );

  if (!desk)
    return (
      <Page className="ac-acc">
        <Compteur href="/argent" perch="gerant-assise" />
        <NommerChevaux />
        {valider}
        <Journee delay={0.3} max={4} />
        <div className="end" />
      </Page>
    );
  return (
    <Page wide className="ac-acc ac-desk">
      <div className="ac-dtop">
        <div>
          <Compteur href="/argent" perch="gerant-assise" />
          <NommerChevaux />
        </div>
        <div>{valider}</div>
      </div>
      <div className="ac-dbot">
        <Journee delay={0.28} max={8} />
        <Equipe />
      </div>
      <div className="end" />
    </Page>
  );
}

/** Ta journée, courte : ce qui est prévu aujourd'hui, sans ce qui attend déjà dans un panier. */
function Journee({ delay, max }: { delay: number; max: number }) {
  const data = useDataStore();
  const { paniers } = usePaniers();
  const today = localToday();
  const now = hhmm();
  const items = useMemo(() => {
    const dansPanier = new Set(paniers.flatMap((p) => p.lignes.map((l) => l.itemKey)));
    return dayItems(data, today, today, now).filter((i) => !dansPanier.has(i.key));
  }, [data, paniers, today, now]);
  const left = items.filter((i) => !i.done);
  const shown = left.slice(0, max);
  const reste = left.length - shown.length;
  return (
    <Sec ill="carnet-buste" title="Ta journée" action={<Link href="/planning">Planning</Link>} delay={delay}>
      {!items.length ? (
        <p className="note ac-jnote">Rien de prévu aujourd’hui. Touche le + pour prévoir une séance, un soin ou une tâche.</p>
      ) : !left.length ? (
        <Empty ill="dodo">
          <b>Tout est fait pour aujourd’hui.</b>
        </Empty>
      ) : (
        <>
          <div className="rows">
            {shown.map((it) => (
              <DayBlock key={it.key} it={it} />
            ))}
          </div>
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
  const tasks = (data.tasks ?? []).filter((t) => t.listId !== done && ((t.due && t.due.slice(0, 10) <= today) || t.listId === doing)).slice(0, 5);
  if (!tasks.length) return <div />;
  return (
    <Sec ill="gerant-buste" title="L’équipe" action={<Link href="/equipe">Voir les tâches</Link>} delay={0.34}>
      {tasks.map((t) => {
        const late = !!t.due && t.due.slice(0, 10) < today;
        return (
          <Link key={t.id} href="/equipe" className="li">
            <span className="ini" aria-hidden="true">
              <Ic n="board" className="mt-ic" />
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
