/**
 * The 12 contextual mini-lessons (section 11.2). Each lesson can compute a
 * "your data" block from the live stable, so the explanation always applies
 * to the user's real numbers. Kept deliberately short (3-minute read max).
 */
import type { StableData, Period } from "@/lib/domain/types";
import { stablePnl } from "@/lib/domain/calculations";
import { formatEur, formatPct } from "@/lib/utils/format-currency";

export interface Lesson {
  key: string;
  title: string;
  definition: string;
  whatToDo: string[];
  related?: string[];
  /** Computes the "for you, this means" line from live data. */
  yourData?: (data: StableData, period: Period) => string;
}

export const LESSONS: Record<string, Lesson> = {
  marge_brute: {
    key: "marge_brute",
    title: "La marge brute",
    definition: "Ce qu'il te reste de tes revenus après avoir payé les coûts directs.",
    whatToDo: [
      "Si elle baisse de mois en mois, tes coûts directs montent plus vite que tes revenus.",
      "Pour la remonter : augmenter tes prix ou baisser tes coûts variables.",
    ],
    related: ["marge_nette", "cout_direct"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      const gross = p.revenue - p.directCosts;
      const pct = p.revenue ? (gross / p.revenue) * 100 : 0;
      return `Ce mois, ${formatEur(p.revenue)} de revenus et ${formatEur(p.directCosts)} de coûts directs. Ta marge brute est de ${formatEur(gross)}, soit ${formatPct(pct)} de tes revenus.`;
    },
  },
  marge_nette: {
    key: "marge_nette",
    title: "La marge nette",
    definition: "Ce qu'il te reste vraiment, une fois TOUTES les charges payées, directes et mutualisées.",
    whatToDo: [
      "C'est le chiffre qui dit si un cheval te rapporte ou te coûte.",
      "Compare-la à ta marge brute : l'écart, ce sont tes charges mutualisées.",
    ],
    related: ["marge_brute", "charges_mutualisees"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      const pct = p.revenue ? (p.netResult / p.revenue) * 100 : 0;
      return `Ce mois, ton résultat net est de ${formatEur(p.netResult)}, soit ${formatPct(pct)} de marge nette sur ${formatEur(p.revenue)} de revenus.`;
    },
  },
  seuil_rentabilite: {
    key: "seuil_rentabilite",
    title: "Le seuil de rentabilité",
    definition: "Le montant de revenus minimum pour qu'un cheval soit à l'équilibre.",
    whatToDo: [
      "En dessous, le cheval te coûte de l'argent chaque mois.",
      "C'est la somme de ses coûts directs et de sa part de charges mutualisées.",
    ],
    related: ["charges_mutualisees", "cout_direct"],
  },
  cout_direct: {
    key: "cout_direct",
    title: "Charges directes vs mutualisées",
    definition: "Les charges directes concernent un seul cheval ; les mutualisées sont partagées.",
    whatToDo: [
      "Maréchal, véto : directes, affectées à un cheval précis.",
      "Foin, personnel, loyer : mutualisées, réparties sur tout le monde.",
    ],
    related: ["charges_mutualisees"],
  },
  charges_mutualisees: {
    key: "charges_mutualisees",
    title: "Charges mutualisées",
    definition: "Un coût global réparti entre plusieurs chevaux selon une règle.",
    whatToDo: [
      "Répartition égale : chacun la même part.",
      "Par jours de présence : un cheval arrivé en cours de mois paie moins.",
    ],
    related: ["repartition_jours"],
  },
  repartition_jours: {
    key: "repartition_jours",
    title: "Répartir par jours de présence",
    definition: "Chaque cheval paie au prorata des jours où il était réellement là.",
    whatToDo: [
      "Plus juste quand des chevaux entrent ou sortent en cours de mois.",
      "Utile surtout pour le foin, les granulés, la litière.",
    ],
    related: ["charges_mutualisees"],
  },
  tendance: {
    key: "tendance",
    title: "Comprendre la tendance",
    definition: "On compare la marge du mois à la moyenne des 3 mois précédents.",
    whatToDo: [
      "Au-dessus de 5 % : en hausse. En dessous de 5 % : en baisse.",
      "Une baisse sur 3 mois mérite qu'on regarde de près.",
    ],
  },
  point_de_marge: {
    key: "point_de_marge",
    title: "Pourquoi un point de marge compte",
    definition: "Sur de petites marges, 1 % de prix change beaucoup le résultat final.",
    whatToDo: [
      "Teste l'effet d'une hausse de pension dans un scénario.",
      "Un petit ajustement répété sur 10 chevaux, ça s'additionne.",
    ],
    related: ["seuil_rentabilite"],
  },
  pension_indexee: {
    key: "pension_indexee",
    title: "Pension indexée vs fixe",
    definition: "Une pension indexée suit l'inflation de tes coûts ; une fixe non.",
    whatToDo: [
      "Si tes charges montent et tes pensions stagnent, ta marge fond.",
      "Prévois une clause de révision annuelle dans tes contrats.",
    ],
  },
  roi_cheval: {
    key: "roi_cheval",
    title: "Le ROI d'un cheval",
    definition: "Ce que le cheval rapporte rapporté à ce qu'il te coûte.",
    whatToDo: [
      "Un cheval peut générer du chiffre mais peu de marge : regarde le net.",
      "Trie ta galerie par rentabilité pour voir qui tire l'écurie.",
    ],
  },
  cheval_a_perte: {
    key: "cheval_a_perte",
    title: "Un cheval à perte, que faire ?",
    definition: "Trois leviers : le prix, les coûts, ou la décision de le garder.",
    whatToDo: [
      "Vérifie d'abord si la perte est ponctuelle (un véto) ou structurelle.",
      "Teste une hausse de pension avant d'envisager un départ.",
    ],
  },
  justifier_hausse: {
    key: "justifier_hausse",
    title: "Justifier une augmentation",
    definition: "Appuie une hausse sur des chiffres concrets, pas sur un ressenti.",
    whatToDo: [
      "Montre l'évolution de tes coûts (foin, énergie) sur 12 mois.",
      "Un scénario chiffré rend la conversation plus simple.",
    ],
  },
};

export const LESSON_KEYS = Object.keys(LESSONS);
