/**
 * The 12 contextual mini-lessons (section 11.2). Each lesson can compute a
 * "your data" block from the live stable, so the explanation always applies
 * to the user's real numbers. Kept deliberately short (3-minute read max).
 */
import type { StableData, Period } from "@/lib/domain/types";
import { stablePnl } from "@/lib/domain/calculations";
import { formatEur, formatPct } from "@/lib/utils/format-currency";
import { fr } from "@/lib/utils/typo";

export interface Lesson {
  key: string;
  title: string;
  definition: string;
  whatToDo: string[];
  related?: string[];
  /** Computes the "for you, this means" line from live data. */
  yourData?: (data: StableData, period: Period) => string;
}

const LESSONS_BRUTES: Record<string, Lesson> = {
  chiffre_affaires: {
    key: "chiffre_affaires",
    title: "Ce qui rentre",
    definition: "Tout l’argent qui rentre dans l’écurie, avant de payer quoi que ce soit.",
    whatToDo: [
      "Ça compte les pensions, les cours, les ventes, le transport…",
      "Beaucoup d’argent qui rentre ne veut pas dire que tu gagnes de l’argent. Ce qui compte, c’est ce qui te reste une fois tout payé.",
    ],
    related: ["depenses", "rentabilite"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      return `Ce mois-ci, ${formatEur(p.revenue)} sont rentrés dans ton écurie. Il faut encore enlever tes ${formatEur(p.directCosts + p.sharedCosts)} de dépenses.`;
    },
  },
  depenses: {
    key: "depenses",
    title: "Tes dépenses",
    definition: "Tout ce que tu paies pour faire tourner l’écurie.",
    whatToDo: [
      "Certaines dépenses concernent un seul cheval : le maréchal, le véto.",
      "D’autres sont des frais de l’écurie, partagés entre les chevaux : foin, paille, loyer, salaires…",
    ],
    related: ["cout_direct", "charges_mutualisees"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      return `Ce mois-ci, ${formatEur(p.directCosts + p.sharedCosts)} de dépenses. ${formatEur(p.directCosts)} pour des chevaux précis, ${formatEur(p.sharedCosts)} de frais de l’écurie.`;
    },
  },
  rentabilite: {
    key: "rentabilite",
    title: "Combien il te reste sur 100 €",
    definition: "Sur chaque 100 € qui rentrent, combien il t’en reste une fois tout payé.",
    whatToDo: [
      "S’il te reste 20 € sur 100 € qui rentrent, tu gardes 20 %.",
      "Pour garder plus : faire rentrer plus d’argent, ou payer moins cher tes plus grosses dépenses.",
    ],
    related: ["marge_nette", "chiffre_affaires"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      const pct = p.revenue ? (p.netResult / p.revenue) * 100 : 0;
      return `Ce mois-ci, il te reste ${formatEur(p.netResult)} sur ${formatEur(p.revenue)} qui sont rentrés. Tu gardes ${formatPct(pct)} de ce qui rentre.`;
    },
  },
  taux_occupation: {
    key: "taux_occupation",
    title: "Tes places prises",
    definition: "Combien de tes places ont un cheval. C’est souvent le meilleur moyen de gagner plus.",
    whatToDo: [
      "Une place vide te coûte presque autant qu’une place prise. Le loyer et les salaires tombent quand même.",
      "Un cheval de plus, c’est une pension en plus, et les frais de l’écurie sont partagés entre plus de chevaux.",
    ],
    related: ["charges_mutualisees", "rentabilite"],
  },
  negocier_charges: {
    key: "negocier_charges",
    title: "Quelles dépenses peuvent baisser",
    definition: "Certaines dépenses peuvent baisser si tu négocies. D’autres sont fixées par contrat.",
    whatToDo: [
      "Celles qu’on peut négocier : foin, granulés, litière, énergie, assurance, fournitures.",
      "Les salaires et le loyer, on ne les coupe pas. On les rend moins lourds en remplissant l’écurie.",
    ],
    related: ["depenses", "taux_occupation"],
  },
  marge_brute: {
    key: "marge_brute",
    title: "Ce qui reste après les soins",
    definition: "Ce qui te reste quand tu as payé les frais propres à chaque cheval (maréchal, véto…), avant les frais de l’écurie.",
    whatToDo: [
      "Si ce chiffre baisse de mois en mois, les frais des chevaux montent plus vite que ce qui rentre.",
      "Pour le faire remonter : revoir tes prix, ou payer moins cher les soins.",
    ],
    related: ["marge_nette", "cout_direct"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      const gross = p.revenue - p.directCosts;
      const pct = p.revenue ? (gross / p.revenue) * 100 : 0;
      return `Ce mois-ci, ${formatEur(p.revenue)} sont rentrés et les frais des chevaux font ${formatEur(p.directCosts)}. Il te reste ${formatEur(gross)} avant les frais de l’écurie, soit ${formatPct(pct)} de ce qui rentre.`;
    },
  },
  marge_nette: {
    key: "marge_nette",
    title: "Ce qui te reste",
    definition: "Ce qui te reste une fois tout payé : les soins de chaque cheval et les frais de l’écurie.",
    whatToDo: [
      "C’est le chiffre qui dit si un cheval te rapporte ou te coûte.",
      "La différence avec « ce qui reste après les soins », ce sont les frais de l’écurie.",
    ],
    related: ["marge_brute", "charges_mutualisees"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      const pct = p.revenue ? (p.netResult / p.revenue) * 100 : 0;
      return `Ce mois-ci, il te reste ${formatEur(p.netResult)} une fois tout payé. C’est ${formatPct(pct)} des ${formatEur(p.revenue)} qui sont rentrés.`;
    },
  },
  seuil_rentabilite: {
    key: "seuil_rentabilite",
    title: "Ne pas perdre d’argent",
    definition: "Ce qui doit rentrer chaque mois pour payer toutes tes dépenses, pour un cheval comme pour toute l’écurie.",
    whatToDo: [
      "En dessous, tu perds de l’argent chaque mois. Au-dessus, chaque euro qui rentre te reste.",
      "Pour un cheval : ses propres frais, plus sa part des frais de l’écurie. Pour l’écurie : toutes tes dépenses.",
      "Ça te dit combien de pensions il te faut pour ne pas perdre d’argent. C’est ton repère.",
    ],
    related: ["charges_mutualisees", "cout_direct"],
    yourData: (data, period) => {
      const p = stablePnl(data, period);
      const charges = p.directCosts + p.sharedCosts;
      if (charges <= 0) return "Note tes premières dépenses pour savoir combien doit rentrer chaque mois.";
      const covered = p.revenue >= charges;
      return covered
        ? `Il doit rentrer ${formatEur(charges)} par mois pour tout payer. Tu en es à ${formatEur(p.revenue)} : c’est bon, tu ne perds pas d’argent.`
        : `Il doit rentrer ${formatEur(charges)} par mois pour tout payer. Tu en es à ${formatEur(p.revenue)} : il manque ${formatEur(charges - p.revenue)}.`;
    },
  },
  cout_direct: {
    key: "cout_direct",
    title: "Frais d’un cheval ou frais de l’écurie",
    definition: "Certaines dépenses concernent un seul cheval. D’autres sont partagées entre tous.",
    whatToDo: [
      "Maréchal, véto : c’est pour un cheval précis.",
      "Foin, paille, salaires, loyer : ce sont des frais de l’écurie, partagés entre les chevaux.",
    ],
    related: ["charges_mutualisees"],
  },
  charges_mutualisees: {
    key: "charges_mutualisees",
    title: "Les frais de l’écurie",
    definition: "Une dépense pour toute l’écurie (foin, paille, loyer, salaires…), partagée entre les chevaux.",
    whatToDo: [
      "Partage égal : chaque cheval paie la même part.",
      "Selon les jours passés chez toi : un cheval arrivé en cours de mois paie moins.",
    ],
    related: ["repartition_jours"],
  },
  repartition_jours: {
    key: "repartition_jours",
    title: "Partager selon les jours passés chez toi",
    definition: "Chaque cheval paie sa part selon le nombre de jours où il était vraiment là.",
    whatToDo: [
      "C’est plus juste quand des chevaux arrivent ou partent en cours de mois.",
      "C’est surtout utile pour le foin, les granulés, la litière.",
    ],
    related: ["charges_mutualisees"],
  },
  tendance: {
    key: "tendance",
    title: "Ça monte ou ça baisse ?",
    definition: "On compare ce qui t’est resté ce mois-ci avec la moyenne des 3 mois d’avant.",
    whatToDo: [
      "Plus de 5 % au-dessus de cette moyenne : ça monte. Plus de 5 % en dessous : ça baisse.",
      "Si ça baisse 3 mois de suite, ça vaut le coup de regarder pourquoi.",
    ],
  },
  point_de_marge: {
    key: "point_de_marge",
    title: "Pourquoi un petit changement de prix compte",
    definition: "Quand il te reste peu, augmenter un prix de 1 % change beaucoup ce qui te reste à la fin.",
    whatToDo: [
      "Essaie une hausse de pension dans « Et si… ? », sans rien toucher à tes vrais chiffres.",
      "Quelques euros de plus sur 10 chevaux, ça finit par faire une vraie somme.",
    ],
    related: ["seuil_rentabilite"],
  },
  pension_indexee: {
    key: "pension_indexee",
    title: "Pension qui suit les prix ou pension fixe",
    definition: "Une pension peut monter avec le prix de tes dépenses, ou rester toujours la même.",
    whatToDo: [
      "Si tes dépenses montent et que tes pensions ne bougent pas, il te reste de moins en moins.",
      "Prévois dans tes contrats que la pension peut être revue une fois par an.",
    ],
  },
  roi_cheval: {
    key: "roi_cheval",
    title: "Ce qu’un cheval te laisse",
    definition: "Ce que le cheval rapporte, moins ce qu’il te coûte.",
    whatToDo: [
      "Un cheval peut faire rentrer beaucoup d’argent mais te laisser peu. Regarde ce qui reste une fois tout payé.",
      "Trie tes chevaux par ce qu’ils te laissent pour voir lesquels font vivre l’écurie.",
    ],
  },
  cheval_a_perte: {
    key: "cheval_a_perte",
    title: "Un cheval te coûte de l’argent : que faire ?",
    definition: "Trois choses à regarder : son prix, ses frais, ou le garder ou non.",
    whatToDo: [
      "Regarde d’abord si c’est un mauvais mois (un gros passage du véto) ou si ça dure.",
      "Essaie de revoir sa pension au prochain renouvellement avant de penser à un départ.",
    ],
  },
  justifier_hausse: {
    key: "justifier_hausse",
    title: "Expliquer une hausse de pension",
    definition: "Appuie-toi sur des chiffres concrets, pas sur une impression.",
    whatToDo: [
      "Montre comment tes dépenses (foin, énergie) ont bougé sur 12 mois.",
      "Un essai chiffré dans « Et si… ? » rend la discussion plus simple.",
    ],
  },
};

/** Les mêmes, avec les espaces insécables du français (lib/utils/typo). */
export const LESSONS: Record<string, Lesson> = Object.fromEntries(
  Object.entries(LESSONS_BRUTES).map(([k, l]) => [
    k,
    { ...l, title: fr(l.title), definition: fr(l.definition), whatToDo: l.whatToDo.map(fr), ...(l.yourData ? { yourData: (d: StableData, p: Period) => fr(l.yourData!(d, p)) } : {}) },
  ]),
);

export const LESSON_KEYS = Object.keys(LESSONS);
