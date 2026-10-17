"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientGate } from "@/components/ui/client-gate";
import { Empty, Ic } from "@/components/carnet/ui";
import { InfosVendeur, TvaReglage } from "@/components/bs/facturation";
import { useDataStore } from "@/stores/data-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { cleClient } from "@/lib/domain/billing";
import { MENTION_FRANCHISE, brouillon, eur2, facturesDe, messageFacture, moisDit, nomVendeur, siretDit, tauxDit, vendeurManque } from "@/lib/domain/facture";
import { prenomDe } from "@/lib/domain/clients";
import { currentPeriod } from "@/lib/utils/period";
import { localToday } from "@/lib/utils/local-date";
import type { Invoice, Period } from "@/lib/domain/types";

/**
 * La facture d'un client pour un mois (`/facture?nom=Hugo L.&mois=2026-10`),
 * ou une facture émise (`/facture?n=2026-0004`). Tant qu'elle n'est pas
 * faite : ce qui manque (adresse, SIRET, TVA) se règle ici, puis un aperçu
 * et « Faire la facture », qui lui donne son numéro. Une facture faite est
 * figée : on l'imprime (ou l'enregistre en PDF) et on l'envoie. La feuille
 * A4 seule part à l'impression. Styles : app/carnet/facture.css (fa-).
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
const dateLongue = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function FactureRoute() {
  const sp = useSearchParams();
  const n = sp.get("n");
  const invoices = useDataStore((s) => s.invoices);
  if (n) {
    const inv = (invoices ?? []).find((i) => i.number === n);
    if (!inv) return <Introuvable texte={`La facture n° ${n} n’est pas dans ton carnet.`} />;
    return <Emise inv={inv} />;
  }
  const nom = sp.get("nom")?.trim() ?? "";
  if (!nom) return <Introuvable texte="Choisis un client pour faire sa facture." />;
  return <DuMois nom={nom} period={parseMois(sp.get("mois")) ?? currentPeriod()} />;
}

function Introuvable({ texte }: { texte: string }) {
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

/** Les factures du mois d'un client, et ce qui reste à facturer. */
function DuMois({ nom, period }: { nom: string; period: Period }) {
  const data = useDataStore();
  const stableName = useSettingsStore((s) => s.stableName);
  const say = useUiStore((s) => s.say);
  const router = useRouter();
  const mk = mkDe(period);
  const faites = facturesDe(data.invoices, nom, mk);
  const draft = useMemo(() => brouillon(data, nom, period), [data, nom, period]);
  const manque = vendeurManque(data.billing, stableName);
  // Les champs qui manquaient à l'ouverture restent affichés pendant qu'on les remplit.
  const [champs] = useState(() => manque);
  const [fini, setFini] = useState(false);
  const formulaire = manque.length > 0 || (champs.length > 0 && !fini);
  const [voir, setVoir] = useState<string | null>(null);
  const qui = prenomDe(nom);

  const faire = () => {
    if (!draft.facture) return;
    const inv = useDataStore.getState().issueInvoice(draft.facture, localToday(), stableName);
    say(`Facture n° ${inv.number} faite pour ${qui}.`);
    router.replace(`/facture?n=${encodeURIComponent(inv.number)}`);
  };

  // Une facture déjà faite, et rien de nouveau : elle s'ouvre telle quelle.
  if (faites.length && (draft.vide || voir)) {
    const inv = faites.find((i) => i.number === voir) ?? faites[faites.length - 1];
    return <Emise inv={inv} autres={faites.length > 1 ? faites : undefined} onAutre={setVoir} />;
  }

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
              . Ce qui a compté depuis va sur une nouvelle facture.
            </p>
          </div>
        )}
        {draft.vide ? (
          <Empty>Rien à facturer à {qui} pour {moisDit(mk)}.</Empty>
        ) : formulaire ? (
          <div className="card fa-card rise">
            <b>Pour faire une facture, il faut {(champs.length ? champs : manque).map((m) => (m === "siret" ? "ton SIRET" : m === "adresse" ? "ton adresse" : "ton nom")).join(" et ")}.</b>
            <p>Tu les notes une fois, ils reviennent sur toutes tes factures.</p>
            <InfosVendeur seulement={champs.length ? champs : manque} />
            <button type="button" className="btn full" disabled={manque.length > 0} onClick={() => setFini(true)}>
              Continuer
            </button>
          </div>
        ) : draft.tvaAChoisir || draft.manquants.length ? (
          <div className="card fa-card rise">
            <b>{draft.tvaAChoisir ? "Choisis d’abord la TVA de tes factures." : "Choisis le taux de TVA de ce que tu factures."}</b>
            <p>L’app ne la devine pas. Tu la choisis une fois, elle sert pour toutes tes factures.</p>
            <TvaReglage kinds={draft.kinds} />
          </div>
        ) : (
          <>
            <div className="card fa-card rise">
              <b>Voici l’aperçu.</b>
              <p>« Faire la facture » lui donne son numéro. Ensuite, elle ne change plus : ce qui compte après va sur une autre facture.</p>
              <button type="button" className="btn full" onClick={faire}>
                <Ic n="doc" className="" />
                Faire la facture
              </button>
            </div>
          </>
        )}
        <p className="fa-more">
          <Link className="lnk" href={`/client?nom=${encodeURIComponent(nom)}&mois=${mk}`}>
            Sa fiche
          </Link>
          {" · "}
          <Link className="lnk" href="/facturation">
            Tes infos de facturation
          </Link>
        </p>
      </div>
      {draft.facture && !formulaire && (
        <Feuille
          apercu
          inv={{
            ...draft.facture,
            id: "apercu",
            number: "aperçu",
            year: period.year,
            seq: 0,
            issuedAt: localToday(),
            seller: { name: nomVendeur(data.billing, stableName), address: data.billing?.address, siret: data.billing?.siret },
          }}
        />
      )}
    </div>
  );
}

