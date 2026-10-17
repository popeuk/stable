import type { MontantSaisi } from "@/lib/domain/types";

/**
 * Un frais qui revient, tel que le gérant le connaît : par mois, sur l'année
 * (« l'assurance, c'est 1 200 € par an »), ou en plusieurs fois dans l'année
 * (« le foin, 2 fois 1 500 € »).
 *
 * Le choix : on enregistre toujours l'équivalent par mois, comme un frais
 * mensuel. Un gérant qui raisonne à l'année veut savoir ce qu'il lui reste
 * chaque mois une fois tout compté : un foin payé en juin, enregistré en une
 * fois en juin, rendrait juin catastrophique et les onze autres mois trop
 * beaux. Réparti sur douze mois, chaque mois porte sa part et « ce qu'il te
 * reste » est juste tous les mois. Le montant tapé reste noté à côté
 * (`RecurringExpense.saisi`) pour le lui remontrer tel quel.
 */
export type Connu = "mois" | "an" | "fois";

/** Les nombres de fois proposés, en gros boutons. */
export const FOIS_PROPOSES = [2, 3, 4, 6] as const;
export const FOIS_PAR_DEFAUT = 2;

const auCentime = (n: number) => Math.round(n * 100) / 100;
const foisSur = (fois: number | undefined) => Math.max(1, Math.min(12, Math.round(fois ?? FOIS_PAR_DEFAUT)));

/** Ce que le gérant paie sur l'année, selon comment il connaît le montant. */
export function parAn(mode: Connu, montant: number, fois?: number): number {
  const m = Math.max(0, montant || 0);
  if (mode === "an") return auCentime(m);
  if (mode === "fois") return auCentime(m * foisSur(fois));
  return auCentime(m * 12);
}

/** L'équivalent par mois, au centime : ce qui compte chaque mois. */
export function parMois(mode: Connu, montant: number, fois?: number): number {
  if (mode === "mois") return auCentime(Math.max(0, montant || 0));
  return auCentime(parAn(mode, montant, fois) / 12);
}

/** Ce qu'on garde à côté du montant mensuel. Par mois : rien à garder. */
export function saisiDe(mode: Connu, montant: number, fois?: number): MontantSaisi | undefined {
  if (mode === "mois" || !(montant > 0)) return undefined;
  return mode === "fois" ? { mode, montant: auCentime(montant), fois: foisSur(fois) } : { mode, montant: auCentime(montant) };
}

/** Relit un frais enregistré : comment il a été tapé, et le montant à remontrer dans le champ. */
export function relire(amountParMois: number, saisi?: MontantSaisi | null): { mode: Connu; montant: number; fois: number } {
  if (saisi && saisi.montant > 0 && Math.abs(parMois(saisi.mode, saisi.montant, saisi.fois) - amountParMois) < 0.01) {
    return { mode: saisi.mode, montant: saisi.montant, fois: foisSur(saisi.fois) };
  }
  return { mode: "mois", montant: amountParMois, fois: FOIS_PAR_DEFAUT };
}
