"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
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
  MENTION_FRANCHISE,
  VENDEUR_MANQUE_DIT,
  avoirsDe,
  brouillon,
  contenuAvoir,
  dateDite,
  deMois,
  enteteVendeur,
  eur2,
  facturation,
  facturesDe,
  listeDite,
  mentionIban,
  mentionsPaiement,
  messageFacture,
  messageFaite,
  moisDit,
  nomDoc,
  personneDe,
  resteAAnnuler,
  siretDit,
  tauxDit,
  tvaIntraDit,
  vendeurDe,
  vendeurManque,
  type Brouillon,
} from "@/lib/domain/facture";
import { prenomDe } from "@/lib/domain/clients";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import type { Invoice, Period, StableData } from "@/lib/domain/types";

/**
 * La facture d'un client pour un mois (`/facture?nom=Hugo L.&mois=2026-10`),
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
const ficheDe = (nom: string, mk: string) => `/client?nom=${encodeURIComponent(nom)}&mois=${mk}`;
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
  const invoices = useDataStore((s) => s.invoices);
  if (n) {
    const inv = (invoices ?? []).find((i) => i.number === n);
    if (!inv) return <Introuvable texte={`La facture n° ${n} n’est pas dans ton carnet.`} />;
    return <Emise key={inv.id} inv={inv} avoirDe={sp.get("avoir")} />;
  }
  const lot = parseMois(sp.get("lot"));
  if (lot) return <Lot period={lot} />;
  const nom = sp.get("nom")?.trim() ?? "";
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
  const etape = (["vendeur", "tva"] as Etape[]).find((k) => besoin[k] || (ouvertes[k] && !faites[k]));
  const finir = (k: Etape) => setFaites((f) => ({ ...f, [k]: true }));
  const tvaReste = !b.vat ? ["la TVA"] : [...(tvaManque ? ["un taux"] : []), ...(manque.includes("tva") ? [VENDEUR_MANQUE_DIT.tva] : [])];
  const carte =
    etape === "vendeur" ? (
      <div className="card fa-card rise">
        <b>Pour faire une facture, il faut {listeDite((champs.length ? champs : vendeur).map((m) => VENDEUR_MANQUE_DIT[m]))}.</b>
        <p>Tu les notes une fois, ils reviennent sur toutes tes factures.</p>
        <InfosVendeur seulement={champs.length ? champs : vendeur} />
        <BoutonSuite manque={vendeur.map((m) => VENDEUR_MANQUE_DIT[m])} onClick={() => finir("vendeur")} />
      </div>
    ) : etape === "tva" ? (
      <div className="card fa-card rise">
        <b>{b.vat ? "Choisis le taux de TVA de ce que tu factures." : "Choisis d’abord la TVA de tes factures."}</b>
        <p>L’app ne la devine pas. Tu la choisis une fois, elle sert pour toutes tes factures.</p>
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
  const qui = prenomDe(nom);
  useRetourFiche(nom, mk);

  const faire = async () => {
    if (!draft.facture || enCours) return;
    setEnCours(true);
    const [inv] = await useDataStore.getState().issueInvoices([draft.facture], localToday());
    setEnCours(false);
    if (!inv) return say("Ces lignes viennent d’être facturées dans un autre onglet. La facture est dans Tes factures.");
    say(messageFaite(inv));
    router.replace(`/facture?n=${encodeURIComponent(inv.number)}`);
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
                  <Link className="lnk" href={`/facture?n=${encodeURIComponent(i.number)}`}>
                    n° {i.number}
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
            <p>L’app ne le devine pas. Un professionnel reçoit les mentions de paiement que la loi demande.</p>
            <ClientFacture nom={nom} role={role} manque={draft.client} />
            <BoutonSuite manque={draft.client.map((m) => (m === "statut" ? "ta réponse" : m === "adresse" ? "son adresse" : "tes conditions de paiement"))} onClick={() => setClientOuvert(false)} label="Voir l’aperçu" />
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
            <p>Vérifie l’aperçu : faite, la facture prend son numéro et ne change plus.{(data.invoices ?? []).length === 0 ? " Fais tes factures depuis un seul appareil." : ""}</p>
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
        .map((x) => ({ nom: x.payer, role: x.role, total: x.total, d: brouillon(data, x.payer, period) }))
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
    const out = await useDataStore.getState().issueInvoices(
      prets.map((c) => c.d.facture!),
      localToday(),
    );
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
            <p>Ouvre chacune pour l’imprimer en PDF et l’envoyer.</p>
            <div className="fr-list">
              {faites.map((i) => (
                <Link key={i.id} href={`/facture?n=${encodeURIComponent(i.number)}`} className="fr-inv">
                  <span>
                    <b>{i.payer}</b>
                    <small>n° {i.number}</small>
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
                    <Link key={c.nom} href={`/facture?nom=${encodeURIComponent(c.nom)}&mois=${mk}`} className="fr-inv">
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
                <p>L’app ne devine pas si un client est un particulier ou un professionnel. Tu le dis une fois ; un professionnel a besoin de son adresse.</p>
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
                      <Link key={c.nom} href={`/facture?nom=${encodeURIComponent(c.nom)}&mois=${mk}`} className="fr-inv">
                        <span>
                          <b>{c.nom}</b>
                          <small>{c.d.client.includes("adresse") ? "professionnel : son adresse" : "professionnel : tes conditions de paiement"}</small>
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
function Emise({ inv, autres, onAutre, avoirDe }: { inv: Invoice; autres?: Invoice[]; onAutre?: (n: string) => void; avoirDe?: string | null }) {
  const people = useDataStore((s) => s.people);
  const invoices = useDataStore((s) => s.invoices);
  const gerant = useSettingsStore((s) => s.gerant);
  const person = (people ?? []).find((p) => cleClient(p.name) === cleClient(inv.payer));
  const avoir = inv.kind === "avoir";
  const [annuler, setAnnuler] = useState(() => !!avoirDe && !avoir);
  const phone = person?.phone?.replace(/[^\d+]/g, "") ?? "";
  const email = person?.email?.trim() ?? "";
  const msg = messageFacture(inv, gerant);
  const enc = encodeURIComponent(msg);
  const objet = encodeURIComponent(nomDoc(inv));
  const avoirs = avoir ? [] : avoirsDe(invoices, inv.number);
  const reste = avoir ? [] : resteAAnnuler(inv, invoices);
  const peutAnnuler = !avoir && reste.some((q) => q > 0);
  useTitreDocument(`${avoir ? "Avoir" : "Facture"} ${inv.number} ${inv.payer}`);
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
        {autres && onAutre && (
          <div className="chips fa-autres" role="radiogroup" aria-label="Les factures du mois">
            {autres.map((i) => (
              <button key={i.id} type="button" role="radio" aria-checked={i.id === inv.id} className={`chip${i.id === inv.id ? " on" : ""}`} onClick={() => onAutre(i.number)}>
                n° {i.number}
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
          <p className="fa-who">
            {peutAnnuler ? "En partie annulée par " : "Annulée par "}
            {avoirs.map((a, k) => (
              <span key={a.id}>
                {k > 0 && ", "}
                <Link className="lnk" href={`/facture?n=${encodeURIComponent(a.number)}`}>
                  l’avoir n° {a.number}
                </Link>
              </span>
            ))}
            .
          </p>
        )}
        <button type="button" className="btn full fa-print-btn" onClick={() => window.print()}>
          <Ic n="print" className="" />
          Imprimer ou enregistrer en PDF
        </button>
        <div className="fa-send">
          <p className="fa-sendq">L’envoyer à {prenomDe(inv.payer)}</p>
          <div className="fa-sendb">
            <a className="btn line" href={`sms:${phone}?&body=${enc}`}>
              SMS
            </a>
            <a className="btn line" href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a className="btn line" href={`mailto:${encodeURIComponent(email)}?subject=${objet}&body=${enc}`}>
              E-mail
            </a>
          </div>
          <p className="fa-hint">Le message est prêt : montant, mois, numéro. Le PDF ne part pas tout seul : enregistre d’abord {avoir ? "l’avoir" : "la facture"} en PDF, puis joins-le au message.</p>
        </div>
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

/** « Annuler par un avoir » : toute la facture, ou une partie, ligne par ligne. */
function FeuilleAvoir({ inv, reste, invoices, preselect, onClose }: { inv: Invoice; reste: number[]; invoices?: Invoice[]; preselect?: string; onClose: () => void }) {
  const router = useRouter();
  const say = useUiStore((s) => s.say);
  const ligne = preselect ? inv.lines.findIndex((l) => l.revenueIds?.includes(preselect)) : -1;
  const [tout, setTout] = useState(ligne < 0);
  const [qtes, setQtes] = useState<number[]>(() => reste.map((r, i) => (i === ligne ? Math.min(1, r) : 0)));
  const [enCours, setEnCours] = useState(false);
  const choix = tout ? reste : qtes;
  const c = contenuAvoir(inv, choix, invoices);
  const faire = async () => {
    if (!c || enCours) return;
    setEnCours(true);
    const a = await useDataStore.getState().issueAvoir(inv.number, choix, localToday());
    setEnCours(false);
    if (!a) return;
    say(messageFaite(a));
    onClose();
    router.push(`/facture?n=${encodeURIComponent(a.number)}`);
  };
  const changer = (i: number, d: number) => setQtes((q) => q.map((x, k) => (k === i ? Math.min(reste[i], Math.max(0, x + d)) : x)));
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
          {c ? `Faire l’avoir de ${eur2(-c.totalTTC)}` : "Choisis ce qu’il annule"}
        </button>
      </div>
    </FeuilleMoyen>
  );
}

