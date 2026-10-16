"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClientGate } from "@/components/ui/client-gate";
import { useDesk } from "@/components/bs/desk";
import { dayItems } from "@/lib/domain/seances";
import { Compteur } from "@/components/bs/compteur";
import { Tournee } from "@/components/bs/tournee";
import { BandeauFinDuMois, LigneJour, useMaintenant } from "@/components/bs/compte";
import { PromoMonEcurie } from "@/components/bs/promo-mon-ecurie";
import { useDataStore } from "@/stores/data-store";
import { localToday } from "@/lib/utils/local-date";
import { Empty, Face, Ic, Page, Sec } from "@/components/carnet/ui";

/**
 * L'accueil : le compteur du mois en grand (le gérant assis dessus, la
 * sacoche), en fin de mois le bandeau « Fin du mois : n clients à faire
 * payer », puis ta journée. Ce qui est passé a compté tout seul : la ligne
 * le dit, avec × si ça n'a pas eu lieu. La tournée du matin s'ouvre
 * par-dessus une fois par jour. Sur ordinateur : compteur et journée côte à
 * côte, l'équipe et l'encart mon-ecurie.fr dessous ; sur téléphone, l'encart
 * ferme la page.
 */
export default function AccueilPage() {
  return (
    <ClientGate>
      <Accueil />
      <Tournee />
    </ClientGate>
  );
}

function Accueil() {
  const desk = useDesk();

  if (!desk)
    return (
      <Page className="ac-acc">
        <Compteur href="/argent" perch="gerant-assise" />
        <BandeauFinDuMois />
        <NommerChevaux />
        <Journee delay={0.12} max={5} />
        <PromoMonEcurie />
        <div className="end" />
      </Page>
    );
  return (
    <Page wide className="ac-acc ac-desk">
      <div className="ac-dtop">
        <div>
          <Compteur href="/argent" perch="gerant-assise" />
          <BandeauFinDuMois />
          <NommerChevaux />
        </div>
        <div>
          <Journee delay={0.12} max={8} />
        </div>
      </div>
      <div className="ac-dbot">
        <Equipe />
        <PromoMonEcurie small />
      </div>
      <div className="end" />
    </Page>
  );
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
  return (
    <Sec ill="carnet-buste" title="Ta journée" action={<Link href="/planning">Planning</Link>} delay={delay} className="ac-jour">
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
          {shownDone.length > 0 && <p className="note cp-hint">Pas eu lieu ? Retire la ligne.</p>}
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
  if (!tasks.length) return <div />;
  return (
    <Sec ill="gerant-buste" title="L’équipe" action={<Link href="/equipe">Voir les tâches</Link>} delay={0.34}>
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
