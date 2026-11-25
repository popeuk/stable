"use client";

import { CartePoint, SCENES, scene } from "@/components/bs/presence";
import { compte, type Etape } from "@/lib/presence";

export const COULEUR: Record<string, string> = { ko: "var(--out)", mid: "#B7791F", ok: "#2E9B6A" };

/**
 * Une étape de l'audit, comme la vit le cavalier : l'image, le verdict, le
 * compte (à corriger, à revoir, c'est bon), puis les points dans cet ordre.
 * Sert à l'audit et aux onglets Te trouver et Te choisir (26 novembre 2026).
 */
export function PanneauEtape({ e }: { e: Etape }) {
  const c = compte(e);
  const groupes = [
    ["ko", "À corriger"],
    ["mid", "À revoir"],
  ] as const;
  const oks = e.points.filter((p) => p.etat === "ok");
  return (
    <>
      <div className="pr-acover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scene(SCENES[e.id])} alt="" />
        <div className="ov">
          <b>{e.titre}</b>
          <span>{e.scene}</span>
        </div>
      </div>
      <p className="pr-verdict">{e.verdict}</p>
      <div className="pr-score3">
        <div className="pr-s-ko">
          <b>{c.ko}</b>
          <span>à corriger</span>
        </div>
        <div className="pr-s-mid">
          <b>{c.mid}</b>
          <span>à revoir</span>
        </div>
        <div className="pr-s-ok">
          <b>{c.ok}</b>
          <span>c’est bon</span>
        </div>
      </div>

      {groupes.map(([k, t]) => {
        const l = e.points.filter((p) => p.etat === k);
        if (!l.length) return null;
        return (
          <div key={k} className="pr-grp">
            <div className="pr-grp-h">
              <span style={{ background: COULEUR[k] }} />
              <b>{t}</b>
              <small>{l.length}</small>
            </div>
            <div className="pr-pts">
              {l.map((p) => (
                <CartePoint key={p.id} p={p} />
              ))}
            </div>
          </div>
        );
      })}
      {oks.length > 0 && (
        <div className="pr-grp">
          <div className="pr-grp-h">
            <span style={{ background: COULEUR.ok }} />
            <b>C’est bon</b>
            <small>{oks.length}</small>
          </div>
          <div className="pr-oklist">
            {oks.map((p) => (
              <CartePoint key={p.id} p={p} />
            ))}
          </div>
        </div>
      )}

      {e.id === 1 && <p className="pr-bientot">Bientôt, l’audit lira aussi ta fiche Google, ton site et ta page Facebook.</p>}
      {e.id === 2 && (
        <div className="pr-myth">
          <p className="pr-q">
            <span>«</span> Si j’affiche mon prix, mes concurrents vont le voir. <span>»</span>
          </p>
          <p className="pr-who">Ce qu’on entend le plus chez les gérants.</p>
          <div className="ans">
            <div>
              <strong>Ce qui est vrai</strong>Ils le verront. Mais un concurrent qui veut ton prix l’a déjà : un coup de fil suffit.
            </div>
            <div>
              <strong>Ce qu’on oublie</strong>Un cavalier, lui, compare sans appeler. Ce que tu caches, tu le caches surtout à lui.
            </div>
          </div>
          <div className="ifs">
            <div className="y">
              <strong>Ça marche si</strong>ton prix est le même pour tous.
            </div>
            <div className="n">
              <strong>Ça coince si</strong>il varie : écris « à partir de ».
            </div>
          </div>
        </div>
      )}
    </>
  );
}
