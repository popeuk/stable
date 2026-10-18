/**
 * Domain types for Be Stable.
 *
 * These mirror the PostgreSQL schema in section 4 of the spec but use
 * camelCase and the shape the client actually works with. The data layer
 * is responsible for mapping snake_case rows to/from these types.
 */

export type EntrySource = "manual" | "voice" | "photo" | "recurring";
export type DistributionMode = "equal" | "weighted_by_days";
export type StableType =
  | "pension_simple"
  | "ecurie_active"
  | "centre_equestre"
  | "mixte";

/** ISO date string, `YYYY-MM-DD`. */
export type ISODate = string;

export interface Horse {
  id: string;
  stableId: string;
  name: string;
  breed?: string;
  birthYear?: number;
  ownerName?: string;
  entryDate: ISODate;
  exitDate?: ISODate | null;
  isArchived: boolean;
  pensionType?: string;
  /**
   * Le contrat de pension (€/mois). Renseigné, il est posté automatiquement
   * chaque mois en revenu : le loyer d'une place ne se ressaisit jamais.
   */
  pension?: number;
  notes?: string;
  /** Optional accent colour seed for the monogram placeholder. */
  photoUrl?: string | null;
  /** La robe (alezan, bai, noir, gris, isabelle, pie) : le portrait du cheval. */
  coat?: string;
  /** Une liste en tête : le détail du portrait. */
  blaze?: boolean;
  /* ---- Identité, pour le registre d'élevage (tout est facultatif) ---- */
  /** Numéro SIRE ou UELN, noté sur son document d'identification. */
  sireNumber?: string;
  /** Numéro de transpondeur (la puce). */
  chipNumber?: string;
  sex?: HorseSex;
  /** Date de naissance complète, quand on la connaît (l'année reste dans birthYear). */
  birthDate?: ISODate;
  /** Adresse de provenance à l'arrivée. */
  origin?: string;
  /** Motif d'arrivée : pension, achat, prêt, naissance… */
  entryReason?: string;
  /** Adresse de destination au départ. */
  destination?: string;
  /** Motif de départ : fin de pension, vente, prêt, décès… */
  exitReason?: string;
  /**
   * Ses séjours à l'écurie, du plus ancien au plus récent (lib/domain/sejours).
   * Les champs d'arrivée et de départ ci-dessus reflètent le dernier.
   */
  stays?: Stay[];
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  /** For expense categories: a direct (true) vs mutualised (false) cost. */
  isDirect?: boolean;
}

export interface Revenue {
  id: string;
  stableId: string;
  horseId: string;
  categoryId?: string;
  amount: number;
  date: ISODate;
  note?: string;
  source: EntrySource;
  /** Qui paie : le nom d'une personne. Absent = le propriétaire du cheval. */
  payer?: string;
  /** La séance d'origine, quand la recette vient d'une validation. */
  seanceId?: string;
  /** La dépense refacturée dont cette recette est le pendant. */
  rebillOf?: string;
  /** L'échéance d'un forfait (lib/domain/forfaits) : postée seule, payée par le cavalier. */
  abonnementId?: string;
}

export interface DirectExpense {
  id: string;
  stableId: string;
  horseId: string;
  categoryId?: string;
  label: string;
  amount: number;
  date: ISODate;
  note?: string;
  source: EntrySource;
  receiptUrl?: string | null;
  /** Refacturée au propriétaire : une recette du même montant existe. */
  rebillRevenueId?: string;
}

export interface SharedExpenseAllocation {
  horseId: string;
  allocatedAmount: number;
  presenceDays?: number;
}

export interface SharedExpense {
  id: string;
  stableId: string;
  categoryId?: string;
  label: string;
  totalAmount: number;
  periodMonth: number; // 1-12
  periodYear: number;
  distributionMode: DistributionMode;
  source: EntrySource;
  allocations: SharedExpenseAllocation[];
  note?: string;
}

/** A calendar period the whole app is scoped to (the Time Ribbon). */
export interface Period {
  year: number;
  month: number; // 1-12
}

