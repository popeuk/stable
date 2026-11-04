"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Ic, eurc } from "@/components/carnet/ui";
import { Jours, hh, jourLabel } from "@/components/bs/seance-form";
import { addDays } from "@/lib/domain/care";
import { applyCours, applySoin, estParticulier, titre, type Draft, type Habitudes, type AjoutType } from "@/lib/domain/ajouter";
import { cleSouple, nomRetenu } from "@/lib/domain/proprio";
import { prixDuCavalier, seriesDates, MAX_SEANCES } from "@/lib/domain/seances";
import type { Horse } from "@/lib/domain/types";
import { lireMontant, montantEnTexte } from "@/lib/utils/montant";
import { useDataStore } from "@/stores/data-store";
import "@/app/carnet/fiche-cartes.css";
import "@/app/carnet/plus-vitrine.css";

/**
 * Le + dans le langage de la vitrine (version du Clos, maquette validée le
 * 4 novembre 2026) : de grandes cartes à cocher, un gros titre et sa phrase
 * d'aide, un seul bouton vert en bas qui dit ce qu'il va faire. Seul
 * l'affichage change : le brouillon (lib/domain/ajouter.ts) et
 * l'enregistrement restent ceux de components/bs/noter-sheet.tsx.
 */

type SetD = (f: (d: Draft) => Draft) => void;

/** « mercredi 4 nov. » */
const jourCourt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
const Maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const COCHE = (
  <span className="fc-case" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  </span>
);

/** Une grande carte : à cocher (plusieurs) ou à choisir (une seule). */
function Carte({ type, on, titre: t, aide, prix, onClick }: { type: "case" | "rond"; on: boolean; titre: ReactNode; aide?: ReactNode; prix?: ReactNode; onClick: () => void }) {
  const attrs = type === "case" ? { "aria-pressed": on } : { role: "radio", "aria-checked": on };
  return (
    <button type="button" className={`fc-carte pv-carte${prix ? " avec-prix" : ""}`} {...attrs} onClick={onClick}>
      {type === "case" ? COCHE : <span className="fc-rond" aria-hidden="true" />}
      <span>
        <b>{t}</b>
        {aide && <small>{aide}</small>}
      </span>
      {prix && <span className="pv-prix">{prix}</span>}
    </button>
  );
}

