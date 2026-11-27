"use client";

import type { DayItem } from "@/lib/domain/seances";
import type { StableData } from "@/lib/domain/types";
import { enLigneDuTemps, duree } from "@/lib/domain/journee-temps";
import { prixDe } from "@/lib/domain/prix-client";
import { DayBlock } from "@/components/bs/day-block";
import { Ic, sg } from "@/components/carnet/ui";
import { esc } from "@/components/bs/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { heure } from "@/lib/utils/heure";
import { vibrer } from "@/lib/utils/vibrer";

/**
 * La journée en ligne du temps, dans la DA de l'app du Clos (27 novembre
 * 2026) : l'heure et la durée à gauche, un fil, et une carte par séance
 * (titre, lieu, fin, prix, cavaliers en étiquettes, places, Valider). Une
 * séance en cours est en vert profond ; validée, elle s'éclaircit ; passée
 * sans validation, son point est rose. Soins et tâches gardent leur ligne
 * (DayBlock) dans une carte plus discrète. « Libre » entre deux moments
 * éloignés, « Maintenant » à l'heure qu'il est. Styles : app/da.css (.tl-).
 */
export function JourneeTemps({ items, data, aujourdhui, maintenant }: { items: DayItem[]; data: Pick<StableData, "people" | "horses">; aujourdhui: boolean; maintenant: string }) {
  const openSeance = useUiStore((s) => s.openSeance);
  const say = useUiStore((s) => s.say);
  const aPart = items.filter((it) => !it.start);
  const ligne = items.filter((it) => !!it.start);
  const nom = (id: string) => data.people?.find((p) => p.id === id)?.name ?? "";

  const valider = (it: DayItem) => {
    const s = it.seance;
    if (!s) return;
    if (s.participants.length > 1) return openSeance(s.id);
    const st = useDataStore.getState();
    const snap = { seances: st.seances, revenues: st.revenues };
    st.validateSeance(s.id, {});
    vibrer();
    say(`Validée : <strong>${esc(it.title)}</strong>${it.money ? `, ${sg(it.money)}` : ""}.`, () => useDataStore.setState(snap));
  };

  return (
    <>
      {aPart.length > 0 && (
        <div className="tl-apart">
          <h3>Dans la journée</h3>
          <div className="rows">
            {aPart.map((it) => (
              <DayBlock key={it.key} it={it} showTime={false} />
            ))}
          </div>
        </div>
      )}
      {ligne.length > 0 && (
        <div className="tl-ligne">
          {enLigneDuTemps(ligne, aujourdhui ? maintenant : null).map((p) => {
            if (p.kind === "libre")
              return (
                <div key={p.key} className="tl-libre">
                  <span className="tl-h" />
                  <span>Libre · {duree(p.minutes)}</span>
                </div>
              );
            if (p.kind === "maintenant")
              return (
                <div key={p.key} className="tl-now" role="img" aria-label={`Maintenant, ${heure(maintenant)}`}>
                  <span className="tl-h">{heure(maintenant)}</span>
                  <span className="tl-now-l">
                    <i />
                    Maintenant
                  </span>
                </div>
              );
            const it = p.it;
            const debut = it.start!;
            const fin = it.end ?? debut;
            const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
            const longueur = it.end ? min(fin) - min(debut) : 0;
            if (it.type !== "seance" || !it.seance) {
              return (
                <div key={it.key} className="tl-autre">
                  <span className="tl-h">{heure(debut)}</span>
                  <div className="rows">
                    <DayBlock it={it} showTime={false} />
                  </div>
                </div>
              );
            }
            const s = it.seance;
            const fait = s.status === "done";
            const live = aujourdhui && !fait && debut <= maintenant && fin > maintenant;
            const attend = !fait && it.late;
            const qui = s.participants.map((x) => ({ n: nom(x.personId), absent: x.present === false, prix: prixDe(x, s.unitPrice) })).filter((x) => x.n);
            const places = s.format === "collectif" ? s.places ?? null : null;
            const montres = qui.slice(0, 6);
            return (
              <div key={it.key} className={`tl-cours${fait ? " fait" : ""}${live ? " live" : ""}${attend ? " passe" : ""}`}>
                <span className="tl-h">
                  {heure(debut)}
                  {longueur > 0 && <small>{duree(longueur)}</small>}
                </span>
                <div className="tl-carte">
                  {live && (
                    <p className="tl-live">
                      <i />
                      En ce moment · encore {duree(min(fin) - min(maintenant))}
                    </p>
                  )}
                  <button type="button" className="tl-main" onClick={() => openSeance(s.id)}>
                    <span className="tl-t">
                      <b>{it.title}</b>
                      <small>{[it.sub, it.end ? `jusqu’à ${heure(fin)}` : ""].filter(Boolean).join(" · ")}</small>
                    </span>
                    {it.money ? <span className="tl-prix">{sg(it.money)}</span> : null}
                  </button>
                  <div className="tl-pied">
                    {qui.length > 0 ? (
                      <div className="tl-qui">
                        {montres.map((x, i) => (
                          <span key={`${x.n}-${i}`} className={x.absent ? "absent" : undefined}>
                            {x.n}
                          </span>
                        ))}
                        {qui.length > montres.length && <span className="plus">+{qui.length - montres.length}</span>}
                        {places != null && (
                          <em className="tl-places" aria-label={`${qui.length} sur ${places} places`}>
                            {Array.from({ length: places }, (_, i) => (
                              <i key={i} className={i < qui.length ? "" : "libre"} />
                            ))}
                          </em>
                        )}
                      </div>
                    ) : (
                      <p className="tl-vide">{s.horseIds.length ? "Travail des chevaux" : "Personne d’inscrit pour l’instant"}</p>
                    )}
                    {attend && (
                      <button type="button" className="tl-valider" onClick={() => valider(it)} aria-label={s.participants.length > 1 ? `Qui était là : ${it.title}` : `Valider : ${it.title}`}>
                        {s.participants.length > 1 ? "Qui était là ?" : "Valider"}
                      </button>
                    )}
                    {fait && (
                      <span className="tl-fait">
                        <Ic n="ck" className="" />
                        Validée
                      </span>
                    )}
                  </div>
                  {live && (
                    <span className="tl-barre">
                      <i style={{ transform: `scaleX(${Math.min(1, Math.max(0, (min(maintenant) - min(debut)) / Math.max(1, longueur)))})` }} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