/** The full computed P&L for one horse over one period. */
export interface HorsePnl {
  horseId: string;
  revenue: number;
  directCosts: number;
  sharedCosts: number;
  /** directCosts + sharedCosts — the break-even revenue. */
  threshold: number;
  /** revenue - directCosts - sharedCosts. */
  netResult: number;
  /** netResult / revenue * 100, or 0 when there is no revenue. */
  netMarginPct: number;
  /** revenue - directCosts. */
  grossMargin: number;
}

export type Trend = "hausse" | "baisse" | "stable";

export type Frequency = "monthly" | "quarterly" | "yearly";

/**
 * A recurring charge template (a loan, a subscription, the insurance…). It
 * generates a charge each due period between startDate and endDate. Can be
 * direct (one horse) or shared across the stable.
 */
export interface RecurringExpense {
  id: string;
  stableId: string;
  label: string;
  amount: number; // per occurrence
  categoryId?: string;
  isShared: boolean;
  horseId?: string; // when direct
  distributionMode?: DistributionMode; // when shared
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate | null;
  source: EntrySource;
  /**
   * Comment le gérant connaît ce frais, quand ce n'est pas « par mois » : ce
   * qu'il paie sur l'année, ou en plusieurs fois (2 fois 1 500 €). `amount`
   * reste l'équivalent par mois (lib/domain/montant-saisi.ts) ; ceci sert à
   * lui remontrer son chiffre tel qu'il l'a tapé.
   */
  saisi?: MontantSaisi;
}

/** Un frais connu à l'année (`montant` sur l'année) ou en plusieurs fois (`fois` paiements de `montant`). */
export interface MontantSaisi {
  mode: "an" | "fois";
  montant: number;
  fois?: number;
}

/**
 * A recurring revenue template — typically a pension (recurring by nature).
 * Always tied to one horse.
 */
export interface RecurringRevenue {
  id: string;
  stableId: string;
  horseId: string;
  categoryId?: string;
  label?: string;
  amount: number;
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate | null;
  source: EntrySource;
}

/** The schedule fields common to recurring entries. */
export interface RecurringSchedule {
  startDate: ISODate;
  endDate?: ISODate | null;
  frequency: Frequency;
}

/**
 * Une prestation libre définie par le gérant : balade, transport, douche,
 * débourrage… Son prix préremplit la recette quand on l'ajoute au planning.
 */
export interface Service {
  id: string;
  name: string;
  /** Recette par cheval (optionnelle : vide = prix libre à chaque fois). */
  price?: number;
}

/**
 * L'équipe de l'écurie : les gens qui y travaillent. « prestataire » ne sert
 * plus que pour lire les anciennes données : ils passent dans Les pros (pros.ts).
 */
export type TeamRole = "employe" | "prestataire";
export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  /** « Monitrice », « Maréchal-ferrant »… */
  job?: string;
}

/** Le métier d'un pro qui vient à l'écurie (Les pros). */
export type ProMetier = "marechal" | "veto" | "dentiste" | "osteo" | "autre";
/** Un pro : maréchal, véto, dentiste, ostéo… Il ne travaille pas à l'écurie (ce n'est pas l'équipe). */
export interface Pro {
  id: string;
  name: string;
  metier: ProMetier;
  phone?: string;
  /** Son métier en clair, pour « autre » (« Sellier », « Pareur »). */
  job?: string;
}

/**
 * La grille tarifaire de l'écurie : saisie UNE fois dans Réglages, elle
 * préremplit les prix partout (composeur, vocal, nouveau cheval) — et
 * chaque prix reste modifiable au cas par cas, rien n'est verrouillé.
 */
export interface Tariffs {
  /** Pension par défaut d'un nouveau cheval (€/mois). */
  pension?: number;
  /** Cours collectif, recette par cavalier. */
  cours_collectif?: number;
  /** Cours individuel. */
  cours_individuel?: number;
  /** Séance de travail du cheval facturée au propriétaire. */
  entrainement?: number;
}

import type { CareEvent } from "@/lib/domain/care";
import type { Holding, HorseSex } from "@/lib/domain/registre";
import type { Rhythm } from "@/lib/domain/rhythm";
import type { Stay } from "@/lib/domain/sejours";

/**
 * Une personne de l'écurie : propriétaire d'un cheval en pension ou
 * cavalier qui prend des cours. C'est à elle qu'on facture.
 */