function Groupe({ titre: t, compte, on, premier, children }: { titre: string; compte?: string; on?: boolean; premier?: boolean; children: ReactNode }) {
  return (
    <div className={`fc-grp${premier ? " premier" : ""}`} role="group" aria-label={t}>
      <div className="fc-grp-h">
        <h3>{t}</h3>
        {compte && <span className={on ? "on" : undefined}>{compte}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---------- L'accueil du + ---------- */
const TYPES: { id: AjoutType; l: string; s: string; i: string }[] = [
  { id: "seance", l: "Une séance", s: "Cours, balade, stage, travail du cheval", i: "cal" },
  { id: "soin", l: "Un soin", s: "Maréchal, véto, vaccin, vermifuge", i: "syringe" },
  { id: "rdv", l: "Une tâche ou un rendez⁠-⁠vous", s: "Avec ou sans heure", i: "clock" },
  { id: "argent", l: "De l’argent", s: "Ça rentre ou ça sort", i: "euro" },
];

export function ChoixVitrine({ onChoose, onVoix }: { onChoose: (t: AjoutType) => void; onVoix: () => void }) {
  return (
    <div className="pv">
      <h2 className="pv-t">Qu’est-ce que tu ajoutes ?</h2>
      <p className="fc-aide">Touche une carte. Tu pourras tout changer après.</p>
      <div className="fc-cartes pv-types">
        {TYPES.map((t) => (
          <button key={t.id} type="button" className="fc-carte pv-carte" onClick={() => onChoose(t.id)}>
            <Ic n={t.i} className="pv-ic" />
            <span>
              <b>{t.l}</b>
              <small>{t.s}</small>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="pv-voix" onClick={onVoix}>
        <Ic n="mic" className="" />
        Le dire à voix haute
      </button>
    </div>
  );
}

/* ---------- Le jour et l'heure ---------- */
const HEURES = ["09:00", "10:00", "14:00", "17:00", "18:00", "19:00", "20:00"];

function Quand({ d, set, today, sansHeure }: { d: Draft; set: SetD; today: string; sansHeure?: boolean }) {
  const demain = addDays(today, 1);
  const autreJour = d.date !== today && d.date !== demain;
  const [ouvert, setOuvert] = useState(false);
  const [autreHeure, setAutreHeure] = useState(() => !!d.start && !HEURES.includes(d.start));
  const heures = sansHeure ? ["", "09:00", "14:00", "18:00"] : HEURES;
  return (
    <>
      <div className="fc-cartes deux">
        <Carte type="rond" on={d.date === today} titre="Aujourd’hui" aide={jourCourt(today)} onClick={() => (set((x) => ({ ...x, date: today })), setOuvert(false))} />
        <Carte type="rond" on={d.date === demain} titre="Demain" aide={jourCourt(demain)} onClick={() => (set((x) => ({ ...x, date: demain })), setOuvert(false))} />
      </div>
      <div className="fc-cartes pv-sous">
        <Carte type="rond" on={autreJour || ouvert} titre="Autre jour" aide={autreJour ? jourCourt(d.date) : "Choisir dans le calendrier"} onClick={() => setOuvert((o) => !o)} />
      </div>
      {ouvert && (
        <div className="pv-jours">
          <Jours date={d.date} today={today} onDate={(date) => (set((x) => ({ ...x, date })), setOuvert(false))} />
        </div>
      )}
      <div className="pv-heures" role="radiogroup" aria-label="L’heure">
        {heures.map((h) => (
          <button key={h || "sans"} type="button" role="radio" aria-checked={!autreHeure && (h ? d.start === h : d.start === null)} onClick={() => (setAutreHeure(false), set((x) => ({ ...x, start: h || null })))}>
            {h ? hh(h) : "Sans heure"}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={autreHeure} onClick={() => setAutreHeure(true)}>
          Autre
        </button>
      </div>
      {autreHeure && (
        <label className="fc-champ pv-champ">
          <span className="fc-boite">
            <input type="time" value={d.start ?? ""} aria-label="L’heure exacte" onChange={(e) => set((x) => ({ ...x, start: e.target.value || null }))} />
          </span>
        </label>
      )}
    </>
  );
}

function Prix({ value, onChange, unite, label, placeholder }: { value: number | null; onChange: (n: number | null) => void; unite: string; label: string; placeholder?: string }) {
  const [texte, setTexte] = useState(value === null ? "" : montantEnTexte(value));
  return (
    <label className="fc-champ pv-champ">
      <span className="fc-boite pv-gros">
        <input
          inputMode="decimal"
          value={texte}
          placeholder={placeholder ?? "0"}
          aria-label={label}
          onChange={(e) => {
            setTexte(e.target.value);
            const n = e.target.value.trim() ? lireMontant(e.target.value) : null;
            onChange(n !== null && n > 0 ? n : null);
          }}
        />
        <span className="u">{unite}</span>
      </span>
    </label>
  );
}

/* ---------- La séance ---------- */
export function SeanceVitrine({ d, set, h, today, horses }: { d: Draft; set: SetD; h: Habitudes; today: string; horses: Horse[] }) {
  const people = useDataStore((s) => s.people);
  const seances = useDataStore((s) => s.seances);
  const [autre, setAutre] = useState(!!d.custom);
  const cours = h.cours.find((c) => c.key === d.coursKey);
  const seul = estParticulier(cours);
  const sansCavalier = !!cours && /travail|longe/i.test(cours.label) && !/cours/i.test(cours.label);
  const actifs = useMemo(() => (people ?? []).filter((p) => p.active), [people]);
  // Les habitués d'abord : ceux qui viennent le plus aux séances.
  const frequents = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of seances ?? []) for (const p of s.participants) n.set(p.personId, (n.get(p.personId) ?? 0) + 1);
    return [...actifs].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.name.localeCompare(b.name, "fr"));
  }, [actifs, seances]);
  const tape = d.cavTape ?? "";
  const q = cleSouple(tape);
  const montres = (q ? frequents.filter((p) => cleSouple(p.name).includes(q)) : frequents.slice(0, 8)).concat(
    // Ceux déjà choisis restent visibles.
    frequents.filter((p) => d.cav.includes(p.name) && !(q ? cleSouple(p.name).includes(q) : frequents.slice(0, 8).includes(p))),
  );
  const exact = !!q && frequents.some((p) => cleSouple(p.name) === q);
  const proprioDe = (nom: string) => horses.filter((x) => x.ownerName?.trim() && cleSouple(x.ownerName) === cleSouple(nom));

  function basculeClient(nom: string) {
    set((x) => {
      const deja = x.cav.includes(nom);
      const cav = seul ? (deja ? [] : [nom]) : deja ? x.cav.filter((n) => n !== nom) : [...x.cav, nom];
      // Le cheval d'un propriétaire se coche avec lui.
      const siens = deja ? [] : proprioDe(nom).map((y) => y.id);
      return { ...x, cav, cavTape: "", horseIds: [...new Set([...x.horseIds, ...siens])] };
    });
  }
  function ajouterTape() {
    const v = nomRetenu(
      (people ?? []).map((p) => p.name),
      tape,
    );
    if (!v || v.includes(",")) return;
    basculeClient(v);
  }

  // Le prix propre de chaque client choisi, s'il diffère.
  const prixPropres = cours
    ? d.cav
        .map((n) => {
          const p = (people ?? []).find((x) => x.name === n);
          const v = prixDuCavalier(p, cours.prestationId, cours.format);
          return v !== undefined && v !== d.price ? `${n} paie ${eurc(v)} (son prix)` : "";
        })
        .filter(Boolean)
    : [];
  const fois = seriesDates(d.date, d.rep, d.until).length;

  return (
    <div className="pv">
      <h2 className="pv-t">Une séance</h2>
      <p className="fc-aide">De haut en bas, puis le bouton vert. Seul le cours est obligatoire.</p>

      <Groupe titre="Quel cours ?" compte={cours ? cours.label : d.custom.trim() || "À choisir"} on={!!cours || !!d.custom.trim()} premier>
        <div className="fc-cartes" role="radiogroup" aria-label="Quel cours">
          {h.cours.slice(0, 6).map((c) => {
            const on = d.coursKey === c.key && !autre;
            return (
              <div key={c.key} className="pv-cours">
                <Carte
                  type="rond"
                  on={on}
                  titre={c.label}
                  aide={[c.format === "particulier" || estParticulier(c) ? "1 cavalier" : c.places && c.places > 1 ? `${c.places} places` : "", c.habit ? `d’habitude à ${hh(c.start)}` : ""].filter(Boolean).join(" · ") || undefined}
                  prix={c.price ? eurc(c.price) : undefined}
                  onClick={() => {
                    setAutre(false);
                    set((x) => {
                      const n = { ...x };
                      applyCours(n, c);
                      if (estParticulier(c)) n.cav = n.cav.slice(0, 1);
                      return n;
                    });
                  }}
                />
                {on && !estParticulier(c) && c.format !== "particulier" && (
                  <div className="fc-compteur pv-compteur">
                    <button type="button" aria-label="Une place de moins" onClick={() => set((x) => ({ ...x, places: Math.max(1, (x.places ?? 6) - 1) }))}>
                      −
                    </button>
                    <span>
                      <strong>{d.places ?? "·"}</strong> places
                    </span>
                    <button type="button" aria-label="Une place de plus" onClick={() => set((x) => ({ ...x, places: Math.min(30, (x.places ?? 0) + 1) }))}>
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <Carte type="rond" on={autre} titre="Autre cours…" aide="Stage, longe, cours d’essai" onClick={() => (setAutre(true), set((x) => ({ ...x, coursKey: null, price: null, places: null })))} />
        </div>
        {autre && (
          <label className="fc-champ pv-champ">
            <span className="fc-boite">
              <input autoFocus value={d.custom} placeholder="Le nom du cours" aria-label="Le nom du cours" onChange={(e) => set((x) => ({ ...x, custom: e.target.value }))} />
            </span>
          </label>
        )}
      </Groupe>

      {!sansCavalier && (
        <Groupe titre="Avec qui ?" compte={d.cav.length ? (seul ? d.cav[0] : `${d.cav.length} client${d.cav.length > 1 ? "s" : ""}`) : seul ? "Un client" : "Plusieurs possibles"} on={d.cav.length > 0}>
          {montres.length > 0 && (
            <div className="fc-cartes deux">
              {montres.map((p) => {
                const siens = proprioDe(p.name);
                return <Carte key={p.id} type={seul ? "rond" : "case"} on={d.cav.includes(p.name)} titre={p.name} aide={siens.length ? `à ${siens.map((y) => y.name).join(", ")}` : undefined} onClick={() => basculeClient(p.name)} />;
              })}
            </div>
          )}
          {d.cav
            .filter((n) => !montres.some((p) => p.name === n))
            .map((n) => (
              <div key={n} className="fc-cartes pv-sous">
                <Carte type={seul ? "rond" : "case"} on titre={n} aide="Nouveau client" onClick={() => basculeClient(n)} />
              </div>
            ))}
          <label className="fc-champ pv-champ">
            <span className="fc-boite">
              <Ic n="search" className="pv-loupe" />
              <input
                value={tape}
                placeholder="Chercher ou ajouter un client"
                aria-label="Chercher ou ajouter un client"
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => set((x) => ({ ...x, cavTape: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouterTape())}
              />
            </span>
          </label>
          {q && !exact && !tape.includes(",") && (
            <div className="fc-cartes pv-sous">
              <Carte type="case" on={false} titre={`Ajouter « ${tape.trim()} »`} aide="Un nouveau client" onClick={ajouterTape} />
            </div>
          )}
          {prixPropres.length > 0 && <p className="ec-help">{prixPropres.join(" · ")}.</p>}
        </Groupe>
      )}

      {horses.length > 0 && (
        <Groupe titre="Quel cheval ?" compte={d.horseIds.length ? horses.filter((x) => d.horseIds.includes(x.id)).map((x) => x.name).join(", ") : "Facultatif"} on={d.horseIds.length > 0}>
          <div className="fc-cartes deux">
            {horses.map((x) => (
              <Carte
                key={x.id}
                type="case"
                on={d.horseIds.includes(x.id)}
                titre={x.name}
                aide={x.pensionType === "À moi" ? "de l’écurie" : x.ownerName ? `à ${x.ownerName}` : undefined}
                onClick={() => set((y) => ({ ...y, horseIds: y.horseIds.includes(x.id) ? y.horseIds.filter((i) => i !== x.id) : [...y.horseIds, x.id] }))}
              />
            ))}
          </div>
          <p className="ec-help">Plusieurs clients peuvent monter le même cheval : chacun reste compté à son nom.</p>
        </Groupe>
      )}

      <Groupe titre="Quand ?" compte={`${Maj(jourLabel(d.date, today))}${d.start ? ` · ${hh(d.start)}` : ""}`} on={!!d.start}>
        <Quand d={d} set={set} today={today} />
        <div className="fc-cartes pv-sous">
          <Carte type="case" on={d.rep === "weekly"} titre="Chaque semaine" aide={d.rep === "weekly" ? `Le même jour, ${fois} fois${fois >= MAX_SEANCES ? " (c’est le maximum)" : ""}` : "Coche si ça revient"} onClick={() => set((x) => ({ ...x, rep: x.rep === "weekly" ? "once" : "weekly" }))} />
        </div>
        {d.rep !== "once" && (
          <label className="fc-champ pv-champ">
            <span className="pv-lab">Jusqu’au</span>
            <span className="fc-boite">
              <input type="date" value={d.until} aria-label="Jusqu’au" onChange={(e) => e.target.value && set((x) => ({ ...x, until: e.target.value }))} />
            </span>
          </label>
        )}
      </Groupe>

      <Groupe titre="Combien ?" compte={d.price ? `${eurc(d.price)} par cavalier` : "Sans prix"} on={!!d.price}>
        <Prix key={d.coursKey ?? "autre"} value={d.price} onChange={(price) => set((x) => ({ ...x, price }))} unite="€ par cavalier" label="Prix par cavalier" />
      </Groupe>
    </div>
  );
}

/** Le bouton et le résumé d'une séance. */
export function resumeSeance(d: Draft, h: Habitudes, today: string, horses: Horse[]): { label: string; recap: string; pret: boolean } {
  const cours = h.cours.find((c) => c.key === d.coursKey);
  const choisi = !!cours || !!d.custom.trim();
  const cav = [...d.cav, ...(d.cavTape?.trim() ? [d.cavTape.trim()] : [])];
  if (!choisi) return { label: "Choisis d’abord le cours", recap: "Seul le cours est obligatoire.", pret: false };
  if (!d.start) return { label: "Choisis l’heure", recap: titre(d, h), pret: false };
  const de = (n: string) => (/^[aeiouyàâäéèêëîïôöûüœ]/i.test(n) ? `d’${n}` : `de ${n}`);
  const label = estParticulier(cours) && cav.length === 1 ? `Ajouter le cours ${de(cav[0])}` : "Ajouter la séance";
  const recap = [
    cav.length ? (cav.length > 2 ? `${cav.length} clients` : cav.join(" et ")) : "personne d’inscrit",
    horses.filter((x) => d.horseIds.includes(x.id)).map((x) => x.name).join(", "),
    `${jourLabel(d.date, today)} ${hh(d.start)}`,
    d.rep === "weekly" ? "chaque semaine" : "",
    d.price ? eurc(d.price) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return { label, recap, pret: true };
}

/* ---------- Le soin ---------- */
export function SoinVitrine({ d, set, h, today, horses }: { d: Draft; set: SetD; h: Habitudes; today: string; horses: Horse[] }) {
  const [autre, setAutre] = useState(!!d.custom);
  const proprios = [...new Set(d.horseIds.map((id) => horses.find((y) => y.id === id)?.ownerName?.trim()).filter(Boolean))];
  return (
    <div className="pv">
      <h2 className="pv-t">Un soin</h2>
      <p className="fc-aide">Quoi, pour quel cheval, quand. Le prix est facultatif.</p>
      <Groupe titre="Quel soin ?" compte={d.custom.trim() || h.soins.find((s) => s.kind === d.care)?.label || "À choisir"} on={!!d.care || !!d.custom.trim()} premier>
        <div className="fc-cartes deux" role="radiogroup" aria-label="Quel soin">
          {h.soins.slice(0, 5).map((s) => (
            <Carte
              key={s.kind}
              type="rond"
              on={!autre && d.care === s.kind}
              titre={s.label}
              aide={[s.price ? eurc(s.price) : "", s.provider].filter(Boolean).join(" · ") || undefined}
              onClick={() => {
                setAutre(false);
                set((x) => {
                  const n = { ...x };
                  applySoin(n, s);
                  return n;
                });
              }}
            />
          ))}
          <Carte type="rond" on={autre} titre="Autre soin…" aide="Tape son nom" onClick={() => (setAutre(true), set((x) => ({ ...x, care: x.custom.trim() ? "soin" : null })))} />
        </div>
        {autre && (
          <label className="fc-champ pv-champ">
            <span className="fc-boite">
              <input autoFocus value={d.custom} placeholder="Le soin" aria-label="Le soin" onChange={(e) => set((x) => ({ ...x, custom: e.target.value, care: e.target.value.trim() ? "soin" : null }))} />
            </span>
          </label>
        )}
      </Groupe>
      {horses.length > 0 && (
        <Groupe titre="Pour quel cheval ?" compte={d.horseIds.length ? horses.filter((x) => d.horseIds.includes(x.id)).map((x) => x.name).join(", ") : "Un ou plusieurs"} on={d.horseIds.length > 0}>
          <div className="fc-cartes deux">
            {horses.map((x) => (
              <Carte key={x.id} type="case" on={d.horseIds.includes(x.id)} titre={x.name} aide={x.pensionType === "À moi" ? "de l’écurie" : x.ownerName ? `à ${x.ownerName}` : undefined} onClick={() => set((y) => ({ ...y, horseIds: y.horseIds.includes(x.id) ? y.horseIds.filter((i) => i !== x.id) : [...y.horseIds, x.id] }))} />
            ))}
          </div>
          <p className="ec-help">Sans cheval, le soin va au planning comme un rendez-vous.</p>
        </Groupe>
      )}
      <Groupe titre="Quand ?" compte={`${Maj(jourLabel(d.date, today))}${d.start ? ` · ${hh(d.start)}` : ""}`} on>
        <Quand d={d} set={set} today={today} sansHeure />
      </Groupe>
      <Groupe titre="Combien ?" compte={d.price ? eurc(d.price) : "Facultatif"} on={!!d.price}>
        <Prix value={d.price} onChange={(price) => set((x) => ({ ...x, price }))} unite="€" label="Le prix du soin" />
        {!!d.price && proprios.length > 0 && (
          <div className="fc-cartes pv-sous">
            <Carte type="case" on={d.refac} titre={`À faire payer à ${proprios.length > 1 ? "leurs propriétaires" : proprios[0]}`} aide="Ajouté à sa facture du mois" onClick={() => set((x) => ({ ...x, refac: !x.refac }))} />
          </div>
        )}
      </Groupe>
    </div>
  );
}

export function resumeSoin(d: Draft, h: Habitudes, today: string, horses: Horse[]): { label: string; recap: string; pret: boolean } {
  if (!d.care && !d.custom.trim()) return { label: "Choisis d’abord le soin", recap: "", pret: false };
  const noms = horses.filter((x) => d.horseIds.includes(x.id)).map((x) => x.name);
  return {
    label: noms.length ? `Ajouter le soin de ${noms.length > 2 ? `${noms.length} chevaux` : noms.join(" et ")}` : "Ajouter le soin",
    recap: [titre(d, h), `${jourLabel(d.date, today)}${d.start ? ` ${hh(d.start)}` : ""}`, d.price ? eurc(d.price) : ""].filter(Boolean).join(" · "),
    pret: true,
  };
}

/* ---------- La tâche ou le rendez-vous ---------- */
export function TacheVitrine({ d, set, h, today }: { d: Draft; set: SetD; h: Habitudes; today: string }) {
  return (
    <div className="pv">
      <h2 className="pv-t">Une tâche ou un rendez-vous</h2>
      <p className="fc-aide">Sans heure, c’est une tâche. Avec une heure, un rendez-vous.</p>
      <Groupe titre="C’est quoi ?" premier>
        <label className="fc-champ pv-champ pv-premier">
          <span className="fc-boite">
            <input value={d.quoi} placeholder="Réparer la clôture, appeler le véto…" aria-label="C’est quoi" onChange={(e) => set((x) => ({ ...x, quoi: e.target.value }))} />
          </span>
        </label>
        {h.quoi.length > 0 && (
          <div className="fc-cartes pv-sous">
            {h.quoi.slice(0, 3).map((q) => (
              <Carte key={q} type="rond" on={d.quoi === q} titre={q} onClick={() => set((x) => ({ ...x, quoi: q }))} />
            ))}
          </div>
        )}
      </Groupe>
      <Groupe titre="Quand ?" compte={`${Maj(jourLabel(d.date, today))}${d.start ? ` · ${hh(d.start)}` : " · sans heure"}`} on>
        <Quand d={d} set={set} today={today} sansHeure />
      </Groupe>
    </div>
  );
}

export function resumeTache(d: Draft, today: string): { label: string; recap: string; pret: boolean } {
  if (!d.quoi.trim()) return { label: "Dis d’abord ce que c’est", recap: "", pret: false };
  return { label: d.start ? "Ajouter le rendez-vous" : "Ajouter la tâche", recap: `${jourLabel(d.date, today)}${d.start ? ` · ${hh(d.start)}` : ""}`, pret: true };
}

/** Le bouton vert du bas, avec son résumé. */
export function BoutonVitrine({ label, recap, pret, onClick, dansLeBas }: { label: string; recap?: string; pret: boolean; onClick: () => void; dansLeBas?: boolean }) {
  return (
    <div className={dansLeBas ? undefined : "nt-stick pv-bas"}>
      <button type="button" className="pv-go" disabled={!pret} onClick={onClick}>
        {label}
      </button>
      {recap ? <p className="pv-recap">{recap}</p> : null}
    </div>
  );
}
