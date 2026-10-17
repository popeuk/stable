"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSettingsStore, type ObstacleId } from "@/stores/settings-store";
import { useDataStore } from "@/stores/data-store";
import { ClientGate } from "@/components/ui/client-gate";
import { Ic, Ill, eur, type IllName } from "@/components/carnet/ui";
import { OBSTACLE_META, estAMoi, fraisDuMois, useParcours } from "@/components/bs/parcours";

/**
 * Tes premiers pas : un chemin, pas une liste. Le personnage ouvre, trois
 * questions illustrées se suivent sur un tracé (la question du moment en
 * grand, les autres en attente), et le mois au bout. Les trois étapes qui
 * viennent en utilisant l'app restent discrètes, sous le chemin.
 */
const CHAPITRES: { id: ObstacleId; ill: IllName; alt: string; dit: string }[] = [
  { id: "chevaux", ill: "tete", alt: "Un cheval passe la tête.", dit: "Combien sont chez toi, et ce qu’ils paient." },
  { id: "tarifs", ill: "sacoche", alt: "Une sacoche pleine de pièces.", dit: "La pension, et tes cours si tu en donnes." },
  { id: "factures", ill: "brouette", alt: "La gérante pousse une brouette de foin.", dit: "Foin, paille, loyer… À peu près, ça suffit." },
];
const ENSUITE: ObstacleId[] = ["journee", "ticket", "seuil"];

export default function Page() {
  return (
    <ClientGate>
      <Parcours />
    </ClientGate>
  );
}

function Parcours() {
  const { parcours, current, setupDone } = useParcours();
  const router = useRouter();
  const plusTard = useSettingsStore((s) => s.remettreParcours);
  const presents = useDataStore((s) => s.horses.filter((h) => !h.isArchived && !estAMoi(h)).length);
  const miens = useDataStore((s) => s.horses.filter((h) => !h.isArchived && estAMoi(h)).length);
  const pension = useDataStore((s) => s.tariffs?.pension);
  const totalFrais = useDataStore((s) => {
    const f = fraisDuMois(s);
    return f.total + f.postes;
  });
  const sortir = () => {
    if (!setupDone) plusTard();
    router.push("/accueil");
  };
  /** Ce que le gérant a déjà dit, en quelques mots, sous la question faite. */
  const dejaDit: Partial<Record<ObstacleId, string>> = {
    chevaux: presents || miens ? [presents && `${presents} en pension`, miens && `${miens} à toi`].filter(Boolean).join(" · ") : undefined,
    tarifs: pension ? `Pension à ${eur(pension)} par mois` : undefined,
    factures: totalFrais ? `${eur(totalFrais)} par mois` : undefined,
  };
  const premiere = !parcours.chevaux && !parcours.tarifs && !parcours.factures;
  const tout = !current;
  const reste = CHAPITRES.filter((c) => !parcours[c.id]).length;

  return (
    <>
      <div className="ar-over">
        <span>Tes premiers pas</span>
        <button type="button" className="x" onClick={sortir} aria-label={setupDone ? "Fermer et aller à l’accueil" : "Finir plus tard et découvrir l’app"}>
          <Ic n="x" className="" />
        </button>
      </div>

      <div className="pas-hero">
        <div className="pas-hero-t rise">
          <h1 className="pas-t1">{setupDone ? "Ton écurie est prête." : premiere ? "Trois questions, et tu vois ton mois." : "On continue ?"}</h1>
          <p className="pas-sub">
            {setupDone
              ? tout
                ? "Tu as fait le tour. Ton mois t’attend."
                : "Le reste vient tout seul, en utilisant l’app."
              : premiere
                ? "Trois minutes. Des chiffres à peu près, ça suffit. Tu changes tout plus tard."
                : reste === 1
                  ? "Encore une question, et tu vois ton mois."
                  : "Encore deux questions, et tu vois ton mois."}
          </p>
        </div>
        <Ill n={setupDone ? "rosette" : "carnet"} className="pas-hero-ill" prio alt={setupDone ? "La gérante brandit une rosette." : "La gérante, son carnet à la main."} />
      </div>

      <ol className="pas-path" aria-label="Les trois questions, puis ton mois">
        {CHAPITRES.map((c, k) => {
          const m = OBSTACLE_META[c.id];
          const fait = parcours[c.id];
          const now = current === c.id;
          const st = fait ? "done" : now ? "now" : "next";
          return (
            <li key={c.id} className={`pas-step ${st} rise`} style={{ animationDelay: `${0.08 + k * 0.06}s` }}>
              <span className="pas-pin" aria-hidden="true">
                {fait ? <Ic n="ck" className="" /> : k + 1}
              </span>
              {now ? (
                <Link href={m.href} className="pas-card">
                  <span className="pas-card-t">
                    <b>{m.title}</b>
                    <span>{c.dit}</span>
                    <span className="btn pas-go">
                      {premiere ? "Commencer" : "Continuer"}
                      <Ic n="arrow" className="ar-ico" />
                    </span>
                  </span>
                  <Ill n={c.ill} alt={c.alt} className="pas-card-ill" />
                </Link>
              ) : fait ? (
                <Link href={m.href} className="pas-row">
                  <span className="pas-row-t">
                    <b>{m.title}</b>
                    <span>{dejaDit[c.id] ?? "C’est fait"}</span>
                  </span>
                  <Ill n={c.ill} alt="" className="pas-row-ill" />
                </Link>
              ) : (
                <span className="pas-row">
                  <span className="pas-row-t">
                    <b>{m.title}</b>
                    <span>{c.dit}</span>
                  </span>
                  <Ill n={c.ill} alt="" className="pas-row-ill" />
                </span>
              )}
            </li>
          );
        })}
        <li className={`pas-step pas-fin ${setupDone ? "now" : "next"} rise`} style={{ animationDelay: ".26s" }}>
          <span className="pas-pin" aria-hidden="true">
            <Ic n="flag" className="" />
          </span>
          {setupDone ? (
            <Link href="/parcours/arrivee" className="pas-card">
              <span className="pas-card-t">
                <b>Ton mois</b>
                <span>Ce qu’il te reste, cheval par cheval.</span>
                <span className="btn pas-go">
                  Voir mon mois
                  <Ic n="arrow" className="ar-ico" />
                </span>
              </span>
              <Ill n="assise" alt="La gérante assise, un café à la main." className="pas-card-ill pas-wide" />
            </Link>
          ) : (
            <span className="pas-row">
              <span className="pas-row-t">
                <b>Ton mois</b>
                <span>Ce qu’il te reste, cheval par cheval.</span>
              </span>
            </span>
          )}
        </li>
      </ol>

      {setupDone && !tout && (
        <section className="pas-ensuite rise" style={{ animationDelay: ".32s" }} aria-labelledby="pas-ensuite-t">
          <h2 id="pas-ensuite-t">Ensuite, en utilisant l’app</h2>
          {ENSUITE.map((o) => {
            const m = OBSTACLE_META[o];
            return (
              <Link key={o} href={m.href} className={`pas-mini${parcours[o] ? " done" : ""}`}>
                <span className="pas-mini-k" aria-hidden="true">
                  {parcours[o] && <Ic n="ck" className="" />}
                </span>
                <span>
                  <b>{m.title}</b>
                  {!parcours[o] && <small>{m.todo}</small>}
                </span>
                <Ic n="arrow" className="ar-ico" />
              </Link>
            );
          })}
        </section>
      )}

      {!setupDone && (
        <button type="button" className="ar-alt pas-later" onClick={sortir}>
          Découvrir l’app d’abord, finir plus tard
        </button>
      )}
    </>
  );
}