/* ---------- La feuille A4 ---------- */

/** La feuille A4 : noir sur blanc, sobre. C'est elle seule qui part à l'impression. */
function Feuille({ inv, apercu }: { inv: Invoice; apercu?: boolean }) {
  const f = inv.franchise;
  const avoir = inv.kind === "avoir";
  const mentions = mentionsPaiement(inv);
  const entete = enteteVendeur(inv.seller);
  const iban = avoir ? "" : mentionIban(inv.seller.iban);
  return (
    <article className={`fa-print${apercu ? " apercu" : ""}`} aria-label={apercu ? "Aperçu de la facture" : nomDoc(inv)}>
      {apercu && <p className="fa-wm">Aperçu, pas encore de numéro</p>}
      <header className="fa-top">
        <div className="fa-from">
          <b>{entete.nom}</b>
          {entete.sous && <span>{entete.sous}</span>}
          {inv.seller.address && <span className="fa-pre">{inv.seller.address}</span>}
          {inv.seller.siret && <span>SIRET {siretDit(inv.seller.siret)}</span>}
          {!f && inv.seller.tvaIntra && <span>N° TVA intracommunautaire {tvaIntraDit(inv.seller.tvaIntra)}</span>}
        </div>
        <div className="fa-id">
          <h1>{avoir ? "Avoir" : "Facture"}</h1>
          <span>n° {apercu ? "à venir" : inv.number}</span>
          <span>Date : {dateDite(inv.issuedAt)}</span>
          {avoir && inv.avoirDe && (
            <span>
              Sur la facture n° {inv.avoirDe.number} du {dateDite(inv.avoirDe.issuedAt)}
            </span>
          )}
          <span>Prestations {deMois(inv.month)}</span>
        </div>
      </header>
      <div className="fa-to">
        <small>{avoir ? "Pour" : "Facturé à"}</small>
        <b>{inv.buyer.name}</b>
        {inv.buyer.address && <span className="fa-pre">{inv.buyer.address}</span>}
      </div>
      <table className="fa-tbl">
        <thead>
          <tr>
            <th>Désignation</th>
            <th className="n">Qté</th>
            <th className="n">{f ? "Prix unitaire" : "Prix unitaire HT"}</th>
            {!f && <th className="n">TVA</th>}
            <th className="n">{f ? "Total" : "Total HT"}</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.label}</td>
              <td className="n">{l.qty}</td>
              <td className="n">{eur2(l.unitHT)}</td>
              {!f && <td className="n">{tauxDit(l.rate)}</td>}
              <td className="n">{eur2(l.totalHT)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fa-tot">
        {!f && (
          <>
            <div>
              <span>Total HT</span>
              <span>{eur2(inv.totalHT)}</span>
            </div>
            {inv.vat.map((v) => (
              <div key={v.rate}>
                <span>
                  TVA {tauxDit(v.rate)} sur {eur2(v.base)}
                </span>
                <span>{eur2(v.amount)}</span>
              </div>
            ))}
          </>
        )}
        <div className="fa-ttc">
          <span>{avoir ? (f ? "Total de l’avoir" : "Total de l’avoir TTC") : f ? "Total" : "Total TTC"}</span>
          <span>{eur2(inv.totalTTC)}</span>
        </div>
        {!avoir && inv.paid > 0 && (
          <div>
            <span>Déjà payé</span>
            <span>{eur2(inv.paid)}</span>
          </div>
        )}
        {!avoir && (
          <div className="fa-due">
            <span>Reste à payer</span>
            <span>{eur2(inv.due)}</span>
          </div>
        )}
      </div>
      <footer className="fa-foot">
        {f && <p>{MENTION_FRANCHISE}.</p>}
        {mentions.map((m) => (
          <p key={m}>{m}</p>
        ))}
        {iban && <p>{iban}.</p>}
      </footer>
    </article>
  );
}