export type PersonRole = "proprietaire" | "cavalier";
export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  phone?: string;
  email?: string;
  /** Ses notes, la plus récente en premier. */
  notes?: PersonNote[];
  /** Il paie ses cours et balades sur place, à la séance (sinon au mois). */
  paieALaSeance?: boolean;
  /** Son adresse postale, imprimée sur ses factures quand elle est connue. */
  address?: string;
  /**
   * Particulier ou professionnel, dit par le gérant à sa première facture.
   * Absent = pas encore dit : la facture le demande, l'app ne le devine pas.
   * Un professionnel reçoit les mentions de paiement de la loi (échéance,
   * pénalités, indemnité de 40 €).
   */
  statut?: "particulier" | "pro";
  active: boolean;
}

/** Une note datée sur un client. */
export interface PersonNote {
  id: string;
  /** Date ISO de la note (AAAA-MM-JJ). */
  at: string;
  text: string;
}

/** Une prestation vendue (cours, travail du cheval, balade…), avec son prix. */
export interface Prestation {
  id: string;
  label: string;
  /** Prix par cavalier présent (ou par séance pour un travail du cheval). */
  price: number;
  /** Seul le cours d'équitation a un format particulier ou collectif. */
  hasFormat?: boolean;
  active: boolean;
  /** Le prix au mois, si le cours se vend aussi au forfait mensuel. */
  forfaitMois?: number;
  /** Le prix de la saison, si le cours se vend aussi à l'année. */
  forfaitAnnee?: number;
  /** Combien de mois dure la saison (10 par défaut, septembre à juin). */
  saisonMois?: number;
}

/**
 * La formule d'un cavalier pour un cours, quand il ne paie pas à la séance :
 * au mois (montant par mois) ou à l'année (montant de la saison, en `fois`
 * paiements). Sans abonnement, il paie à la séance.
 */
export interface Abonnement {
  id: string;
  personId: string;
  prestationId: string;
  kind: "mois" | "annee";
  /** Au mois : par mois. À l'année : la saison entière. */
  amount: number;
  /** À l'année : en combien de fois. */
  fois?: number;
  /** À l'année : la durée de la saison, en mois. */
  mois?: number;
  /** Le premier mois (AAAA-MM). */
  debut: string;
  /** Le dernier mois inclus (AAAA-MM), quand le forfait s'arrête plus tôt. */
  fin?: string;
}

export type SeanceStatus = "planned" | "done" | "cancelled";
export type SeanceFormat = "particulier" | "collectif";

/** Un participant : qui monte, sur quel cheval, présent ou non. */
export interface Participant {
  personId: string;
  horseId?: string;
  /** Renseigné à la validation. Absent = pas encore pointé. */
  present?: boolean;
  /** Au forfait pour ce cours : sa présence ne se paie pas en plus (lib/domain/forfaits). */
  forfait?: boolean;
}

/**
 * Une séance du planning (repris du planning des cours du Clos) : une
 * prestation à une date et une heure, des participants, un statut. Une
 * séance faite met l'argent sur les tickets ; son prix est figé.
 */
export interface Seance {
  id: string;
  prestationId: string;
  title: string;
  format?: SeanceFormat;
  places?: number;
  participants: Participant[];
  /** Les chevaux concernés quand la séance ne porte pas de cavalier (travail). */
  horseIds: string[];
  date: ISODate;
  start: string; // HH:MM
  end: string; // HH:MM
  lieu?: string;
  notes?: string;
  status: SeanceStatus;
  cancelReason?: string;
  /** Prix unitaire figé à la création : changer un tarif ne réécrit pas le passé. */
  unitPrice: number;
  seriesId?: string;
  /** Facturer un absent qui n'a pas prévenu. */
  chargeAbsent?: boolean;
  updatedBy?: string;
  rev: number;
}

