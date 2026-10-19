"use client";

import { useState } from "react";
import { Seg, eurc } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { FOIS_ANNEE, SAISON_MOIS, finAbonnement, forfaitDe, nomCours } from "@/lib/domain/forfaits";
import { lireMontant, montantEnTexte } from "@/lib/utils/montant";
import { localToday } from "@/lib/utils/local-date";
import type { PersonRole, Prestation, Tariffs } from "@/lib/domain/types";
import { accord } from "@/lib/domain/clients";
import "@/app/carnet/client.css";

/**
 * Les forfaits à l'écran : dans Mes prix, sous chaque cours, ce qu'il coûte
 * au mois et à l'année ; sur la fiche d'un cavalier, sa formule pour chaque
 * cours vendu au forfait (à la séance, au mois, à l'année en 1, 3 ou 10 fois).
 */

/** Le cours de la grille de prix, retrouvé (ou créé) parmi les prestations. */
const CLE: Record<keyof Omit<Tariffs, "pension">, { re: RegExp; label: string; hasFormat?: boolean }> = {
  cours_collectif: { re: /^$/, label: "Cours d’équitation", hasFormat: true },
  cours_individuel: {
    re: /particulier|individuel/,
    label: "Cours particulier",
  },
  entrainement: { re: /travail|entrain/, label: "Travail du cheval" },
};
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function prestationDuTarif(ps: Prestation[], key: keyof typeof CLE): Prestation | undefined {
  const c = CLE[key];
  return ps.find((p) => p.active && (c.hasFormat ? !!p.hasFormat : !p.hasFormat && c.re.test(norm(p.label))));
}

/** Sous un cours de Mes prix : « Aussi au forfait », puis le prix au mois et à l'année. */
export function ForfaitOffre({ tarif, prestationId }: { tarif?: keyof typeof CLE; prestationId?: string }) {
  const prestations = useDataStore((s) => s.prestations) ?? [];
  const p = prestationId ? prestations.find((x) => x.id === prestationId) : tarif ? prestationDuTarif(prestations, tarif) : undefined;
  const [ouvert, setOuvert] = useState(false);
  const deja = !!(p?.forfaitMois || p?.forfaitAnnee);
  /** La prestation du cours, créée au premier forfait si elle n'existe pas encore. */
  const cible = () => {
    if (p) return p.id;
    const c = tarif ? CLE[tarif] : null;
    if (!c) return null;
    return useDataStore.getState().addPrestation({
      label: c.label,
      price: 0,
      ...(c.hasFormat ? { hasFormat: true } : {}),
    });
  };
  const poser = (patch: Partial<Prestation>) => {
    const id = cible();
    if (id) useDataStore.getState().updatePrestation(id, patch);
  };
  if (!ouvert && !deja)
    return (
      <button type="button" className="fo-open" onClick={() => setOuvert(true)}>
        Aussi au forfait ?
      </button>
    );
  return (
    <div className="fo">
      <label className="fo-l">
        <span>Au mois</span>
        <span className="fo-f">
          <input inputMode="decimal" placeholder="0" defaultValue={montantEnTexte(p?.forfaitMois)} aria-label="Forfait au mois, en euros" onChange={(e) => poser({ forfaitMois: lireMontant(e.target.value) || undefined })} />
          <i>€ / mois</i>
        </span>
      </label>
      <label className="fo-l">
        <span>À la saison</span>
        <span className="fo-f">
          <input
            inputMode="decimal"
            placeholder="0"
            defaultValue={montantEnTexte(p?.forfaitAnnee)}
            aria-label="Forfait à la saison, en euros"
            onChange={(e) => poser({ forfaitAnnee: lireMontant(e.target.value) || undefined })}
          />
          <i>€ la saison</i>
        </span>
      </label>
      <label className="fo-l">
        <span>Une saison</span>
        <span className="fo-f">
          <input
            inputMode="numeric"
            placeholder={String(SAISON_MOIS)}
            defaultValue={p?.saisonMois && p.saisonMois !== SAISON_MOIS ? String(p.saisonMois) : ""}
            aria-label="Durée de la saison, en mois"
            onChange={(e) =>
              poser({
                saisonMois: Math.min(12, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || SAISON_MOIS)),
              })
            }
          />
          <i>mois</i>
        </span>
      </label>
      <p className="fo-h">Laisse vide ce que tu ne proposes pas. Sur la fiche de chaque cavalier, tu choisis sa formule.</p>
    </div>
  );
}

type Choix = "seance" | "mois" | "annee";

/** Sur la fiche d'un client : sa formule pour chaque cours vendu au forfait. Rien à montrer sans forfait proposé. */
export function SaFormule({ nom, role }: { nom: string; role: PersonRole }) {
  const prestations = (useDataStore((s) => s.prestations) ?? []).filter((p) => p.active && (p.forfaitMois || p.forfaitAnnee));
  const person = useDataStore((s) => s.people?.find((x) => x.name.trim().toLowerCase() === nom.trim().toLowerCase()));
  const abonnements = useDataStore((s) => s.abonnements);
  const setFormule = useDataStore((s) => s.setFormule);
  if (!prestations.length) return null;
  const today = localToday();
  const pid = () => person?.id ?? useDataStore.getState().ensurePerson(nom, role);

  return (
    <div className="cl-blk fo-blk">
      <h3>Sa formule</h3>
      {prestations.map((p) => {
        const a = person ? forfaitDe(abonnements, person.id, p.id, today) : undefined;
        const v: Choix = a?.kind ?? "seance";
        const opts: [Choix, string][] = [["seance", p.price ? `${eurc(p.price)} la séance` : "À la séance"]];
        if (p.forfaitMois) opts.push(["mois", `${eurc(p.forfaitMois)} / mois`]);
        if (p.forfaitAnnee) opts.push(["annee", `${eurc(p.forfaitAnnee)} / an`]);
        const fin = a ? finAbonnement(a) : null;
        return (
          <div key={p.id} className="fo-row">
            <b>{nomCours(p)}</b>
            <Seg<Choix>
              label={`Formule pour ${nomCours(p)}`}
              value={v}
              onChange={(c) =>
                setFormule(
                  pid(),
                  p.id,
                  c === "seance"
                    ? "seance"
                    : c === "mois"
                      ? { kind: "mois" }
                      : {
                          kind: "annee",
                          fois: a?.kind === "annee" ? (a.fois ?? SAISON_MOIS) : SAISON_MOIS,
                        },
                )
              }
              options={opts}
            />
            {a?.kind === "annee" && (
              <div className="fo-fois">
                <span>En</span>
                {FOIS_ANNEE.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip${(a.fois ?? SAISON_MOIS) === f ? " on" : ""}`}
                    aria-pressed={(a.fois ?? SAISON_MOIS) === f}
                    onClick={() => setFormule(pid(), p.id, { kind: "annee", fois: f })}
                  >
                    {f === 1 ? "1 fois" : `${f} fois`}
                  </button>
                ))}
              </div>
            )}
            <p className="cl-auto">
              {a
                ? `${a.kind === "mois" ? "Chaque mois" : "Ses échéances"} s’ajoutent toutes seules${fin ? `, jusqu’en ${new Date(`${fin}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}` : ""}. Ses séances de ce cours ne comptent rien en plus.`
                : `Chaque séance où ${accord(nom, "il", "elle")} vient s’ajoute à sa note.`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
