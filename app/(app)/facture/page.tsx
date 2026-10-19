"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Empty, Ic } from "@/components/carnet/ui";
import { ClientFacture, InfosVendeur, TvaReglage } from "@/components/bs/facturation";
import { FeuilleMoyen } from "@/components/bs/moyen-paiement";
import { PageImprimee, useTitreDocument } from "@/components/bs/impression";
import { useParentIci } from "@/components/bs/nav";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { billsFor, cleClient } from "@/lib/domain/billing";
import {
  VENDEUR_MANQUE_DIT,
  avoirsDe,
  brouillon,
  contenuAvoir,
  contenuAvoirMontant,
  dateDite,
  deMois,
  eur2,
  facturation,
  facturesDe,
  listeDite,
  appelClient,
  messageFacture,
  type Canal,
  messageFaite,
  moisDit,
  nomDoc,
  personneDe,
  resteAAnnuler,
  resteEnEuros,
  vendeurDe,
  vendeurManque,
  type Brouillon,
} from "@/lib/domain/facture";
import { nomEcurie } from "@/lib/domain/politesse";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import { lireMontant, saisieMontant } from "@/lib/utils/montant";
import { InField } from "@/components/bs/seance-form";
import { Feuille, resteApresAvoirs } from "@/components/bs/feuille-facture";
import { facturePdf, nomFichierPdf } from "@/lib/domain/facture-pdf";
import { AvoirSansReseau, FactureNonEnregistree, MESSAGE_AVOIR_SANS_RESEAU, messageNonEnregistree } from "@/lib/account/numeroter";
import { MENTION_PROVISOIRE, lienFacture } from "@/lib/domain/numeros";
import type { Invoice, Period, StableData } from "@/lib/domain/types";
import { adresseClient, adresseFacture, nomDeLAdresse } from "@/lib/adresse-client";

/**
 * La facture d'un client pour un mois (`/facture?c=…&mois=2026-10`, lib/adresse-client ; l'ancien `?nom=` marche encore),
 * une facture ou un avoir faits (`/facture?n=2026-0004`), ou les factures du
 * mois de tous les clients (`/facture?lot=2026-10`). Tant qu'elle n'est pas
 * faite : ce qui manque (le vendeur, la TVA, le client) se règle ici, une
 * question à la fois, puis l'aperçu, et en bas « Faire la facture », qui lui
 * donne son numéro. Une facture faite est figée : on l'imprime (ou
 * l'enregistre en PDF), on l'envoie, et on l'annule au besoin par un avoir.
 * La feuille A4 seule part à l'impression. Styles : app/carnet/facture.css (fa-).
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <FactureRoute />
      </Suspense>
    </ClientGate>
  );
}

const parseMois = (m: string | null): Period | null => {
  const r = /^(\d{4})-(\d{2})$/.exec(m ?? "");
  return r && +r[2] >= 1 && +r[2] <= 12 ? { year: +r[1], month: +r[2] } : null;
};
const mkDe = (p: Period) => `${p.year}-${String(p.month).padStart(2, "0")}`;
const ficheDe = (nom: string, mk: string) => adresseClient(nom, mk);
const plusJoursIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** La flèche du haut ramène à la fiche du client quand on arrive ici sans passer par elle. */
function useRetourFiche(nom: string | undefined, mk: string | undefined) {
  const poser = useParentIci((s) => s.poser);
  useEffect(() => {
    poser(nom && mk ? ficheDe(nom, mk) : "/chevaux?vue=clients");
    return () => poser(null);
  }, [nom, mk, poser]);
}

function FactureRoute() {
  const sp = useSearchParams();
  const n = sp.get("n");
  const parId = sp.get("id");
  const invoices = useDataStore((s) => s.invoices);
  // Le client de l'adresse (?c=, ou l'ancien ?nom=) : lib/adresse-client.
  const nomAdresse = useDataStore((s) => nomDeLAdresse(sp, s));
  if (n || parId) {
    // Par son id : une facture provisoire (pas encore de numéro), ou l'une de deux factures au même numéro.
    const inv = (invoices ?? []).find((i) => (parId ? i.id === parId : i.number === n));
    if (!inv) return <Introuvable texte={n ? `On ne trouve pas la facture n° ${n}.` : "On ne trouve pas cette facture."} />;
    return <Emise key={inv.id} inv={inv} avoirDe={sp.get("avoir")} faite={sp.get("faite") === "1"} />;
  }
  const lot = parseMois(sp.get("lot"));
  if (lot) return <Lot period={lot} />;
  const nom = nomAdresse.trim();
  if (!nom) return <Introuvable texte="Choisis un client pour faire sa facture." />;
  return <DuMois nom={nom} period={parseMois(sp.get("mois")) ?? currentPeriod()} />;
}

