"use client";

import Link from "next/link";
import { useState } from "react";
import { Ic, Ill, eur } from "@/components/carnet/ui";
import type { LectureBilan } from "@/lib/domain/bilan";
import "@/app/carnet/bilan.css";

/** « 440 € » sans espace cassable au milieu d'une phrase. */
const e = (n: number) => eur(n).replace(/\s/g, " ");

const RAISONS = [
  {
    k: "Peu de demandes",
    t: "Alors la question est la demande autour de toi, plus que ta fiche. Ta fiche bestable.fr est ce que les cavaliers voient d’abord de ton écurie : prix, places, photos.",
    lien: { href: "/ma-fiche", label: "Voir ma fiche" },
  },
  {
    k: "Je choisis qui j’accueille",
    t: "Alors ce n’est pas un manque à gagner, c’est ta façon de tenir l’écurie. Le bilan n’en parle plus.",
  },
  {
    k: "Un départ récent",
    t: "Souvent une affaire de saison. Une annonce sur ta fiche, avec tes vraies photos et ce qui est compris, part en quelques minutes.",
    lien: { href: "/ma-fiche", label: "Compléter ma fiche" },
  },
  {
    k: "Je ne sais pas",
    t: "C’est la première chose à savoir avant de chercher un cavalier : est-ce qu’on te demande, et ce que proposent les écuries du coin.",
    lien: { href: "/ma-fiche", label: "Voir ma fiche" },
  },
] as const;

/**
 * Le bilan qui ne tranche pas : ce que disent les chiffres, puis les pistes
 * avec ce qui les fait marcher ou coincer, et ce que le bilan ne sait pas
 * encore. Le gérant connaît son écurie : le bilan éclaire, il ne décide pas.
 */
