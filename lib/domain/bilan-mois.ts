import type { Period, StableData } from "@/lib/domain/types";
import { horseTicket, monthBreakdown, reconciledNets } from "@/lib/domain/ticket";
import { chevauxDuMois } from "@/lib/domain/presence";
import { clientDues } from "@/lib/domain/clients";
import { r2 } from "@/lib/utils/arrondi";

/**
 * Le bilan du mois (Suivi, onglet Bilan ; repris de l'app du Clos,
 * ~/Dreadsprint-v2/components/BilanMois.tsx, le 27 novembre 2026), pensé pour
 * se lire d'un coup d'œil :
 *  1. le résultat : ce qui rentre, ce qui sort, ce qu'il reste, en pièces sur 10 ;
 *  2. la fin du mois : ce qui reste aujourd'hui plus ce qui est encore prévu ;
 *  3. d'où vient l'argent : pensions, cours, autres recettes ;
 *  4. les clients : ce que chacun rapporte et sa part ;
 *  5. les chevaux : ce que chacun rapporte, coûte (ses frais et sa part des
 *     frais communs) et laisse.
 * Mêmes chiffres que le reste de l'app (monthBreakdown, horseTicket,
 * reconciledNets, clientDues). Domaine pur, testé.
 */

export interface SourceBilan {
  label: string;
  montant: number;
  part: number;
}
export interface ClientBilan {
  nom: string;
  rapporte: number;
  part: number;
  chevaux: string[];
}
export interface ChevalBilan {
  id: string;
  nom: string;
  rapporte: number;
  coute: number;
  reste: number;
  /** Un cheval sans pension (à toi, au club) : il te coûte, ce n'est pas une perte. */
  aTaCharge: boolean;
}
export interface BilanMois {
  rentre: number;
  sort: number;
  reste: number;
  /** Sur 10 € encaissés, combien restent (0 à 10). */
  surDix: number;
  sources: SourceBilan[];
  clients: ClientBilan[];
  /** La part des trois meilleurs clients dans ce que rapportent tous les clients (en %). */
  partTop3: number;
  chevaux: ChevalBilan[];
  /** Ce qui est encore prévu d'ici la fin du mois (séances, soins, tâches). */
  prevu: number;
  finDeMois: number;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function bilanDuMois(data: StableData, period: Period, prevu = 0): BilanMois {
  const m = monthBreakdown(data, period);
  const rentre = r2(m.revenue);
  const reste = r2(m.net);
  const sort = r2(rentre - reste);
  const surDix = rentre > 0 ? Math.max(0, Math.min(10, Math.round((reste / rentre) * 10))) : 0;

  const sources = m.ins
    .filter((l) => l.amount > 0)
    .map((l) => ({ label: l.label, montant: r2(l.amount), part: pct(l.amount, rentre) }))
    .sort((a, b) => b.montant - a.montant);

  const dus = clientDues(data, period).filter((c) => c.total > 0);
  const totalClients = dus.reduce((s, c) => s + c.total, 0);
  const clients = dus
    .map((c) => ({ nom: c.name, rapporte: r2(c.total), part: pct(c.total, totalClients), chevaux: c.horses }))
    .sort((a, b) => b.rapporte - a.rapporte || a.nom.localeCompare(b.nom, "fr"));
  const partTop3 = pct(
    clients.slice(0, 3).reduce((s, c) => s + c.rapporte, 0),
    totalClients,
  );

  const nets = reconciledNets(data, period);
  const chevaux = chevauxDuMois(data, period)
    .map((h) => {
      const t = horseTicket(data, h.id, period);
      const net = nets[h.id] ?? t.net;
      return { id: h.id, nom: h.name, rapporte: r2(t.revenue), coute: r2(t.revenue - net), reste: r2(net), aTaCharge: t.revenue <= 0 };
    })
    .sort((a, b) => b.reste - a.reste);

  return { rentre, sort, reste, surDix, sources, clients, partTop3, chevaux, prevu: r2(prevu), finDeMois: r2(reste + prevu) };
}
