"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Face, Ic, eur } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePeriodStore } from "@/stores/period-store";
import { bilanDuMois } from "@/lib/domain/bilan-mois";
import { plannedRest } from "@/components/bs/goal-card";
import { currentPeriod, samePeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { adresseClient } from "@/lib/adresse-client";
import { montantEnTexte, montantOuZero } from "@/lib/utils/montant";

/**
 * Le Bilan du Suivi (repris de l'app du Clos, ~/Dreadsprint-v2/components/BilanMois.tsx,
 * le 27 novembre 2026) : chaque partie s'ouvre sur une phrase en clair, calculée
 * sur les chiffres, puis un visuel, puis le détail. Calcul : lib/domain/bilan-mois.ts.
 * Styles : app/da.css (.bm-).
 */

const signe = (n: number) => `${n >= 0 ? "+" : "−"}${eur(Math.abs(Math.round(n)))}`;
const COUL = ["c0", "c2", "c1", "c3", "c4"];

export function BilanClos({ apres }: { apres?: ReactNode }) {
  const data = useDataStore();
  const active = usePeriodStore((s) => s.active);
  const ceMois = samePeriod(active, currentPeriod());
  const today = localToday();
  const prevu = useMemo(() => (ceMois ? plannedRest(data, today) : 0), [data, today, ceMois]);
  const b = useMemo(() => bilanDuMois(data, active, prevu), [data, active, prevu]);
  const nom = new Date(active.year, active.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" });

  if (!b.rentre && !b.sort)
    return (
      <div className="bilan-m">
        <p className="bm-vide">Rien de validé ni de frais en {nom} pour l’instant.</p>
        <Objectifs />
        {apres}
      </div>
    );

  const enPension = b.chevaux.filter((c) => !c.aTaCharge);
  const rentables = enPension.filter((c) => c.reste >= 0).length;
  const aCharge = b.chevaux.length - enPension.length;
  const maxCheval = Math.max(1, ...b.chevaux.map((c) => Math.max(c.rapporte, c.coute)));
  const echelle = Math.max(1, b.finDeMois, b.reste);

  return (
    <div className="bilan-m">
      {/* 1. Le résultat, en pièces */}
      <section className="bm-carte" aria-label="Résultat du mois">
        <h3 className="bm-phrase">{b.reste < 0 ? `En ${nom}, les frais dépassent ce qui rentre de ${eur(Math.round(-b.reste))}.` : `Sur 10 € encaissés en ${nom}, il t’en reste ${b.surDix}.`}</h3>
        {b.reste >= 0 && b.rentre > 0 && (
          <div className="bm-pieces" role="img" aria-label={`${b.surDix} pièces sur 10 te restent, ${10 - b.surDix} partent en frais`}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < b.surDix ? "garde" : "part"} style={{ animationDelay: `${i * 60}ms` }}>
                €
              </span>
            ))}
          </div>
        )}
        <div className="bm-legende">
          <span>
            <i className="garde" /> te reste
          </span>
          <span>
            <i className="part" /> part en frais
          </span>
        </div>
        <div className="bm-trois">
          <div>
            <small>Ce qui rentre</small>
            <b>{eur(Math.round(b.rentre))}</b>
          </div>
          <div>
            <small>Ce qui sort</small>
            <b>{eur(Math.round(b.sort))}</b>
          </div>
          <div className={b.reste >= 0 ? "pos" : "neg"}>
            <small>{ceMois ? "Il te reste" : "Il t’est resté"}</small>
            <b>{signe(b.reste)}</b>
          </div>
        </div>
      </section>

      {/* 2. La fin du mois */}
      {ceMois && (
        <section className="bm-carte" aria-label="La fin du mois">
          <h3 className="bm-phrase">{Math.round(b.prevu) !== 0 ? `Si tout ce qui est prévu se fait, tu finis le mois à ${signe(b.finDeMois)}.` : `Rien d’autre n’est prévu : tu finis le mois à ${signe(b.finDeMois)}.`}</h3>
          <div className="bm-temps">
            <div className="bm-temps-barre">
              <i className="fait" style={{ width: `${Math.max(4, Math.round((Math.max(0, b.reste) / echelle) * 100))}%` }} />
              {b.prevu > 0 && <i className="prevu" style={{ width: `${Math.round((b.prevu / echelle) * 100)}%` }} />}
            </div>
            <div className="bm-temps-l">
              <span>
                <b>{signe(b.reste)}</b>aujourd’hui
              </span>
              <span>
                <b>{signe(b.prevu)}</b>encore prévus
              </span>
              <span className="fin">
                <b>{signe(b.finDeMois)}</b>fin du mois
              </span>
            </div>
          </div>
        </section>
      )}

      {/* 3. D'où vient l'argent */}
      {b.sources.length > 0 && (
        <section className="bm-carte" aria-label="D’où vient l’argent">
          <h3 className="bm-phrase">{b.sources.length > 1 ? `${b.sources.map((s) => `${s.label.toLowerCase()} ${s.part} %`).join(", ").replace(/^./, (c) => c.toUpperCase())}.` : `Tout vient de : ${b.sources[0].label.toLowerCase()}.`}</h3>
          <div className="ca-barre grande">
            {b.sources.map((s, i) => (
              <i key={s.label} className={COUL[i % COUL.length]} style={{ flexGrow: s.montant }} />
            ))}
          </div>
          <ul className="ca-liste">
            {b.sources.map((s, i) => (
              <li key={s.label}>
                <span className={`pt ${COUL[i % COUL.length]}`} />
                <span className="nm">
                  <b>{s.label}</b>
                </span>
                <span className="mt">
                  <b>{eur(Math.round(s.montant))}</b>
                  <small>{s.part} %</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 4. Les clients */}
      {b.clients.length > 0 && (
        <section className="bm-carte" aria-label="Les clients">
          <h3 className="bm-phrase">{b.clients.length > 3 ? `Tes 3 meilleurs clients rapportent ${b.partTop3} % de ce que rapportent tous tes clients.` : `${b.clients.length} client${b.clients.length > 1 ? "s" : ""} ce mois-ci.`}</h3>
          <ul className="bm-clients">
            {b.clients.map((c, i) => (
              <li key={c.nom} className={i < 3 ? "top" : undefined}>
                <Link href={adresseClient(c.nom)}>
                  <span className="av">{c.nom.trim().charAt(0).toUpperCase()}</span>
                  <span className="nm">
                    <b>{c.nom}</b>
                    <span className="bar">
                      <i style={{ width: `${Math.round((c.rapporte / b.clients[0].rapporte) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="mt">
                    <b>{eur(Math.round(c.rapporte))}</b>
                    <small>{c.part} %</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. Les chevaux */}
      {b.chevaux.length > 0 && (
        <section className="bm-carte" aria-label="Les chevaux">
          <h3 className="bm-phrase">
            {enPension.length === 0
              ? `${b.chevaux.length} cheva${b.chevaux.length > 1 ? "ux" : "l"} à ta charge ce mois-ci.`
              : `${rentables} cheva${rentables > 1 ? "ux" : "l"} en pension sur ${enPension.length} rapporte${rentables > 1 ? "nt" : ""} plus qu’${rentables > 1 ? "ils ne coûtent" : "il ne coûte"}${aCharge ? ` ; ${aCharge} ${aCharge > 1 ? "sont" : "est"} à ta charge` : ""}.`}
          </h3>
          <div className="bm-chevaux">
            {b.chevaux.map((c) => {
              const h = data.horses.find((x) => x.id === c.id);
              return (
                <Link key={c.id} href={`/ticket?id=${c.id}`} className={`bm-cheval ${c.aTaCharge ? "charge" : c.reste >= 0 ? "pos" : "neg"}`}>
                  <span className="tete">{h && <Face horse={h} />}</span>
                  <b className="nom">{c.nom}</b>
                  <strong>{signe(c.reste)}</strong>
                  <span className="duo" aria-hidden="true">
                    <span>
                      <i className="in" style={{ width: `${Math.round((c.rapporte / maxCheval) * 100)}%` }} />
                    </span>
                    <span>
                      <i className="out" style={{ width: `${Math.round((c.coute / maxCheval) * 100)}%` }} />
                    </span>
                  </span>
                  <small>
                    {c.aTaCharge ? "à ta charge" : `rapporte ${eur(Math.round(c.rapporte))}`} · coûte {eur(Math.round(c.coute))}
                  </small>
                </Link>
              );
            })}
          </div>
          <div className="bm-legende">
            <span>
              <i className="garde" /> ce qu’il rapporte
            </span>
            <span>
              <i className="part" /> ce qu’il coûte
            </span>
          </div>
        </section>
      )}

      <Objectifs />
      {apres}
    </div>
  );
}

/**
 * Tes objectifs du mois : le chiffre d'affaires visé (comme au Clos) et ce
 * qu'il doit te rester. Les champs gardent le style de l'app.
 */
function Objectifs() {
  const objective = useSettingsStore((s) => s.objective);
  const setObjective = useSettingsStore((s) => s.setObjective);
  const objectiveCa = useSettingsStore((s) => s.objectiveCa);
  const setObjectiveCa = useSettingsStore((s) => s.setObjectiveCa);
  return (
    <section className="bm-carte" aria-label="Tes objectifs du mois" id="objectifs">
      <h3 className="bm-phrase">Tes objectifs du mois</h3>
      <p className="bm-aide">Ils valent pour chaque mois, jusqu’à ce que tu les changes. Laisse vide si tu n’en as pas.</p>
      <div className="bm-objs">
        <label className="field">
          <span>Le chiffre d’affaires visé</span>
          <span className="input">
            <input inputMode="decimal" defaultValue={montantEnTexte(objectiveCa)} placeholder="0" onChange={(e) => setObjectiveCa(montantOuZero(e.target.value))} />
            <span className="u">€</span>
          </span>
        </label>
        <label className="field">
          <span>Ce qu’il doit te rester</span>
          <span className="input">
            <input inputMode="decimal" defaultValue={montantEnTexte(objective)} placeholder="0" onChange={(e) => setObjective(montantOuZero(e.target.value))} />
            <span className="u">€</span>
          </span>
        </label>
      </div>
      <Link href="/argent?vue=leviers" className="bm-lien">
        Des idées pour gagner plus <Ic n="arrow" className="" />
      </Link>
    </section>
  );
}