/** Une facture faite : figée, à imprimer et à envoyer. */
function Emise({ inv, autres, onAutre }: { inv: Invoice; autres?: Invoice[]; onAutre?: (n: string) => void }) {
  const people = useDataStore((s) => s.people);
  const gerant = useSettingsStore((s) => s.gerant);
  const person = (people ?? []).find((p) => cleClient(p.name) === cleClient(inv.payer));
  const phone = person?.phone?.replace(/[^\d+]/g, "") ?? "";
  const email = person?.email?.trim() ?? "";
  const msg = messageFacture(inv, gerant);
  const enc = encodeURIComponent(msg);
  const objet = encodeURIComponent(`Facture n° ${inv.number}`);
  return (
    <div className="fa-page">
      <div className="cn-page fa-tools">
        <div className="fa-head rise">
          <p className="k">Facture n° {inv.number}</p>
          <h2>{inv.payer}</h2>
          <p>
            {moisDit(inv.month)} · faite le {dateLongue(inv.issuedAt)}
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
        <button type="button" className="btn full fa-print-btn" onClick={() => window.print()}>
          <Ic n="download" className="" />
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
            <a className="btn line" href={`mailto:${email}?subject=${objet}&body=${enc}`}>
              E-mail
            </a>
          </div>
          <p className="fa-hint">Le message est prêt : montant, mois, numéro. Le PDF ne part pas tout seul : enregistre d’abord la facture en PDF, puis joins-la au message.</p>
        </div>
        <p className="fa-more">
          <Link className="lnk" href={`/client?nom=${encodeURIComponent(inv.payer)}&mois=${inv.month}`}>
            Sa fiche
          </Link>
          {" · "}
          <Link className="lnk" href="/facturation">
            Toutes tes factures
          </Link>
        </p>
      </div>
      <Feuille inv={inv} />
    </div>
  );
}

/** La feuille A4 : noir sur blanc, sobre. C'est elle seule qui part à l'impression. */
function Feuille({ inv, apercu }: { inv: Invoice; apercu?: boolean }) {
  const f = inv.franchise;
  return (
    <article className={`fa-print${apercu ? " apercu" : ""}`} aria-label={apercu ? "Aperçu de la facture" : `Facture n° ${inv.number}`}>
      {apercu && <p className="fa-wm">Aperçu, pas encore de numéro</p>}
      <header className="fa-top">
        <div className="fa-from">
          <b>{inv.seller.name}</b>
          {inv.seller.address && <span className="fa-pre">{inv.seller.address}</span>}
          {inv.seller.siret && <span>SIRET {siretDit(inv.seller.siret)}</span>}
        </div>
        <div className="fa-id">
          <h1>Facture</h1>
          <span>n° {apercu ? "à venir" : inv.number}</span>
          <span>Date : {dateLongue(inv.issuedAt)}</span>
          <span>Prestations de {moisDit(inv.month)}</span>
        </div>
      </header>
      <div className="fa-to">
        <small>Facturé à</small>
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
          <span>{f ? "Total" : "Total TTC"}</span>
          <span>{eur2(inv.totalTTC)}</span>
        </div>
        {inv.paid > 0 && (
          <div>
            <span>Déjà payé</span>
            <span>{eur2(inv.paid)}</span>
          </div>
        )}
        <div className="fa-due">
          <span>Reste à payer</span>
          <span>{eur2(inv.due)}</span>
        </div>
      </div>
      <footer className="fa-foot">
        {f && <p>{MENTION_FRANCHISE}.</p>}
        <p>Payable à réception.</p>
      </footer>
    </article>
  );
}
