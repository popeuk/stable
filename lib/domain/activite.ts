import type { StableData } from "@/lib/domain/types";

/**
 * L'activité d'un client sur un mois, dite en mots : « 4 cours, 1 pension,
 * 2 soins ». Chaque ligne de sa note (lib/domain/billing) est rangée par
 * type : la séance d'origine et sa prestation d'abord, sinon le libellé.
 * Sert la carte « Ce mois, Hugo te rapporte… » de la fiche client.
 * Domaine pur.
 */
export type Activite = "pension" | "cours" | "balade" | "stage" | "travail" | "soin" | "autre";

const ORDRE: Activite[] = ["pension", "cours", "balade", "stage", "travail", "soin", "autre"];
const MOTS: Record<Activite, [string, string]> = {
  pension: ["pension", "pensions"],
  cours: ["cours", "cours"],
  balade: ["balade", "balades"],
  stage: ["stage", "stages"],
  travail: ["séance de travail", "séances de travail"],
  soin: ["soin", "soins"],
  autre: ["autre prestation", "autres prestations"],
};

interface LigneActivite {
  label: string;
  seanceId?: string;
  rebillOf?: string;
}

/** Le type d'une ligne : pension, cours, balade, stage, travail du cheval, soin refacturé ou autre. */
export function typeDeLigne(data: Pick<StableData, "seances" | "prestations">, l: LigneActivite): Activite {
  if (l.rebillOf) return "soin";
  let quoi = l.label;
  if (l.seanceId) {
    const s = (data.seances ?? []).find((x) => x.id === l.seanceId);
    const p = s ? (data.prestations ?? []).find((x) => x.id === s.prestationId) : undefined;
    quoi = `${p?.label ?? ""} ${s?.title ?? ""} ${l.label}`;
  }
  if (/stage/i.test(quoi)) return "stage";
  if (/balade|promenade|rando/i.test(quoi)) return "balade";
  if (!l.seanceId && /pension/i.test(quoi)) return "pension";
  if (/\bcours\b|le[cç]on|reprise|coaching/i.test(quoi)) return "cours";
  if (/travail|longe|monte|d[ée]bourr/i.test(quoi)) return "travail";
  if (l.seanceId) return "cours";
  if (/refactur|soin|v[ée]t|mar[ée]chal|ferr|ost[ée]o|vermif|dent|parage/i.test(quoi)) return "soin";
  return "autre";
}

/** « 4 cours, 1 pension, 2 soins » : les lignes comptées par type, dans un ordre fixe. Vide sans ligne. */
export function activiteDite(data: Pick<StableData, "seances" | "prestations">, lignes: LigneActivite[]): string {
  const n = new Map<Activite, number>();
  for (const l of lignes) {
    const t = typeDeLigne(data, l);
    n.set(t, (n.get(t) ?? 0) + 1);
  }
  return ORDRE.filter((t) => n.get(t))
    .map((t) => {
      const k = n.get(t)!;
      return `${k} ${MOTS[t][k > 1 ? 1 : 0]}`;
    })
    .join(", ");
}
