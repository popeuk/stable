"use client";

import Link from "next/link";
import { Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { SaFormule } from "@/components/bs/formule";
import { ClientGate } from "@/components/ui/client-gate";
import { esc } from "@/components/bs/ui";
import { retirer as retirerLigne } from "@/components/bs/retirer";
import { ChevauxDuClient } from "@/components/bs/choisir-proprio";
import { CountUp, Empty, Face, Ic, Ill, Page as Ecran, Switch, eur, eurc, ini, sgc } from "@/components/carnet/ui";
import { useDataStore } from "@/stores/data-store";
import { useUiStore } from "@/stores/ui-store";
import { billOf, cleClient, monthKey, monthsBefore, type Bill, type BillLine } from "@/lib/domain/billing";
import { accord, duMois, dusDuClient, prenomDe } from "@/lib/domain/clients";
import { avanceDite, noterPaiement } from "@/components/bs/noter-paiement";
import { lienFacture } from "@/lib/domain/numeros";
import { currentPeriod } from "@/lib/utils/period";
import type { Period, Person, PersonRole } from "@/lib/domain/types";
import { montantOuZero, saisieMontant } from "@/lib/utils/montant";
import { MoyenChoix } from "@/components/bs/moyen-paiement";
import { dernierMoyen, enMoyen, moyenDit, suggestionsPartielles } from "@/lib/domain/paiement";
import { brouillon, deMois, facturesDe, recettesFacturees } from "@/lib/domain/facture";
import { FeuilleMoyen } from "@/components/bs/moyen-paiement";
import type { PaymentMethod } from "@/lib/domain/types";
import { useFeuille } from "@/components/bs/feuille";
import { vibrer } from "@/lib/utils/vibrer";
import { adresseClient, adresseFacture, nomDeLAdresse } from "@/lib/adresse-client";

/**
 * La fiche d'un client (`/client?c=…`, le nom retrouvé par lib/adresse-client ; l'ancien `?nom=` marche encore ; `&mois=2026-10` pour un mois
 * précis). En haut, sans défiler : Appeler, Message, E-mail (ou un seul
 * « Ajoute son numéro » tant qu'il manque), Notes, son
 * téléphone, ses chevaux, sa dernière note, puis « Hugo te doit 114 € » et
 * « Il a payé ». En dessous : les lignes du mois (× pour retirer ce qui n'a
 * pas eu lieu), le message tout prêt, les mois d'avant, ses infos.
 * Ce qu'il doit vient de billsFor. Styles : app/carnet/client.css.
 */
export default function Page() {
  return (
    <ClientGate>
      <Suspense fallback={null}>
        <FicheRoute />
      </Suspense>
    </ClientGate>
  );
}

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const parseMois = (m: string | null): Period | null => {
  const r = /^(\d{4})-(\d{2})$/.exec(m ?? "");
  return r ? { year: +r[1], month: +r[2] } : null;
};
const nomMois = (p: Period) => {
  const s = new Date(p.year, p.month - 1, 15).toLocaleDateString("fr-FR", { month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const jour = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
/** Une pension ne « n'a pas eu lieu » : elle ne se retire pas d'ici. */
const fixe = (l: BillLine) => /pension/i.test(l.label) && !l.seanceId;

function FicheRoute() {
  const sp = useSearchParams();
  // Le client de l'adresse (?c=, ou l'ancien ?nom=) : lib/adresse-client.
  const nom = useDataStore((s) => nomDeLAdresse(sp, s));
  const mois = parseMois(sp.get("mois"));
  const connu = useDataStore((s) => !!nom && ((s.people ?? []).some((p) => p.name === nom) || s.horses.some((h) => h.ownerName?.trim().toLowerCase() === nom.trim().toLowerCase()) || s.revenues.some((r) => r.payer === nom)));
  if (!connu) {
    return (
      <Ecran>
        <Empty ill="introuvable">On ne trouve pas ce client.</Empty>
        <div className="ch-after">
          <Link href="/chevaux?vue=clients" className="btn line full">
            Tes clients
          </Link>
        </div>
      </Ecran>
    );
  }
  return <Fiche nom={nom} mois={mois} />;
}

/* ---------- La fiche ---------- */

type Ouverte = null | "part" | "notes" | "chevaux";
const meme = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function Fiche({ nom, mois }: { nom: string; mois: Period | null }) {
  const data = useDataStore();
  const router = useRouter();
  const say = useUiStore((s) => s.say);
  const now = useMemo(() => currentPeriod(), []);
  const period = mois ?? now;
  const mk = monthKey(period);
  const person = (data.people ?? []).find((p) => p.name === nom);
  const horses = data.horses.filter((h) => !h.isArchived && meme(h.ownerName, nom));
  const role: PersonRole = person?.role ?? (horses.length ? "proprietaire" : "cavalier");
  const bill: Bill = billOf(data, nom, period) ?? { payer: nom, role, lines: [], total: 0, paid: 0, due: 0 };
  const avant = monthsBefore(data, nom, now, 3);
  // Tout ce qu'il doit, tous mois confondus (le même chiffre que la liste et le +), avec le détail des mois d'avant.
  const dus = useMemo(() => dusDuClient(data, nom, period), [data, nom, period]);
  const anciens = dus?.anciens ?? [];
  const dueMois = dus?.dueMois ?? 0;
  const avance = dus?.avance ?? 0;
  const aRendre = dus?.aRendre ?? 0;
  const [feuille, setFeuille] = useState<Ouverte>(null);
  const [vientDePayer, setVientDePayer] = useState(false);
  // Comment il paie : le dernier moyen noté pour lui, changé d'un toucher.
  const [moyen, setMoyen] = useState<PaymentMethod | undefined>(() => dernierMoyen(data.payments, nom));
  const [cheque, setCheque] = useState("");
  const [demande, setDemande] = useState(false);
  const infos = useRef<HTMLDivElement>(null);

  const qui = prenomDe(nom);
  const Il = accord(nom, "Il", "Elle");
  const seance = !!person?.paieALaSeance;
  const due = dus?.due ?? bill.due;
  const phone = person?.phone?.trim();
  const email = person?.email?.trim();
  const notes = person?.notes ?? [];
  const quiEst = role === "proprietaire" ? (horses.length ? `propriétaire de ${horses.map((h) => h.name).join(" et ")}` : accord(nom, "propriétaire", "propriétaire")) : accord(nom, "cavalier", "cavalière");
  const lignes = [...bill.lines].sort((a, b) => (fixe(a) === fixe(b) ? a.date.localeCompare(b.date) : fixe(a) ? -1 : 1));
  const ouvertes = lignes.filter((l) => !l.onSite && !fixe(l));
  const paiements = (data.payments ?? []).filter((p) => cleClient(p.payer) === cleClient(nom) && p.month === mk && !p.seanceId);

  /** La personne existe dans le carnet (un propriétaire noté seulement sur son cheval n'a pas encore de fiche). */
  const pid = () => person?.id ?? useDataStore.getState().ensurePerson(nom, role);
  const maj = (patch: Partial<Omit<Person, "id">>) => useDataStore.getState().updatePerson(pid(), patch);
  const versInfos = () => {
    infos.current?.scrollIntoView({ behavior: calme() ? "auto" : "smooth", block: "center" });
    setTimeout(() => infos.current?.querySelector("input")?.focus(), calme() ? 0 : 350);
  };

  const payer = (montant: number, m = moyen, chq = cheque) => {
    if (montant <= 0) return;
    if (!m) return setDemande(true);
    // Le plus ancien d'abord, comme depuis le + ; au-delà de tout ce qu'il doit, une avance.
    const ids = noterPaiement({ name: nom, anciens, dueMois, due }, montant, mk, { method: m, chequeNumber: chq });
    vibrer();
    setVientDePayer(true);
    setMoyen(m);
    setCheque("");
    setDemande(false);
    say(`${esc(qui)} t’a payé <strong>${eurc(montant)}</strong> ${enMoyen(m)}.${esc(avanceDite({ name: nom, due }, montant))}`, () => {
      for (const id of ids) useDataStore.getState().removePayment(id);
      setVientDePayer(false);
    });
  };
  const rembourser = () => {
    const id = useDataStore.getState().addPayment(nom, monthKey(now), aRendre, undefined, { method: moyen, kind: "remboursement" });
    vibrer();
    say(`Tu as rendu <strong>${eurc(aRendre)}</strong> à ${esc(qui)}.`, () => useDataStore.getState().removePayment(id));
  };

  const retirer = (l: BillLine, row: HTMLElement | null, malgre = false) => {
    // Une ligne déjà sur une facture : la facture ne change pas, on le dit d'abord et on propose l'avoir.
    const facture = recettesFacturees(data.invoices).get(l.id);
    if (facture && !malgre) return setFacturee({ l, number: facture });
    // Tout compte, tu retires : la séance (ou ce client seul, dans un cours à plusieurs), le soin, ou la recette.
    const go = () => void retirerLigne({ revenueId: l.id, payer: nom, label: `${l.label}, ${jour(l.date)}` });
    if (calme() || !row?.animate) return go();
    row.animate([{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 240, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }).onfinish = go;
  };
  const [facturee, setFacturee] = useState<{ l: BillLine; number: string } | null>(null);
  const brouillonDuMois = useMemo(() => brouillon(data, nom, period), [data, nom, period]);
  const faitesDuMois = facturesDe(data.invoices, nom, mk);

  const contact = (href: string | undefined, ic: ReactNode, label: string) =>
    href ? (
      <a href={href}>
        {ic}
        {label}
      </a>
    ) : (
      <button type="button" className="off" onClick={versInfos} aria-label={`${label} : ajoute ses coordonnées`}>
        {ic}
        {label}
      </button>
    );
  const telHref = phone ? phone.replace(/[^\d+]/g, "") : "";

  return (
    <Ecran>
      <div className="cl-id rise">
        {horses[0] ? <Face horse={horses[0]} /> : <span className="ini">{ini(nom)}</span>}
        <div>
          <h2>{nom}</h2>
          <p>
            {quiEst} · {seance ? "paie à la séance" : "paie au mois"}
          </p>
        </div>
      </div>

      <div className="card cl-due rise">
        <div className="cl-dtop">
          <span>
            <span className="cl-lab">{due > 0 ? `${qui} te doit` : `${Il} a tout payé.`}</span>
            <b className="cl-big">{due > 0 ? <CountUp value={due} fmt={eurc} ms={700} /> : eur(0)}</b>
          </span>
          {due <= 0 && <Ill n="rosette" className="cl-ros" />}
        </div>
        {vientDePayer && <p className="cl-cnt">Déjà compté dans ton bilan.</p>}
        {anciens.map((a) => (
          <p key={a.month} className="cl-cnt">
            <Link className="lnk" href={adresseClient(nom, a.month)}>
              {dueMois > 0 ? "Dont " : ""}
              {eurc(a.due)} {duMois(a.month, period)}
            </Link>
          </p>
        ))}
        {avance > 0 && (
          <p className="cl-cnt">
            Avance {eurc(avance)}. Elle se déduit toute seule de ce qu’{accord(nom, "il", "elle")} te devra ensuite.
          </p>
        )}
        {aRendre > 0 && (
          <>
            <p className="cl-cnt">À lui rendre {eurc(aRendre)} : un avoir sur un mois déjà payé.</p>
            <div className="cl-acts">
              <button type="button" className="btn line" onClick={rembourser}>
                Je l’ai {accord(nom, "remboursé", "remboursée")}
              </button>
            </div>
          </>
        )}
        {seance && due > 0 && ouvertes.length > 0 && (
          <p className="cl-cnt">
            D’habitude, {qui} paie sur place. Là, {pl(ouvertes.length, "séance")} attend{ouvertes.length > 1 ? "ent" : ""}.
          </p>
        )}
        {due > 0 && (
          <MoyenChoix
            value={moyen}
            onChange={(m) => {
              setMoyen(m);
              setDemande(false);
            }}
            cheque={cheque}
            onCheque={setCheque}
            demande={demande}
          />
        )}
        {due > 0 && (
          <div className="cl-acts">
            <button type="button" className="btn" onClick={() => payer(due)}>
              {Il} a payé
            </button>
            <button type="button" className="btn line" onClick={() => setFeuille("part")}>
              {Il} a payé une partie
            </button>
          </div>
        )}
      </div>

      <div className="cl-qa rise" role="group" aria-label={accord(nom, "Le contacter", "La contacter")}>
        {phone ? (
          <>
            {contact(`tel:${telHref}`, <Ic n="phone" className="" />, "Appeler")}
            {contact(`sms:${telHref}`, <Bulle />, "Message")}
          </>
        ) : (
          <button type="button" className="cl-addnum" onClick={versInfos}>
            <Ic n="phone" className="" />
            Ajoute son numéro
          </button>
        )}
        {email && contact(`mailto:${email}`, <Ic n="mail" className="" />, "E-mail")}
        <button type="button" onClick={() => setFeuille("notes")}>
          <Ic n="doc" className="" />
          Notes
        </button>
      </div>

      <div className="cl-key rise">
        {phone && (
          <p>
            <Ic n="phone" className="" />
            <a href={`tel:${telHref}`}>{phone}</a>
          </p>
        )}
        <p>
          <Ic n="horse" className="" />
          <span className="pp-line">
            <span className="cl-1l">
              {horses.length
                ? horses.map((h, i) => (
                    <span key={h.id}>
                      {i > 0 && " · "}
                      <Link href={`/ticket?id=${h.id}`}>{h.name}</Link>
                      {horses.length === 1 && h.pensionType ? `, ${h.pensionType.toLowerCase()}` : ""}
                    </span>
                  ))
                : `pas de cheval à ${accord(nom, "lui", "elle")}`}
            </span>
            <button type="button" className="pp-add" onClick={() => setFeuille("chevaux")} aria-label={`Ajouter un cheval à ${nom}`}>
              <Ic n="plus" className="" />
              {horses.length ? "Ajouter" : "Ajouter un cheval"}
            </button>
          </span>
        </p>
        <p>
          <Ic n="doc" className="" />
          <button type="button" className="cl-1l cl-note1" onClick={() => setFeuille("notes")}>
            {notes[0]?.text ?? "Pas encore de note."}
          </button>
        </p>
      </div>

      <SaFormule nom={nom} role={role} />

      <div className="cl-blk">
        <h3>
          {nomMois(period)}
          <span>
            {eurc(bill.total)} en tout · {eurc(bill.paid)} payé{bill.paid > 1 ? "s" : ""}
          </span>
        </h3>
        {lignes.length ? <p className="cl-auto">Ce qui a eu lieu s’ajoute tout seul.</p> : <p className="cl-auto">Rien ce mois pour l’instant.</p>}
        {lignes.map((l) => (
          <Ligne key={l.id} l={l} onRetirer={retirer} />
        ))}
        {ouvertes.length > 0 && <p className="cl-hint">Si ça n’a pas eu lieu, retire la ligne.</p>}
        {paiements.map((p) => (
          <div key={p.id} className="cl-pd">
            <span>
              {p.kind === "remboursement" ? "Remboursé le" : p.kind === "avance" ? "Avance reçue le" : "Payé le"} {jour(p.at || `${mk}-01`)}
              {p.method ? ` · ${moyenDit(p)}` : ""}
            </span>
            {/* L'argent rentré : en vert, avec son signe ; rendu : à l'encre, en moins. */}
            {p.kind === "remboursement" ? <span>{sgc(-p.amount)}</span> : <span className="in">{sgc(p.amount)}</span>}
          </div>
        ))}
        {(bill.avance ?? 0) > 0 && (
          <div className="cl-pd">
            <span>Pris sur son avance</span>
            <span>{sgc(-(bill.avance ?? 0))}</span>
          </div>
        )}
        {(bill.avoirs ?? []).map((a) => (
          <Link key={a.number} className="cl-pd cl-pdl" href={`/facture?n=${encodeURIComponent(a.number)}`}>
            <span>Avoir n° {a.number}</span>
            {/* Ce qu'elle ne doit plus : à l'encre, avec son signe. */}
            <span>{sgc(-a.amount)}</span>
          </Link>
        ))}
        {bill.total > 0 &&
          (faitesDuMois.length && brouillonDuMois.vide ? (
            <Link className="btn line cl-sendb" href={lienFacture(faitesDuMois[faitesDuMois.length - 1])}>
              <Ic n="arrow" className="" />
              Lui envoyer sa facture
            </Link>
          ) : (
            <Link className="btn line cl-sendb" href={adresseFacture(nom, mk)}>
              <Ic n="doc" className="" />
              Sa facture {deMois(mk).replace(/ \d{4}$/, "")}
            </Link>
          ))}
      </div>

      {avant.length > 0 && (
        <div className="cl-blk">
          <h3>Les mois d’avant</h3>
          {avant.map((m) => {
            const body = (
              <>
                <span>{nomMois(m.period)}</span>
                <span>
                  {eurc(m.total)} · {m.due > 0 ? `${eurc(m.paid)} payé${m.paid > 1 ? "s" : ""}, reste ${eurc(m.due)}` : "payé"}
                </span>
              </>
            );
            return m.due > 0 ? (
              <Link key={monthKey(m.period)} href={adresseClient(nom, monthKey(m.period))} className="cl-pd cl-pdl">
                {body}
              </Link>
            ) : (
              <div key={monthKey(m.period)} className="cl-pd">
                {body}
              </div>
            );
          })}
        </div>
      )}
      {mois && monthKey(mois) !== monthKey(now) && (
        <div className="cl-blk">
          <Link className="lnk" href={adresseClient(nom)}>
            Revenir à {nomMois(now).toLowerCase()}
          </Link>
        </div>
      )}

      <div className="cl-blk cl-infos" ref={infos}>
        <h3>Ses infos</h3>
        <label className="field">
          <span>Son nom</span>
          <input
            key={`n-${person?.id}-${nom}`}
            className="input"
            defaultValue={nom}
            autoComplete="off"
            onBlur={(e) => {
              const n = e.target.value.trim();
              if (!n || n === nom) return void (e.target.value = nom);
              if ((data.people ?? []).some((p) => p.id !== person?.id && meme(p.name, n))) {
                e.target.value = nom;
                return say(`${esc(n)} est déjà dans tes clients.`);
              }
              // Le nom suit partout : ses chevaux, ce qu'il te doit, ses paiements.
              maj({ name: n });
              router.replace(adresseClient(n, mois ? monthKey(mois) : undefined));
            }}
          />
        </label>
        <label className="field">
          <span>Téléphone</span>
          <input key={`t-${person?.id}`} className="input" inputMode="tel" defaultValue={person?.phone ?? ""} placeholder="Son numéro" onBlur={(e) => e.target.value.trim() !== (person?.phone ?? "") && maj({ phone: e.target.value.trim() || undefined })} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input key={`m-${person?.id}`} className="input" type="email" inputMode="email" defaultValue={person?.email ?? ""} placeholder="Son e-mail" onBlur={(e) => e.target.value.trim() !== (person?.email ?? "") && maj({ email: e.target.value.trim() || undefined })} />
        </label>
        <label className="field">
          <span>Adresse</span>
          <textarea key={`a-${person?.id}`} className="input ta fa-adr" rows={2} defaultValue={person?.address ?? ""} placeholder="Pour ses factures, facultatif" onBlur={(e) => e.target.value.trim() !== (person?.address ?? "") && maj({ address: e.target.value.trim() || undefined })} />
        </label>
        <Switch on={seance} onClick={() => maj({ paieALaSeance: !seance })}>
          Paie à la séance
          <small className="cl-sw">Les cours et les balades se paient sur place. Le reste se paie au mois.</small>
        </Switch>
      </div>
      <div className="end" />

      {feuille === "part" && (
        <PartSheet
          qui={qui}
          nom={nom}
          due={due}
          onClose={() => setFeuille(null)}
          moyen={moyen}
          onOk={(v, m, chq) => {
            setFeuille(null);
            payer(v, m, chq);
          }}
        />
      )}
      {feuille === "chevaux" && <ChevauxDuClient nom={nom} onClose={() => setFeuille(null)} />}
      {facturee && (
        <FeuilleMoyen titre="Cette ligne est sur une facture" onClose={() => setFacturee(null)}>
          <div className="pad fa-avf">
            <p className="fa-hint">
              {facturee.l.label}, {jour(facturee.l.date)}, est sur la facture n° {facturee.number}. La retirer ici ne change pas la facture : annule-la par un avoir, pour que ta facture et tes comptes disent la même chose.
            </p>
            <button
              type="button"
              className="btn full"
              onClick={() => {
                const { l, number } = facturee;
                setFacturee(null);
                retirer(l, null, true);
                router.push(`/facture?n=${encodeURIComponent(number)}&avoir=${encodeURIComponent(l.id)}`);
              }}
            >
              La retirer et faire un avoir
            </button>
            <button
              type="button"
              className="btn line full"
              onClick={() => {
                const { l } = facturee;
                setFacturee(null);
                retirer(l, null, true);
              }}
            >
              La retirer sans faire d’avoir
            </button>
          </div>
        </FeuilleMoyen>
      )}
      {feuille === "notes" && (
        <NotesSheet
          qui={qui}
          notes={notes}
          onClose={() => setFeuille(null)}
          onAdd={(t) => {
            useDataStore.getState().addNote(pid(), t);
            setFeuille(null);
            say("C’est noté sur sa fiche.");
          }}
        />
      )}
    </Ecran>
  );
}

function Ligne({ l, onRetirer }: { l: BillLine; onRetirer: (l: BillLine, row: HTMLElement | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rm = !fixe(l) && !l.onSite;
  return (
    <div className="cl-ln" ref={ref}>
      <span>
        <b>{l.label}</b>
        <small>
          {jour(l.date)}
          {l.onSite ? " · payé sur place" : ""}
        </small>
      </span>
      {/* Ce qui est dû n'est pas encore rentré : à l'encre, avec son signe. */}
      <span className="num">{sgc(l.amount)}</span>
      {rm ? (
        <button type="button" className="cl-rm" onClick={() => onRetirer(l, ref.current)} aria-label={`Retirer : ${l.label}, ${jour(l.date)}, n’a pas eu lieu`}>
          <Ic n="x" className="" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function Bulle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function Feuille({ titre, onClose, children }: { titre: string; onClose: () => void; children: ReactNode }) {
  const ref = useFeuille(onClose, { verrou: true });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="carnet carnet-portal">
      <div className="sheet-wrap open">
        <div className="scrim" onClick={onClose} />
        <div className="sheet" role="dialog" aria-modal="true" aria-label={titre} ref={ref}>
          <div className="grab" />
          <div className="shd">
            <b>{titre}</b>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              <Ic n="x" className="" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PartSheet({ qui, nom, due, moyen, onClose, onOk }: { qui: string; nom: string; due: number; moyen?: PaymentMethod; onClose: () => void; onOk: (v: number, m: PaymentMethod, cheque: string) => void }) {
  // Rien de prérempli : on tape ce qui a été payé, ou on touche une suggestion.
  const [v, setV] = useState("");
  const [m, setM] = useState<PaymentMethod | undefined>(moyen);
  const [chq, setChq] = useState("");
  const [demande, setDemande] = useState(false);
  const val = montantOuZero(v);
  const ok = () => (m ? onOk(val, m, chq) : setDemande(true));
  return (
    <Feuille titre={`${qui} a payé une partie`} onClose={onClose}>
      <div className="pad cl-pform">
        <p className="note">
          {accord(nom, "Il", "Elle")} te doit {eurc(due)}. Combien {accord(nom, "t’a-t-il", "t’a-t-elle")} payé ?
        </p>
        <label className="input cl-amtin">
          <input type="text" inputMode="decimal" value={v} placeholder="0" autoFocus onChange={(e) => setV(saisieMontant(e.target.value))} onKeyDown={(e) => e.key === "Enter" && val > 0 && ok()} aria-label="Montant payé" />
          <span className="u">€</span>
        </label>
        <div className="chips">
          {suggestionsPartielles(due)
            .map((x) => (
              <button key={x} type="button" className={`chip${val === x ? " on" : ""}`} aria-pressed={val === x} onClick={() => setV(String(x))}>
                {eur(x)}
              </button>
            ))}
        </div>
        <MoyenChoix value={m} onChange={(x) => (setM(x), setDemande(false))} cheque={chq} onCheque={setChq} demande={demande} />
        <button type="button" className="btn full" disabled={val <= 0} onClick={ok}>
          C’est noté
        </button>
        <p className="cl-hint">Le reste, {accord(nom, "il", "elle")} te le doit encore. Au-delà de {eurc(due)}, c’est une avance.</p>
      </div>
    </Feuille>
  );
}

function NotesSheet({ qui, notes, onClose, onAdd }: { qui: string; notes: NonNullable<Person["notes"]>; onClose: () => void; onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <Feuille titre={`Notes sur ${qui}`} onClose={onClose}>
      <div className="pad cl-nform">
        {notes.length ? (
          notes.map((n) => (
            <div key={n.id} className="cl-nl">
              <small>{jour(n.at)}</small>
              {n.text}
            </div>
          ))
        ) : (
          <p className="note">Pas encore de note.</p>
        )}
        <textarea className="input ta cl-ta" rows={3} placeholder="Ajoute une note" aria-label="Ajoute une note" value={t} onChange={(e) => setT(e.target.value)} />
        <button type="button" className="btn full" disabled={!t.trim()} onClick={() => onAdd(t)}>
          Enregistrer la note
        </button>
      </div>
    </Feuille>
  );
}