/** Le tableau d'équipe (repris du Clos) : colonnes et cartes. */
export interface TaskList {
  id: string;
  title: string;
  isDone?: boolean;
}
/** Une tâche (à faire) ou un rendez-vous (un jour, une heure). Absent = tâche. */
export type TaskKind = "tache" | "rdv";
export interface TeamTask {
  id: string;
  title: string;
  /** Tâche ou rendez-vous. Les anciennes cartes n'ont pas ce champ : ce sont des tâches. */
  kind?: TaskKind;
  /** Rendez-vous : l'heure de fin (HH:MM), facultative. Le début est dans `due`. */
  end?: string;
  /** Rendez-vous : le lieu ou la personne, facultatif. */
  lieu?: string;
  listId: string;
  labels: string[];
  due?: string; // AAAA-MM-JJTHH:MM
  forWho: string[];
  notes?: string;
  checklist: { id: string; text: string; done: boolean }[];
  comments: { by: string; at: string; text: string }[];
  /** Un coût : devient une facture commune quand la carte passe en « Fait ». */
  cost?: number;
  costExpenseId?: string;
  createdBy?: string;
  sort: number;
}

/** Une action de rentabilité suivie : proposée, en cours, faite. */
export type ActionStatus = "proposee" | "en_cours" | "faite" | "ecartee";
export interface ActionState {
  id: string;
  status: ActionStatus;
  at: string;
  /** Ce que l'action a rapporté, mesuré quand elle est faite. */
  measured?: number;
}

/** Un paiement reçu d'une personne pour un mois. */
export interface Payment {
  id: string;
  payer: string;
  month: string; // AAAA-MM
  amount: number;
  at: string;
  /** Payé sur place : la séance réglée (avec `payer`, elle désigne sa ligne). */
  seanceId?: string;
  /** Comment il a payé. Absent sur les paiements d'avant (non noté). */
  method?: PaymentMethod;
  /** Le numéro du chèque, facultatif. */
  chequeNumber?: string;
}

/** Les moyens de paiement que le comptable veut voir. */
export type PaymentMethod = "cheque" | "especes" | "virement" | "autre";

/** Les types de prestation, chacun avec son taux de TVA. */
export type VatKind = "pension" | "cours" | "soins" | "autre";
/** Les taux que le gérant peut choisir (en %). */
export type VatRate = 5.5 | 10 | 20;

/**
 * Les infos de facturation de l'écurie, réglées une fois. La TVA n'est
 * jamais devinée : tant que `vat` est absent (ou qu'un taux manque), la
 * facture demande de choisir.
 */
export interface BillingInfo {
  /** Nom ou raison sociale, obligatoire : l'app ne prend pas le nom de l'écurie à sa place. */
  legalName?: string;
  /**
   * Le statut du vendeur, choisi une fois : entrepreneur individuel (la loi
   * impose « EI » après le nom) ou société (forme juridique et capital,
   * imprimés sous le nom). Absent : pas encore choisi, la facture le demande.
   */
  statut?: "ei" | "societe";
  /** Forme juridique d'une société : « EARL », « SCEA », « SARL »… (avant le choix du statut : imprimée après le nom). */
  forme?: string;
  /** Le capital social d'une société, tel que tapé (« 7 500 »). */
  capital?: string;
  /** L'IBAN, facultatif : imprimé en pied de facture (« Paiement par virement : IBAN … »). */
  iban?: string;
  /** Dans les messages aux clients (facture, relance) : true = tu ; absent = vous. */
  tutoie?: boolean;
  address?: string;
  /** Le SIRET, le même que celui du lieu de détention (Holding.siret) : saisi une fois. */
  siret?: string;
  /** « franchise » : pas de TVA (art. 293 B du CGI). « taux » : un taux par type. */
  vat?: "franchise" | "taux";
  rates?: Partial<Record<VatKind, VatRate>>;
  /** Le numéro de TVA intracommunautaire, demandé dès qu'on facture la TVA. */
  tvaIntra?: string;
  /** Pour un client professionnel : le délai de paiement en jours (0 = à réception). */
  delaiPro?: number;
  /** Pour un client professionnel : le taux des pénalités de retard choisi. */
  penalites?: "bce10" | "legal3";
}