export function BilanLecture({ l }: { l: LectureBilan }) {
  const [raison, setRaison] = useState<string | null>(null);
  const choisie = RAISONS.find((r) => r.k === raison);
  const retour = "?retour=parcours/arrivee";
  return (
    <div className="bl rise" style={{ animationDelay: ".14s" }}>
      {l.coutCheval !== null && l.pension !== null && (
        <>
          <h2 className="bl-h2">Ce que disent tes chiffres</h2>
          <div className="bl-cst">
            <span className="bl-k">Un cheval chez toi</span>
            <div className="bl-cmp">
              <div>
                <span>coûte environ</span>
                <b className="num">{eur(l.coutCheval)}</b>
                <i style={{ width: `${Math.min(100, (l.coutCheval / Math.max(l.coutCheval, l.pension)) * 100)}%` }} />
              </div>
              <div className="p">
                <span>la pension rapporte</span>
                <b className="num">{eur(l.pension)}</b>
                <i style={{ width: `${Math.min(100, (l.pension / Math.max(l.coutCheval, l.pension)) * 100)}%` }} />
              </div>
            </div>
            <p>
              Tes frais et les soins partagés entre tes chevaux{l.miens ? ", les tiens compris" : ""}.{" "}
              {l.ecart !== null && l.ecart > 0
                ? l.cours > 0
                  ? `Chaque pension laisse un écart d’environ ${e(l.ecart)} : ce sont tes cours et tes prestations, environ ${e(l.cours)} par mois, qui le comblent.`
                  : `Chaque pension laisse un écart d’environ ${e(l.ecart)}. Tes cours, une fois notés, diront s’ils le comblent.`
                : l.ecart !== null && l.ecart < 0
                  ? `Chaque pension paie sa part et laisse environ ${e(-l.ecart)} de plus.`
                  : "Chaque pension paie juste sa part."}
            </p>
            <Ill n="tete" className="bl-cst-ill" />
          </div>
          {l.memePlein && (
            <div className="bl-note">
              <b>Même pleine, ta pension ne paie pas tes frais.</b>
              <p>
                Avec tes {l.memePlein.places} places en pension, il manque encore environ {e(l.memePlein.manque)} par mois.{" "}
                {l.cours > 0 ? "Tes cours ne sont pas un plus : ils tiennent l’écurie." : "Ce sont tes cours et tes prestations qui feront la différence : note-les, et le bilan te dira s’ils suffisent."}
              </p>
            </div>
          )}
          {l.miens > 0 && (
            <div className="bl-note">
              <b>{l.miens > 1 ? "Tes chevaux comptent" : "Ton cheval compte"} dans les frais.</b>
              <p>Environ {e(l.coutMiens)} par mois. Ce n’est pas une erreur, c’est un choix ; il est juste utile de le voir dans le calcul.</p>
            </div>
          )}
        </>
      )}

      <h2 className="bl-h2">Les pistes, et ce qu’elles demandent</h2>
      {l.libres !== null && l.libres > 0 && (
        <Piste
          n={1}
          titre={`Tes ${l.libres} place${l.libres > 1 ? "s" : ""} libre${l.libres > 1 ? "s" : ""}`}
          gain={`Une place remplie ne rapporte pas ${l.pension ? e(l.pension) : "toute sa pension"} : il faut retirer ce que coûte un cheval de plus (foin, paille, litière).${l.fraisEnUnTotal ? " Avec tes frais en un seul total, on ne peut pas encore le chiffrer." : ""}`}
          ok="des cavaliers cherchent près de chez toi et ce que tu proposes leur va : box, pré, manège, sorties."
          ko="la demande est faible dans ton coin ou en cette saison, ou si ces places sont libres par choix."
        >
          <div className="bl-ask">
            <p className="bl-q">Pourquoi sont-elles libres, d’après toi ?</p>
            <div className="bl-chips" role="radiogroup" aria-label="Pourquoi tes places sont libres">
              {RAISONS.map((r) => (
                <button key={r.k} type="button" role="radio" aria-checked={raison === r.k} className={raison === r.k ? "on" : undefined} onClick={() => setRaison(r.k)}>
                  {r.k}
                </button>
              ))}
            </div>
            {choisie && (
              <div className="bl-ans">
                <p>{choisie.t}</p>
                {"lien" in choisie && choisie.lien && (
                  <Link href={choisie.lien.href} className="bl-fix">
                    {choisie.lien.label} <Ic n="arrow" className="" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </Piste>
      )}
      {l.hausse && (
        <Piste
          n={l.libres ? 2 : 1}
          titre="Ton prix"
          gain={
            <>
              Tu es à {e(l.hausse.depart)}. {e(l.hausse.pas)} de plus à tes pensions font {e(l.hausse.gain)} par mois ; <em className="bl-hl">un seul départ en fait {e(l.hausse.depart)} de moins</em>
              {l.hausse.depart >= l.hausse.gain ? " et efface la hausse." : "."}
            </>
          }
          ok="ce que tu proposes vaut celui des écuries plus chères, et tes clients le savent."
          ko="tes clients sont là pour le prix, ou si une écurie voisine propose la même chose moins cher."
        >
          <div className="bl-ways">
            <p className="bl-q">Trois façons de bouger, chacune avec son prix</p>
            <div>
              <b>Le nouveau prix pour les nouveaux arrivants</b>
              <small>Aucun risque pour tes clients actuels. Le gain vient lentement.</small>
            </div>
            <div>
              <b>Refacturer ce qui est offert aujourd’hui</b>
              <small>Soins, compléments, couvertures. Souvent mieux accepté, mais il faut le noter chaque mois.</small>
            </div>
            <div>
              <b>Une hausse pour tous, annoncée tôt et expliquée</b>
              <small>Le gain le plus rapide, et le seul qui peut faire partir quelqu’un.</small>
            </div>
            <Link href={`/parcours/tarifs${retour}`} className="bl-fix">
              Revoir mes prix <Ic n="arrow" className="" />
            </Link>
          </div>
        </Piste>
      )}
      <Piste
        n={(l.libres ? 1 : 0) + (l.hausse ? 1 : 0) + 1}
        titre="Qu’on te trouve"
        gain="Une fiche complète n’amène pas de clients à elle seule : elle compte quand quelqu’un cherche déjà près de chez toi."
        ok="ton secteur a de la demande et que les cavaliers comparent en ligne avant de visiter."
        ko="tout passe par le bouche-à-oreille chez toi ; alors ta fiche sert surtout à rassurer."
      >
        <Link href="/ma-fiche" className="bl-fix">
          Voir ma fiche <Ic n="arrow" className="" />
        </Link>
      </Piste>

      <h2 className="bl-h2">Ce que le bilan ne sait pas encore</h2>
      <div className="bl-unk">
        {l.fraisEnUnTotal && (
          <Link href={`/parcours/factures${retour}`}>
            <b>Tes frais poste par poste</b>
            <small>pour savoir ce que coûte vraiment un cheval de plus.</small>
          </Link>
        )}
        <div>
          <b>Ce que chaque cheval prend en plus</b>
          <small>soins, travail, cours au-delà du forfait : tout se note avec le +.</small>
        </div>
        <div>
          <b>La demande autour de toi</b>
          <small>qui cherche une pension près de chez toi, et à quel prix.</small>
        </div>
      </div>
    </div>
  );
}

function Piste({ n, titre, gain, ok, ko, children }: { n: number; titre: string; gain: React.ReactNode; ok: string; ko: string; children?: React.ReactNode }) {
  return (
    <section className="bl-opt">
      <div className="bl-opt-hd">
        <span className="n">{n}</span>
        <h3>{titre}</h3>
      </div>
      <p className="bl-g">{gain}</p>
      <div className="bl-okko">
        <div className="ok">
          <span>Ça peut marcher si</span>
          {ok}
        </div>
        <div className="ko">
          <span>Ça coince si</span>
          {ko}
        </div>
      </div>
      {children}
    </section>
  );
}