function Introuvable({ texte }: { texte: string }) {
  useRetourFiche(undefined, undefined);
  return (
    <div className="fa-page">
      <div className="cn-page">
        <Empty ill="introuvable">{texte}</Empty>
        <div className="ch-after">
          <Link href="/chevaux?vue=clients" className="btn line full">
            Tes clients
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ce qui manque avant la première facture ---------- */

type Etape = "vendeur" | "tva";

/**
 * Le vendeur (nom, adresse, SIRET) puis la TVA (et son numéro) : une
 * question à la fois. Une étape ouverte reste là jusqu'à « Continuer »,
 * qui dit ce qui manque tant qu'il manque quelque chose.
 */
function useEtapes(data: StableData, kinds: Brouillon["kinds"], tvaManque: boolean) {
  const b = facturation(data);
  const manque = vendeurManque(b);
  const vendeur = manque.filter((m) => m !== "tva");
  const besoin: Record<Etape, boolean> = { vendeur: vendeur.length > 0, tva: tvaManque || manque.includes("tva") };
  const [ouvertes] = useState(() => ({ ...besoin }));
  const [champs] = useState(() => vendeur);
  const [faites, setFaites] = useState<Record<Etape, boolean>>({ vendeur: false, tva: false });
  // Un gérant qui avait déjà des factures : on lui dit pourquoi on lui demande ça maintenant.
  const nouveau = (data.invoices ?? []).length > 0 && vendeur.some((m) => m === "statut" || m === "nomPrenom" || m === "rcs");
  const etape = (["vendeur", "tva"] as Etape[]).find((k) => besoin[k] || (ouvertes[k] && !faites[k]));
  const finir = (k: Etape) => setFaites((f) => ({ ...f, [k]: true }));
  const tvaReste = !b.vat ? ["la TVA"] : [...(tvaManque ? ["un taux"] : []), ...(manque.includes("tva") ? [VENDEUR_MANQUE_DIT.tva] : [])];
  const carte =
    etape === "vendeur" ? (
      <div className="card fa-card rise">
        <b>Pour faire une facture, il faut {listeDite((champs.length ? champs : vendeur).map((m) => VENDEUR_MANQUE_DIT[m]))}.</b>
        {nouveau && <p>Depuis le 19 octobre, Be Stable demande tout ce que la loi exige sur une facture : ton statut, et selon lui ton nom et ton prénom (entrepreneur individuel) ou ton RCS (société). Tes factures déjà faites ne changent pas.</p>}
        <p>Tu les notes une fois, ils reviennent sur toutes tes factures.</p>
        <InfosVendeur seulement={champs.length ? champs : vendeur} />
        <BoutonSuite manque={vendeur.map((m) => VENDEUR_MANQUE_DIT[m])} onClick={() => finir("vendeur")} />
      </div>
    ) : etape === "tva" ? (
      <div className="card fa-card rise">
        <b>{b.vat ? "Choisis le taux de TVA de ce que tu factures." : "Choisis d’abord la TVA de tes factures."}</b>
        <p>Tu la choisis une fois, elle sert pour toutes tes factures.</p>
        <TvaReglage kinds={kinds.length ? kinds : undefined} />
        <BoutonSuite manque={tvaReste} onClick={() => finir("tva")} />
      </div>
    ) : null;
  return { etape, carte };
}

/** « Continuer », ou ce qui manque encore, dit sur le bouton lui-même. */
function BoutonSuite({ manque, onClick, label = "Continuer" }: { manque: string[]; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn full fa-suite" disabled={manque.length > 0} onClick={onClick}>
      {manque.length ? `Il manque ${listeDite(manque)}` : label}
    </button>
  );
}

/* ---------- La facture d'un client ---------- */

/** Les factures du mois d'un client, et ce qui reste à facturer. */
function DuMois({ nom, period }: { nom: string; period: Period }) {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const router = useRouter();
  const mk = mkDe(period);
  const faites = facturesDe(data.invoices, nom, mk);
  const draft = useMemo(() => brouillon(data, nom, period), [data, nom, period]);
  const role = useMemo(() => billsFor(data, period).find((x) => cleClient(x.payer) === cleClient(nom))?.role ?? "proprietaire", [data, period, nom]);
  const person = personneDe(data, nom);
  const { etape, carte } = useEtapes(data, draft.kinds, draft.tvaAChoisir || draft.manquants.length > 0);
  const [clientOuvert, setClientOuvert] = useState(() => draft.client.length > 0);
  const [voir, setVoir] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const qui = appelClient(person?.statut === "pro" ? { pro: true } : { name: nom }, nom);
  useRetourFiche(nom, mk);

  const faire = async () => {
    if (!draft.facture || enCours) return;
    setEnCours(true);
    let inv: Invoice | undefined;
    try {
      [inv] = await useDataStore.getState().issueInvoices([draft.facture], localToday());
    } catch (e) {
      setEnCours(false);
      if (e instanceof FactureNonEnregistree) return say(messageNonEnregistree(e));
      throw e;
    }
    setEnCours(false);
    if (!inv) return say("Ces lignes sont déjà sur une facture. Tu la trouves dans Tes factures.");
    // La facture faite s'ouvre avec sa confirmation : « Facture n° … faite », Imprimer, Envoyer.
    router.replace(`${lienFacture(inv)}&faite=1`);
  };

  // Une facture déjà faite, et rien de nouveau : elle s'ouvre telle quelle.
  if (faites.length && (draft.vide || voir)) {
    const inv = faites.find((i) => i.number === voir) ?? faites[faites.length - 1];
    return <Emise key={inv.id} inv={inv} autres={faites.length > 1 ? faites : undefined} onAutre={setVoir} />;
  }

  const client = !draft.vide && !etape && (draft.client.length > 0 || clientOuvert);
  const pret = !draft.vide && !etape && !client && !!draft.facture;
  const b = facturation(data);
  const today = localToday();

  return (
    <div className="fa-page">
      <div className="cn-page fa-tools">
        <div className="fa-head rise">
          <p className="k">Facture · {moisDit(mk)}</p>
          <h2>{nom}</h2>
        </div>
        {faites.length > 0 && (
          <div className="card fa-card rise">
            <p>
              {faites.length > 1 ? `Déjà ${faites.length} factures ce mois : ` : "Déjà une facture ce mois : "}
              {faites.map((i, k) => (
                <span key={i.id}>
                  {k > 0 && ", "}
                  <Link className="lnk" href={lienFacture(i)}>
                    {i.provisoire ? "à numéroter" : `n° ${i.number}`}
                  </Link>
                </span>
              ))}
              . Ce qui est fait depuis va sur une nouvelle facture.
            </p>
          </div>
        )}
        {draft.vide ? (
          <Empty>Rien à facturer à {qui} pour {moisDit(mk)}.</Empty>
        ) : etape ? (
          carte
        ) : client ? (
          <div className="card fa-card rise">
            <b>{person?.statut ? `${qui}, pour sa facture` : `${qui} est un particulier ou un professionnel ?`}</b>
            <p>La loi demande le nom complet et l’adresse d’un particulier, et des mentions en plus pour un professionnel.</p>
            <ClientFacture nom={nom} role={role} manque={draft.client} />
            <BoutonSuite manque={draft.client.map((m) => (m === "statut" ? "ta réponse" : m === "nomComplet" ? "son prénom et son nom" : m === "adresse" ? "son adresse" : "tes conditions de paiement"))} onClick={() => setClientOuvert(false)} label="Voir l’aperçu" />
          </div>
        ) : (
          <p className="fa-who rise">
            {qui} : {person?.statut === "pro" ? "client professionnel" : "particulier"}
            {person?.address ? "" : ", sans adresse"}.{" "}
            <button type="button" className="lnk" onClick={() => setClientOuvert(true)}>
              Changer
            </button>
          </p>
        )}
        <p className="fa-more">
          <Link className="lnk" href={ficheDe(nom, mk)}>
            Sa fiche
          </Link>
          {" · "}
          <Link className="lnk" href="/facturation">
            Tes infos de facturation
          </Link>
        </p>
      </div>
      {pret && draft.facture && (
        <>
          <Feuille
            apercu
            inv={{
              ...draft.facture,
              id: "apercu",
              number: "aperçu",
              year: period.year,
              seq: 0,
              issuedAt: today,
              seller: vendeurDe(b, draft.facture.franchise),
              ...(draft.facture.buyer.pro && typeof b.delaiPro === "number" ? { echeance: plusJoursIso(today, b.delaiPro) } : {}),
              ...(draft.facture.buyer.pro && b.penalites ? { penalites: b.penalites } : {}),
            }}
          />
          <div className="fa-go">
            <p>Vérifie l’aperçu : faite, la facture prend son numéro et ne change plus.{(data.invoices ?? []).length === 0 ? " Fais tes factures toujours au même endroit." : ""}</p>
            <button type="button" className="btn full" onClick={faire} disabled={enCours}>
              <Ic n="doc" className="" />
              Faire la facture
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Les factures du mois, pour tous les clients ---------- */

function Lot({ period }: { period: Period }) {
  const data = useDataStore();
  const say = useUiStore((s) => s.say);
  const setClient = useDataStore((s) => s.setClientFacture);
  const mk = mkDe(period);
  const [faites, setFaites] = useState<Invoice[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  useRetourFiche(undefined, undefined);
  const bills = useMemo(() => billsFor(data, period).filter((x) => !x.orphan), [data, period]);
  const clients = useMemo(
    () =>
      bills
        .map((x) => {
          const d = brouillon(data, x.payer, period);
          return { nom: x.payer, role: x.role, total: d.montant, d };
        })
        .filter((x) => !x.d.vide)
        .sort((a, c) => a.nom.localeCompare(c.nom, "fr")),
    [bills, data, period],
  );
  const kinds = [...new Set(clients.flatMap((c) => c.d.kinds))];
  const { etape, carte } = useEtapes(data, kinds, clients.some((c) => c.d.tvaAChoisir || c.d.manquants.length > 0));
  const prets = clients.filter((c) => c.d.facture);
  const aCompleter = clients.filter((c) => !c.d.facture);

  const faire = async () => {
    if (enCours || !prets.length) return;
    setEnCours(true);
    let out: Invoice[];
    try {
      out = await useDataStore.getState().issueInvoices(
        prets.map((c) => c.d.facture!),
        localToday(),
      );
    } catch (e) {
      setEnCours(false);
      if (e instanceof FactureNonEnregistree) return say(messageNonEnregistree(e));
      throw e;
    }
    setEnCours(false);
    setFaites(out);
    say(out.length > 1 ? `<strong>${out.length} factures</strong> faites.` : out.length ? "<strong>Une facture</strong> faite." : "Rien de nouveau à facturer.");
  };

  return (
    <div className="fa-page fa-lot">
      <div className="cn-page fa-tools">
        <div className="fa-head rise">
          <p className="k">Factures · {moisDit(mk)}</p>
          <h2>Les factures {deMois(mk)}</h2>
        </div>
        {faites ? (
          <div className="card fa-card rise">
            <b>{faites.length > 1 ? `${faites.length} factures faites.` : faites.length ? "Une facture faite." : "Rien de nouveau à facturer."}</b>
            <p>Ouvre-les une par une pour les imprimer ou les envoyer.</p>
            <div className="fr-list">
              {faites.map((i) => (
                <Link key={i.id} href={lienFacture(i)} className="fr-inv">
                  <span>
                    <b>{i.payer}</b>
                    <small>{i.provisoire ? "à numéroter, dès que le réseau revient" : `n° ${i.number}`}</small>
                  </span>
                  <span className="fr-amt">{eur2(i.totalTTC)}</span>
                  <Ic n="chev" className="chev" />
                </Link>
              ))}
            </div>
          </div>
        ) : !clients.length ? (
          <Empty>Rien à facturer pour {moisDit(mk)} : tout est déjà sur une facture.</Empty>
        ) : etape ? (
          carte
        ) : (
          <>
            {prets.length > 0 && (
              <div className="card fa-card rise">
                <b>{prets.length > 1 ? `${prets.length} factures prêtes` : "Une facture prête"}</b>
                <div className="fr-list">
                  {prets.map((c) => (
                    <Link key={c.nom} href={adresseFacture(c.nom, mk)} className="fr-inv">
                      <span>
                        <b>{c.nom}</b>
                        <small>{c.d.facture!.due > 0 ? `reste ${eur2(c.d.facture!.due)}` : "déjà payée"} · voir l’aperçu</small>
                      </span>
                      <span className="fr-amt">{eur2(c.d.facture!.totalTTC)}</span>
                      <Ic n="chev" className="chev" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {aCompleter.length > 0 && (
              <div className="card fa-card rise">
                <b>{aCompleter.length > 1 ? `${aCompleter.length} à compléter d’abord` : "Une à compléter d’abord"}</b>
                <p>Dis-le une fois pour chaque client. Pour un particulier, son nom complet et son adresse ; pour un professionnel, son adresse.</p>
                <div className="fr-list">
                  {aCompleter.map((c) =>
                    c.d.client.includes("statut") ? (
                      <div key={c.nom} className="fa-lotq">
                        <span id={`lot-${c.nom}`}>
                          <b>{c.nom}</b>
                          <small>{eur2(c.total)}</small>
                        </span>
                        <span className="fr-two" role="radiogroup" aria-labelledby={`lot-${c.nom}`}>
                          <button type="button" role="radio" aria-checked={false} className="chip" onClick={() => setClient(c.nom, c.role, { statut: "particulier" })}>
                            Particulier
                          </button>
                          <button type="button" role="radio" aria-checked={false} className="chip" onClick={() => setClient(c.nom, c.role, { statut: "pro" })}>
                            Pro
                          </button>
                        </span>
                      </div>
                    ) : (
                      <Link key={c.nom} href={adresseFacture(c.nom, mk)} className="fr-inv">
                        <span>
                          <b>{c.nom}</b>
                          <small>{c.d.client.includes("nomComplet") ? "particulier : son prénom et son nom" : c.d.client.includes("adresse") ? `${personneDe(data, c.nom)?.statut === "pro" ? "professionnel" : "particulier"} : son adresse` : "professionnel : tes conditions de paiement"}</small>
                        </span>
                        <span className="fr-amt">{eur2(c.total)}</span>
                        <Ic n="chev" className="chev" />
                      </Link>
                    ),
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <p className="fa-more">
          <Link className="lnk" href="/chevaux?vue=clients">
            Tes clients
          </Link>
          {" · "}
          <Link className="lnk" href="/facturation">
            Tes factures
          </Link>
        </p>
      </div>
      {!faites && !etape && prets.length > 0 && (
        <div className="fa-go">
          <p>Chaque facture reçoit son numéro, puis ne change plus.</p>
          <button type="button" className="btn full" onClick={faire} disabled={enCours}>
            <Ic n="doc" className="" />
            {prets.length > 1 ? `Faire les ${prets.length} factures` : "Faire la facture"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Une facture faite ---------- */

/** Une facture (ou un avoir) faite : figée, à imprimer, à envoyer, à annuler au besoin par un avoir. */
function Emise({ inv, autres, onAutre, avoirDe, faite }: { inv: Invoice; autres?: Invoice[]; onAutre?: (n: string) => void; avoirDe?: string | null; faite?: boolean }) {
  const envoi = useRef<HTMLDivElement>(null);
  const people = useDataStore((s) => s.people);
  const invoices = useDataStore((s) => s.invoices);
  const gerant = useSettingsStore((s) => s.gerant);
  const stableName = useSettingsStore((s) => s.stableName);
  const billing = useDataStore((s) => s.billing);
  const person = (people ?? []).find((p) => cleClient(p.name) === cleClient(inv.payer));
  const avoir = inv.kind === "avoir";
  const provisoire = !!inv.provisoire;
  const say = useUiStore((s) => s.say);
  const [numeroEnCours, setNumeroEnCours] = useState(false);
  const [annuler, setAnnuler] = useState(() => !!avoirDe && !avoir);
  const phone = person?.phone?.replace(/[^\d+]/g, "") ?? "";
  const email = person?.email?.trim() ?? "";
  // Tu ou vous selon le choix de Tes factures ; signé du gérant et de l'écurie.
  // Le même message, selon ce qui part avec : l'e-mail et le partage joignent le PDF ; un SMS ou un WhatsApp, non.
  const mois = avoir && inv.avoirDe ? (invoices ?? []).find((i) => i.kind !== "avoir" && i.number === inv.avoirDe?.number) : undefined;
  const msg = (canal: Canal) => messageFacture(inv, gerant, { tu: billing?.tutoie, ecurie: nomEcurie(stableName, billing?.legalName), canal, rembourse: !!mois && mois.due <= 0 });
  const court = encodeURIComponent(msg("court"));
  const qui = appelClient(inv.buyer, inv.payer);
  const partage = usePartagePdf();
  const partagerPdf = async () => {
    try {
      const file = new File([facturePdf(inv) as BlobPart], nomFichierPdf(inv), { type: "application/pdf" });
      await navigator.share({ files: [file], title: nomDoc(inv), text: msg("partage") });
    } catch (e) {
      // Partage fermé sans rien choisir : rien à dire. Sinon, les boutons dessous restent là.
      if ((e as { name?: string })?.name !== "AbortError") say("Le partage n’a pas marché. Envoie le message par SMS, WhatsApp ou e-mail, juste en dessous.");
    }
  };
  const objet = encodeURIComponent(nomDoc(inv));
  const avoirs = avoir ? [] : avoirsDe(invoices, inv.number);
  const reste = avoir ? [] : resteAAnnuler(inv, invoices);
  const peutAnnuler = !avoir && !provisoire && reste.some((q) => q > 0) && resteEnEuros(inv, invoices) > 0;
  useTitreDocument(provisoire ? `Facture à numéroter ${inv.payer}` : `${avoir ? "Avoir" : "Facture"} ${inv.number} ${inv.payer}`);
  // Faite sans réseau : elle reçoit son numéro dès que le serveur répond (ici, ou tout seul au retour du réseau).
  const donnerNumero = async () => {
    if (numeroEnCours) return;
    setNumeroEnCours(true);
    try {
      const n = await useDataStore.getState().numeroterEnAttente(localToday());
      const moi = n.find((i) => i.id === inv.id);
      say(moi ? `La facture a reçu le n° <strong>${moi.number}</strong>.` : "Toujours pas de réseau : elle recevra son numéro dès qu’il revient.");
    } catch (e) {
      if (e instanceof FactureNonEnregistree) say(messageNonEnregistree(e));
      else throw e;
    } finally {
      setNumeroEnCours(false);
    }
  };
  useRetourFiche(inv.payer, inv.month);
  return (
    <div className="fa-page">
      <PageImprimee page="size: A4; margin: 16mm 14mm;" />
      <div className="cn-page fa-tools">
        <div className="fa-head rise">
          <p className="k">{nomDoc(inv)}</p>
          <h2>{inv.payer}</h2>
          <p>
            {moisDit(inv.month)} · fait{avoir ? "" : "e"} le {dateDite(inv.issuedAt)}
          </p>
        </div>
        {provisoire && (
          <div className="card fa-card fa-faite rise" role="status">
            <b>Facture à numéroter</b>
            <p>Pas de réseau : elle recevra son numéro, et la date de ce jour-là, dès que le réseau revient. Tu peux l’imprimer en attendant : elle dit « {MENTION_PROVISOIRE} ». Elle s’envoie une fois numérotée.</p>
            <div className="fa-sendb">
              <button type="button" className="btn" onClick={donnerNumero} disabled={numeroEnCours}>
                Lui donner son numéro
              </button>
              <button type="button" className="btn line" onClick={() => window.print()}>
                <Ic n="print" className="" />
                Imprimer
              </button>
            </div>
          </div>
        )}
        {faite && !avoir && !provisoire && (
          <div className="card fa-card fa-faite rise" role="status">
            <b>{nomDoc(inv)} faite</b>
            <p>Elle est rangée dans Tes factures. Imprime-la (ou enregistre-la en PDF), ou envoie-la à {qui}.</p>
            <div className="fa-sendb">
              <button type="button" className="btn" onClick={() => window.print()}>
                <Ic n="print" className="" />
                Imprimer
              </button>
              <button
                type="button"
                className="btn line"
                onClick={() => {
                  envoi.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  envoi.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
                }}
              >
                Envoyer
              </button>
            </div>
          </div>
        )}
        {autres && onAutre && (
          <div className="chips fa-autres" role="radiogroup" aria-label="Les factures du mois">
            {autres.map((i) => (
              <button key={i.id} type="button" role="radio" aria-checked={i.id === inv.id} className={`chip${i.id === inv.id ? " on" : ""}`} onClick={() => onAutre(i.number)}>
                {i.provisoire ? "à numéroter" : `n° ${i.number}`}
              </button>
            ))}
          </div>
        )}
        {avoir && inv.avoirDe && (
          <p className="fa-who">
            Il annule{" "}
            <Link className="lnk" href={`/facture?n=${encodeURIComponent(inv.avoirDe.number)}`}>
              la facture n° {inv.avoirDe.number}
            </Link>{" "}
            pour {eur2(-inv.totalTTC)}.
          </p>
        )}
        {avoirs.length > 0 && (
          // À l'écran seulement : la feuille imprimée reste celle qui est partie (un double est identique à l'original).
          <p className="fa-who">
            {peutAnnuler ? "En partie annulée par " : "Annulée par "}
            {avoirs.length > 1 ? "les avoirs n° " : "l’avoir n° "}
            {avoirs.map((a, k) => (
              <span key={a.id}>
                {k > 0 && (k === avoirs.length - 1 ? " et " : ", ")}
                <Link className="lnk" href={`/facture?n=${encodeURIComponent(a.number)}`}>
                  {a.number}
                </Link>
              </span>
            ))}
            {peutAnnuler && inv.due > 0 ? `. Ce qui reste à payer passe de ${eur2(inv.due)} à ${eur2(resteApresAvoirs(inv, avoirs))}.` : "."} La facture s’imprime telle qu’elle est partie : l’avoir est un document à part.
          </p>
        )}
        {/* Juste faite, la carte du haut a déjà son bouton Imprimer : pas deux boutons qui font la même chose. */}
        {!(faite && !avoir) && !provisoire && (
          <button type="button" className="btn full fa-print-btn" onClick={() => window.print()}>
            <Ic n="print" className="" />
            Imprimer ou enregistrer en PDF
          </button>
        )}
        {!provisoire && (
          <div className="fa-send" ref={envoi}>
            <p className="fa-sendq">L’envoyer à {qui}</p>
            {partage && (
              <button type="button" className="btn full fa-pdf" onClick={partagerPdf}>
                <Ic n="arrow" className="" />
                Envoyer avec le PDF
              </button>
            )}
            <div className="fa-sendb">
              <a className="btn line" href={`sms:${phone}?&body=${court}`}>
                SMS
              </a>
              <a className="btn line" href={`https://wa.me/?text=${court}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a className="btn line" href={`mailto:${encodeURIComponent(email)}?subject=${objet}&body=${encodeURIComponent(msg("email"))}`}>
                E-mail
              </a>
            </div>
            <p className="fa-hint">
              {partage
                ? `« Envoyer avec le PDF » ouvre le partage du téléphone : choisis Messages, WhatsApp ou Mail, ${avoir ? "l’avoir" : "la facture"} en PDF part avec le message. Les trois boutons envoient le message seul.`
                : `Le message est prêt : montant, mois, numéro. Par SMS ou WhatsApp, il part seul. Par e-mail, il dit que le PDF est joint : enregistre d’abord ${avoir ? "l’avoir" : "la facture"} en PDF, puis joins-le.`}
            </p>
          </div>
        )}
        {peutAnnuler && (
          <button type="button" className="btn line full fa-annuler" onClick={() => setAnnuler(true)}>
            Annuler par un avoir
          </button>
        )}
        <p className="fa-more">
          <Link className="lnk" href={ficheDe(inv.payer, inv.month)}>
            Sa fiche
          </Link>
          {" · "}
          <Link className="lnk" href="/facturation">
            Toutes tes factures
          </Link>
        </p>
      </div>
      <Feuille inv={inv} />
      {annuler && peutAnnuler && <FeuilleAvoir inv={inv} reste={reste} invoices={invoices} preselect={avoirDe ?? undefined} onClose={() => setAnnuler(false)} />}
    </div>
  );
}

/** Le téléphone sait-il partager un fichier PDF (navigator.share avec fichier) ? Vu une fois, à l'ouverture. */
function usePartagePdf(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const essai = new File(["%PDF-1.4"], "essai.pdf", { type: "application/pdf" });
      // Vérifié après le premier rendu : l'export statique ne connaît pas le navigateur.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOk(typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [essai] }));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

/** « Annuler par un avoir » : toute la facture, ou une partie, ligne par ligne ou d'un montant libre (avec son motif). */
function FeuilleAvoir({ inv, reste, invoices, preselect, onClose }: { inv: Invoice; reste: number[]; invoices?: Invoice[]; preselect?: string; onClose: () => void }) {
  const router = useRouter();
  const say = useUiStore((s) => s.say);
  const ligne = preselect ? inv.lines.findIndex((l) => l.revenueIds?.includes(preselect)) : -1;
  // Un avoir d'un montant fait avant : il ne reste plus toute la facture à annuler, la feuille s'ouvre sur « Un montant ».
  const deja = resteEnEuros(inv, invoices) < inv.totalTTC;
  const [tout, setTout] = useState(ligne < 0 && !deja);
  const [parMontant, setParMontant] = useState(deja);
  const [qtes, setQtes] = useState<number[]>(() => reste.map((r, i) => (i === ligne ? Math.min(1, r) : 0)));
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const maxEuros = resteEnEuros(inv, invoices);
  const m = lireMontant(montant) ?? 0;
  const libre = !tout && parMontant;
  const choix = tout ? reste : qtes;
  const c = libre ? contenuAvoirMontant(inv, m, motif, invoices) : contenuAvoir(inv, choix, invoices);
  const faire = async () => {
    if (!c || enCours) return;
    setEnCours(true);
    const st = useDataStore.getState();
    let a: Invoice | null;
    try {
      a = libre ? await st.issueAvoirMontant(inv.number, m, motif, localToday()) : await st.issueAvoir(inv.number, choix, localToday());
    } catch (e) {
      setEnCours(false);
      if (e instanceof FactureNonEnregistree) return say(messageNonEnregistree(e, true));
      if (e instanceof AvoirSansReseau) return say(MESSAGE_AVOIR_SANS_RESEAU);
      throw e;
    }
    setEnCours(false);
    if (!a) return;
    say(messageFaite(a));
    onClose();
    router.push(`/facture?n=${encodeURIComponent(a.number)}`);
  };
  const changer = (i: number, d: number) => setQtes((q) => q.map((x, k) => (k === i ? Math.min(reste[i], Math.max(0, x + d)) : x)));
  const vide = libre ? (m > maxEuros ? `Au plus ${eur2(maxEuros)}` : "Tape le montant") : tout && deja ? `Il reste ${eur2(maxEuros)} : choisis « Une partie », puis « Un montant »` : "Choisis ce qu’il annule";
  return (
    <FeuilleMoyen titre="Annuler par un avoir" onClose={onClose}>
      <div className="pad fa-avf">
        <p className="fa-hint">Une facture faite ne se modifie pas. L’avoir l’annule, en tout ou en partie, avec le numéro suivant. Les deux restent dans tes factures.</p>
        <div className="fr-two" role="radiogroup" aria-label="Ce que l’avoir annule">
          <button type="button" role="radio" aria-checked={tout} className={`chip${tout ? " on" : ""}`} onClick={() => setTout(true)}>
            Toute la facture
          </button>
          <button type="button" role="radio" aria-checked={!tout} className={`chip${!tout ? " on" : ""}`} onClick={() => setTout(false)}>
            Une partie
          </button>
        </div>
        {!tout && (
          <div className="fr-two" role="radiogroup" aria-label="Comment">
            <button type="button" role="radio" aria-checked={!parMontant} className={`chip${!parMontant ? " on" : ""}`} onClick={() => setParMontant(false)}>
              Des lignes
            </button>
            <button type="button" role="radio" aria-checked={parMontant} className={`chip${parMontant ? " on" : ""}`} onClick={() => setParMontant(true)}>
              Un montant
            </button>
          </div>
        )}
        {libre && (
          <div className="fa-avl">
            <label className="field">
              <span>Le montant</span>
              <InField unit="€">
                <input inputMode="decimal" autoFocus placeholder="Ex. : 50" aria-label="Le montant de l’avoir" value={montant} onChange={(e) => setMontant(saisieMontant(e.target.value))} onKeyDown={(e) => e.key === "Enter" && faire()} />
              </InField>
              <em>Au plus {eur2(maxEuros)}, ce qui reste de la facture.</em>
            </label>
            <label className="field">
              <span>Le motif</span>
              <input className="input" placeholder="Ex. : une semaine d’absence" aria-label="Le motif de l’avoir" value={motif} autoComplete="off" onChange={(e) => setMotif(e.target.value.slice(0, 80))} onKeyDown={(e) => e.key === "Enter" && faire()} />
              <em>Il s’imprime sur l’avoir. Sans motif : « Remise ».</em>
            </label>
          </div>
        )}
        {!tout && !parMontant && (
          <div className="fa-avl">
            {inv.lines.map((l, i) =>
              reste[i] > 0 ? (
                <div key={i} className="fa-avr">
                  <span>
                    <b>{l.label}</b>
                    <small>
                      {eur2(l.unitTTC)} l’unité · {reste[i]} sur la facture
                    </small>
                  </span>
                  <span className="fa-step" role="group" aria-label={`Combien de « ${l.label} » annuler`}>
                    <button type="button" aria-label="Un de moins" disabled={!qtes[i]} onClick={() => changer(i, -1)}>
                      −
                    </button>
                    <output aria-live="polite">{qtes[i]}</output>
                    <button type="button" aria-label="Un de plus" disabled={qtes[i] >= reste[i]} onClick={() => changer(i, 1)}>
                      +
                    </button>
                  </span>
                </div>
              ) : null,
            )}
          </div>
        )}
        <button type="button" className="btn full" disabled={!c || enCours} onClick={faire}>
          {c ? `Faire l’avoir de ${eur2(-c.totalTTC)}` : vide}
        </button>
      </div>
    </FeuilleMoyen>
  );
}