/** Une ligne de facture, figée à l'émission. Les prix saisis dans l'app sont TTC. */
export interface InvoiceLine {
  label: string;
  /** Les recettes de la ligne (une par unité), pour qu'un avoir sache lesquelles il annule. */
  revenueIds?: string[];
  /** Sur un avoir : la ligne de la facture d'origine qu'il annule (son rang). */
  de?: number;
  kind: VatKind;
  qty: number;
  /** Taux de TVA en % (0 en franchise). */
  rate: number;
  unitTTC: number;
  unitHT: number;
  totalTTC: number;
  totalHT: number;
}

export interface InvoiceVat {
  rate: number;
  base: number;
  amount: number;
}

/**
 * Une facture émise : numéro unique et chronologique par année (2026-0001),
 * jamais réutilisé. Tout ce qu'elle dit est figé à l'émission : la rouvrir
 * la montre telle qu'elle est partie.
 */
export interface Invoice {
  id: string;
  /** « 2026-0001 ». */
  number: string;
  year: number;
  seq: number;
  /** Date d'émission (AAAA-MM-JJ). */
  issuedAt: ISODate;
  payer: string;
  /** Le mois facturé (AAAA-MM). */
  month: string;
  /** « avoir » : annule tout ou partie d'une facture ; ses montants sont négatifs. Absent = une facture. */
  kind?: "avoir";
  /** Sur un avoir : la facture qu'il annule. */
  avoirDe?: { number: string; issuedAt: ISODate };
  /** Figé à l'émission. `ei` : « EI » après le nom ; `capital` : la forme et le capital sous le nom ; `iban` : en pied de facture. */
  seller: { name: string; forme?: string; ei?: boolean; capital?: string; address?: string; siret?: string; tvaIntra?: string; iban?: string };
  buyer: { name: string; address?: string; pro?: boolean };
  /** Client professionnel : la date d'échéance et le taux des pénalités, figés à l'émission. */
  echeance?: ISODate;
  penalites?: "bce10" | "legal3";
  /** Soldée à l'émission : le jour du dernier paiement et comment (« chèque »). */
  reglee?: { date: ISODate; moyen?: string };
  franchise: boolean;
  lines: InvoiceLine[];
  totalHT: number;
  vat: InvoiceVat[];
  totalTTC: number;
  /** Déjà payé à l'émission, et ce qui restait dû. */
  paid: number;
  due: number;
  /** Les recettes facturées : elles ne repassent pas sur une autre facture. */
  revenueIds: string[];
}

/** The full bundle of data the domain functions operate on. */
export interface StableData {
  horses: Horse[];
  revenues: Revenue[];
  directExpenses: DirectExpense[];
  sharedExpenses: SharedExpense[];
  revenueCategories: Category[];
  expenseCategories: Category[];
  /** Recurring charge templates (optional — folded into period figures). */
  recurringExpenses?: RecurringExpense[];
  /** Recurring revenue templates, e.g. pensions (folded into period figures). */
  recurringRevenues?: RecurringRevenue[];
  /** Le carnet de vie : soins, santé, sport, documents (voir domain/care). */
  careEvents?: CareEvent[];
  /** Les rythmes hebdomadaires : le planning qui se remplit tout seul. */
  rhythms?: Rhythm[];
  /** La grille tarifaire : les prix par défaut, préremplis partout. */
  tariffs?: Tariffs;
  /** Les prestations libres du gérant (balade, transport…). */
  services?: Service[];
  /** L'équipe : les gens qui travaillent à l'écurie, assignables aux tâches. */
  team?: TeamMember[];
  /** Les pros qui viennent (maréchal, véto, dentiste, ostéo…), proposés dans « Qui vient ». */
  pros?: Pro[];
  people?: Person[];
  prestations?: Prestation[];
  /** Les forfaits des cavaliers (au mois, à l'année). */
  abonnements?: Abonnement[];
  seances?: Seance[];
  taskLists?: TaskList[];
  tasks?: TeamTask[];
  actions?: ActionState[];
  payments?: Payment[];
  /** Les infos imprimées sur les factures (nom, adresse, SIRET, TVA). */
  billing?: BillingInfo;
  /** Les factures émises, figées. */
  invoices?: Invoice[];
  /** Le dernier numéro utilisé, par année : un numéro ne revient jamais. */
  invoiceSeq?: Record<string, number>;
  /** Le lieu de détention et son détenteur, pour le registre d'élevage. */
  holding?: Holding;
}
